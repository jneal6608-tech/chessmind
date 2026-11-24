// IndexedDB persistence. Everything the coach learns lives here and survives
// browser restarts; export/import gives a portable JSON backup.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameRecord } from '../analysis/types';
import type { Exercise } from '../training/types';
import { mergeLessons } from './lessons';

export interface Attempt {
  id: string;
  exerciseId: string;
  date: number;
  success: boolean;
  timeMs: number;
  theme: string;
  kind: string;
  rating: number;
  hints: number;
  mode: string; // tactics | weakness | endgame | opening | daily | review
}
export interface SrsCard {
  exerciseId: string;
  due: number;
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
  last?: number;
  lastSuccess?: boolean;
}
export interface RatingEntry { id: string; date: number; platform: string; timeControl: string; rating: number }
export interface RepertoireLine {
  id: string;
  color: 'w' | 'b';
  name: string;
  moves: string[]; // uci from the start position
  source: 'builtin' | 'custom';
  courseId?: string;
  notes?: string;
  created: number;
}
export interface DailySession { date: string; items: { exerciseId: string; mode: string }[]; done: Record<string, boolean>; completedAt?: number }
export interface ChatThread { id: string; title: string; fen?: string; updated: number; messages: { role: 'user' | 'assistant'; text: string; fen?: string }[] }

interface Schema extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { date: number } };
  exercises: { key: string; value: Exercise; indexes: { theme: string; source: string } };
  attempts: { key: string; value: Attempt; indexes: { date: number; exerciseId: string } };
  srs: { key: string; value: SrsCard; indexes: { due: number } };
  ratings: { key: string; value: RatingEntry };
  repertoire: { key: string; value: RepertoireLine };
  daily: { key: string; value: DailySession };
  chats: { key: string; value: ChatThread };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
export function db() {
  dbp ??= openDB<Schema>('chessmind', 1, {
    upgrade(d) {
      d.createObjectStore('games', { keyPath: 'id' }).createIndex('date', 'date');
      const ex = d.createObjectStore('exercises', { keyPath: 'id' });
      ex.createIndex('theme', 'theme'); ex.createIndex('source', 'source');
      const at = d.createObjectStore('attempts', { keyPath: 'id' });
      at.createIndex('date', 'date'); at.createIndex('exerciseId', 'exerciseId');
      d.createObjectStore('srs', { keyPath: 'exerciseId' }).createIndex('due', 'due');
      d.createObjectStore('ratings', { keyPath: 'id' });
      d.createObjectStore('repertoire', { keyPath: 'id' });
      d.createObjectStore('daily', { keyPath: 'date' });
      d.createObjectStore('chats', { keyPath: 'id' });
      d.createObjectStore('kv');
    },
  });
  return dbp;
}
/** Tests swap in a fresh database name. */
export function resetDbHandle() { dbp = null; }

const listeners = new Set<() => void>();
/** Components re-read data when anything is written. */
export function onDataChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export function notify() { for (const f of listeners) f(); }

export const games = {
  all: async () => (await (await db()).getAllFromIndex('games', 'date')),
  get: async (id: string) => (await db()).get('games', id),
  put: async (g: GameRecord) => { await (await db()).put('games', g); notify(); },
  del: async (id: string) => { await (await db()).delete('games', id); notify(); },
};
export const exercises = {
  all: async () => (await db()).getAll('exercises'),
  get: async (id: string) => (await db()).get('exercises', id),
  put: async (e: Exercise) => { await (await db()).put('exercises', e); },
  putMany: async (es: Exercise[]) => {
    const tx = (await db()).transaction('exercises', 'readwrite');
    for (const e of es) tx.store.put(e);
    await tx.done;
  },
  byGame: async (gameId: string) => (await (await db()).getAll('exercises')).filter((e) => e.gameId === gameId),
};
export const attempts = {
  all: async () => (await db()).getAllFromIndex('attempts', 'date'),
  add: async (a: Attempt) => { await (await db()).put('attempts', a); notify(); },
};
export const srs = {
  all: async () => (await db()).getAll('srs'),
  get: async (id: string) => (await db()).get('srs', id),
  put: async (c: SrsCard) => { await (await db()).put('srs', c); },
};
export const ratings = {
  all: async () => ((await (await db()).getAll('ratings')).sort((a, b) => a.date - b.date)),
  put: async (r: RatingEntry) => { await (await db()).put('ratings', r); notify(); },
  del: async (id: string) => { await (await db()).delete('ratings', id); notify(); },
};
export const repertoire = {
  all: async () => (await db()).getAll('repertoire'),
  put: async (r: RepertoireLine) => { await (await db()).put('repertoire', r); notify(); },
  del: async (id: string) => { await (await db()).delete('repertoire', id); notify(); },
};
export const daily = {
  get: async (date: string) => (await db()).get('daily', date),
  put: async (d: DailySession) => { await (await db()).put('daily', d); notify(); },
  all: async () => (await db()).getAll('daily'),
};
export const chats = {
  all: async () => ((await (await db()).getAll('chats')).sort((a, b) => b.updated - a.updated)),
  put: async (c: ChatThread) => { await (await db()).put('chats', c); },
  del: async (id: string) => { await (await db()).delete('chats', id); },
};
export const kv = {
  get: async <T,>(k: string) => (await (await db()).get('kv', k)) as T | undefined,
  set: async (k: string, v: unknown) => { await (await db()).put('kv', v, k); notify(); },
};

const STORES = ['games', 'exercises', 'attempts', 'srs', 'ratings', 'repertoire', 'daily', 'chats', 'kv'] as const;

export async function exportAll(): Promise<string> {
  const d = await db();
  const out: Record<string, unknown> = { app: 'ChessMind', version: 1, exported: new Date().toISOString() };
  for (const s of STORES) {
    if (s === 'kv') {
      const keys = await d.getAllKeys('kv');
      const vals = await d.getAll('kv');
      out.kv = Object.fromEntries(keys.map((k, i) => [k, vals[i]]).filter(([k]) => k !== 'apiKey'));
    } else out[s] = await d.getAll(s);
  }
  return JSON.stringify(out);
}
export async function importAll(json: string, mode: 'merge' | 'replace' = 'merge') {
  const data = JSON.parse(json);
  if (data.app !== 'ChessMind') throw new Error('This file is not a ChessMind backup.');
  const d = await db();
  for (const s of STORES) {
    if (!(s in data)) continue;
    const tx = d.transaction(s, 'readwrite');
    if (mode === 'replace') await tx.store.clear();
    if (s === 'kv') {
      for (const [k, v] of Object.entries(data.kv as Record<string, unknown>)) {
        // Lesson progress is merged, so importing a backup never loses lessons done on this device.
        if (k === 'lessons' && mode === 'merge') {
          const cur = ((await tx.store.get('lessons' as never)) ?? {}) as Record<string, never>;
          await tx.store.put(mergeLessons(cur, v as Record<string, never>) as never, k as never);
        } else await tx.store.put(v as never, k as never);
      }
    }
    else for (const v of data[s] as unknown[]) await tx.store.put(v as never);
    await tx.done;
  }
  notify();
}
export async function wipeAll() {
  const d = await db();
  for (const s of STORES) await d.clear(s);
  notify();
}
