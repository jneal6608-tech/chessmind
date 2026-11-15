// Spaced repetition (SM-2 family) for exercises, and adaptive per-theme
// training ratings so difficulty follows performance.
import type { SrsCard, Attempt } from '../store/db';

const DAY = 86400000;
export function nextCard(card: SrsCard | undefined, exerciseId: string, success: boolean, timeMs: number, now = Date.now()): SrsCard {
  const c: SrsCard = card ?? { exerciseId, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
  if (!success) {
    // Failed: see it again tomorrow and the ease drops.
    return { ...c, interval: 1, ease: Math.max(1.3, c.ease - 0.2), reps: 0, lapses: c.lapses + 1, due: now + DAY, last: now, lastSuccess: false };
  }
  const slow = timeMs > 90000;
  const quality = slow ? 3 : timeMs < 20000 ? 5 : 4;
  const ease = Math.max(1.3, c.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const interval = c.reps === 0 ? (slow ? 2 : 3) : c.reps === 1 ? 7 : Math.round(c.interval * ease);
  return { ...c, ease, interval, reps: c.reps + 1, due: now + interval * DAY, last: now, lastSuccess: true };
}

/** Elo-style training rating per theme: up on success, down on failure, scaled by exercise rating. */
export function themeRatings(attempts: Attempt[], base: number): Record<string, number> {
  const r: Record<string, number> = {};
  const n: Record<string, number> = {};
  for (const a of attempts.slice().sort((x, y) => x.date - y.date)) {
    const cur = r[a.theme] ?? base;
    const k = (n[a.theme] ?? 0) < 10 ? 40 : 24;
    const exp = 1 / (1 + 10 ** ((a.rating - cur) / 400));
    // A success with hints counts as half, a slow success counts a little less.
    const s = a.success ? (a.hints ? 0.5 : a.timeMs > 120000 ? 0.8 : 1) : 0;
    r[a.theme] = Math.round(cur + k * (s - exp));
    n[a.theme] = (n[a.theme] ?? 0) + 1;
  }
  return r;
}
export function overallTrainingRating(attempts: Attempt[], base: number) {
  let cur = base;
  attempts.slice().sort((x, y) => x.date - y.date).forEach((a, i) => {
    const exp = 1 / (1 + 10 ** ((a.rating - cur) / 400));
    cur += (i < 15 ? 32 : 16) * ((a.success ? (a.hints ? 0.5 : 1) : 0) - exp);
  });
  return Math.round(cur);
}
