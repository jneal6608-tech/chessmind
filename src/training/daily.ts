// Daily challenge: a short session built around today's priorities.
import type { AppData } from '../services/data';
import { pick } from './select';
import { WEAKNESS } from './themes';
import type { DailySession } from '../store/db';

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const seedOf = (k: string) => [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7);

export function buildDaily(d: AppData, date = todayKey()): DailySession {
  const pool = { exercises: d.exercises, cards: d.cards, attempts: d.attempts, base: d.strength.rating };
  const seed = seedOf(date);
  const chosen: { exerciseId: string; mode: string }[] = [];
  const used = new Set<string>();
  const add = (ids: { id: string }[], mode: string) => ids.forEach((e) => { if (!used.has(e.id)) { used.add(e.id); chosen.push({ exerciseId: e.id, mode }); } });
  // 1. Two reviews that are due (spaced repetition)
  const now = Date.now();
  const due = d.exercises.filter((e) => { const c = d.cards.get(e.id); return c && c.due <= now; }).slice(0, 2);
  add(due, 'review');
  // 2. One of your own mistakes you have not practised yet
  add(pick(pool, { kinds: ['own_mistake'], count: 1, exclude: used, seed, includeDue: false }), 'own');
  // 3. One or two per top weakness
  const top = d.profile.top.length ? d.profile.top : [];
  const themes = top.flatMap((w) => WEAKNESS[w.key]?.train.slice(0, 2) ?? []);
  for (const w of top) add(pick(pool, { themes: WEAKNESS[w.key]?.train ?? [], kinds: ['tactic', 'own_mistake'], count: top.length >= 3 ? 1 : 2, exclude: used, seed: seed + w.key.length, includeDue: false }), 'weakness');
  // 4. Fill to six tactics, then one endgame
  if (chosen.length < 6) add(pick(pool, { kinds: ['tactic'], themes: themes.length ? undefined : undefined, count: 6 - chosen.length, exclude: used, seed: seed + 3, includeDue: false }), 'tactics');
  add(pick(pool, { kinds: ['endgame'], count: 1, exclude: used, seed: seed + 5, includeDue: false }), 'endgame');
  return { date, items: chosen, done: {} };
}

export function streak(days: DailySession[], today = todayKey()): number {
  const done = new Set(days.filter((x) => x.completedAt).map((x) => x.date));
  let n = 0;
  const d = new Date();
  if (!done.has(today)) d.setDate(d.getDate() - 1);
  for (;;) { if (done.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
