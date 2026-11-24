// Principle-lesson progress, kept in the app database (IndexedDB) with
// everything else, so it is part of the Settings backup (export/import) and is
// merged, not overwritten, when a backup is imported on another device.
import { kv } from './db';

export interface LessonRecord {
  /** Last time the lesson was finished. */
  completedAt: number;
  /** Challenges solved on the first try, the last time through. */
  right: number;
  total: number;
  /** How many times the lesson was finished. */
  times: number;
}
export type LessonProgress = Record<string, LessonRecord>;

export const LESSONS_KEY = 'lessons';
const LEGACY_KEY = 'chessmind-lessons-done';

export async function getLessons(): Promise<LessonProgress> {
  const rec: LessonProgress = { ...((await kv.get<LessonProgress>(LESSONS_KEY)) ?? {}) };
  // One-time move from the old browser-only storage.
  try {
    const old = globalThis.localStorage?.getItem(LEGACY_KEY);
    if (old) {
      for (const id of JSON.parse(old) as string[]) rec[id] ??= { completedAt: Date.now(), right: 0, total: 0, times: 1 };
      await kv.set(LESSONS_KEY, rec);
      globalThis.localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* storage unavailable: nothing to migrate */ }
  return rec;
}

export async function recordLesson(id: string, right: number, total: number): Promise<void> {
  const rec = await getLessons();
  rec[id] = { completedAt: Date.now(), right, total, times: (rec[id]?.times ?? 0) + 1 };
  await kv.set(LESSONS_KEY, rec);
}

/** Merge two progress records (backup import): keep every lesson, the latest completion and the most runs. */
export function mergeLessons(a: LessonProgress, b: LessonProgress): LessonProgress {
  const out: LessonProgress = { ...a };
  for (const [id, r] of Object.entries(b)) {
    const x = out[id];
    if (!x) { out[id] = r; continue; }
    const latest = r.completedAt >= x.completedAt ? r : x;
    out[id] = { ...latest, times: Math.max(x.times ?? 1, r.times ?? 1) };
  }
  return out;
}
