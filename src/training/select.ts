// Chooses what to practise: due reviews first, then your own mistakes, then
// fresh engine-verified exercises at the edge of your current level.
import type { Exercise } from './types';
import type { Attempt, SrsCard } from '../store/db';
import { themeRatings } from './srs';

export interface Pool {
  exercises: Exercise[];
  cards: Map<string, SrsCard>;
  attempts: Attempt[];
  base: number;
  now?: number;
}
export interface PickOpts { themes?: string[]; kinds?: Exercise['kind'][]; count: number; exclude?: Set<string>; seed?: number; includeDue?: boolean }

function rng(seed: number) { let s = seed || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

export function pick(pool: Pool, o: PickOpts): Exercise[] {
  const now = pool.now ?? Date.now();
  const rand = rng(o.seed ?? Math.floor(now / 1000));
  const ratings = themeRatings(pool.attempts, pool.base);
  const lastTry = new Map<string, Attempt>();
  for (const a of pool.attempts) lastTry.set(a.exerciseId, a);
  const fits = (e: Exercise) => (!o.themes || o.themes.includes(e.theme)) && (!o.kinds || o.kinds.includes(e.kind)) && !o.exclude?.has(e.id);
  const cand = pool.exercises.filter(fits);
  const chosen: Exercise[] = [];
  const take = (e: Exercise) => { if (chosen.length < o.count && !chosen.includes(e)) chosen.push(e); };
  // 1. Due reviews (failed ones first)
  if (o.includeDue !== false) {
    cand.filter((e) => { const c = pool.cards.get(e.id); return c && c.due <= now; })
      .sort((a, b) => Number(pool.cards.get(a.id)!.lastSuccess) - Number(pool.cards.get(b.id)!.lastSuccess) || pool.cards.get(a.id)!.due - pool.cards.get(b.id)!.due)
      .slice(0, Math.ceil(o.count / 2)).forEach(take);
  }
  // 2. Own mistakes not yet practised
  cand.filter((e) => e.source === 'game' && !lastTry.has(e.id)).sort(() => rand() - 0.5).slice(0, Math.ceil(o.count / 2)).forEach(take);
  // 3. Fresh exercises near the current theme rating (slightly above: the learning edge)
  const fresh = cand.filter((e) => !lastTry.has(e.id) && !chosen.includes(e));
  for (const width of [150, 300, 600, 3000]) {
    if (chosen.length >= o.count) break;
    const inWin = fresh.filter((e) => {
      const target = (ratings[e.theme] ?? pool.base) + 50;
      return Math.abs(e.rating - target) <= width && !chosen.includes(e);
    });
    // Spread across themes so a session is not one pattern repeated.
    const byTheme = new Map<string, Exercise[]>();
    // Prefer exercises whose opponent's last move is known (it can be shown and replayed).
    for (const e of inWin.sort(() => rand() - 0.5).sort((x, y) => Number(!!y.lastMove) - Number(!!x.lastMove))) (byTheme.get(e.theme) ?? byTheme.set(e.theme, []).get(e.theme)!).push(e);
    const queues = [...byTheme.values()];
    while (chosen.length < o.count && queues.some((q) => q.length)) for (const q of queues) { const e = q.shift(); if (e) take(e); }
  }
  // 4. Last resort: older successes not seen for 3+ weeks
  if (chosen.length < o.count) {
    cand.filter((e) => { const a = lastTry.get(e.id); return a && a.success && now - a.date > 21 * 86400000 && !chosen.includes(e); })
      .sort(() => rand() - 0.5).forEach(take);
  }
  return chosen;
}
