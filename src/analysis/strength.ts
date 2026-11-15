// Estimated playing strength from results against ChessMind opponents (and
// rated human opponents in imported games). Engine accuracy is shown
// separately and is NOT converted to Elo.
import type { GameRecord } from './types';

export interface StrengthPoint { date: number; rating: number; deviation: number; gameId: string }
export interface Strength { rating: number; deviation: number; games: number; history: StrengthPoint[]; provisional: boolean }

const expected = (r: number, o: number) => 1 / (1 + 10 ** ((o - r) / 400));
export function scoreFor(g: GameRecord): number | null {
  if (g.result === '1/2-1/2') return 0.5;
  if (g.result === '1-0') return g.userColor === 'w' ? 1 : 0;
  if (g.result === '0-1') return g.userColor === 'b' ? 1 : 0;
  return null;
}

/** Elo with a shrinking K (fast to settle, then stable) and a simple uncertainty band. */
export function estimateStrength(gamesIn: GameRecord[], start = 1250): Strength {
  const gs = gamesIn.filter((g) => g.opponent.elo && scoreFor(g) !== null).sort((a, b) => a.date - b.date);
  let r = start, dev = 350;
  const history: StrengthPoint[] = [];
  gs.forEach((g, i) => {
    const s = scoreFor(g)!;
    const k = i < 8 ? 48 : i < 25 ? 32 : 20;
    // Takebacks make a win worth less: they hide the mistake that would have been punished.
    const tb = g.takebacks ?? 0;
    const adj = s === 1 && tb > 0 ? Math.max(0.5, 1 - 0.15 * tb) : s;
    r += k * (adj - expected(r, g.opponent.elo!));
    dev = Math.max(60, dev * 0.92);
    history.push({ date: g.date, rating: Math.round(r), deviation: Math.round(dev), gameId: g.id });
  });
  return { rating: Math.round(r), deviation: Math.round(dev), games: gs.length, history, provisional: gs.length < 10 };
}

/** Performance rating over a set of games (classic linear approximation). */
export function performance(gs: GameRecord[]): number | null {
  const rated = gs.filter((g) => g.opponent.elo && scoreFor(g) !== null);
  if (!rated.length) return null;
  const avg = rated.reduce((a, g) => a + g.opponent.elo!, 0) / rated.length;
  const pct = rated.reduce((a, g) => a + scoreFor(g)!, 0) / rated.length;
  const clamped = Math.min(0.99, Math.max(0.01, pct));
  return Math.round(avg + 400 * Math.log10(clamped / (1 - clamped)));
}
