// Stockfish-powered opponents with human-like strength and style.
// Strength comes from how deep the engine looks and how far from the best
// move it may stray; style re-ranks the moves it considers acceptable. Weak
// levels make mistakes because they search shallowly (they really "don't see"
// deeper tactics), never because a random move is picked.
import { Chess } from 'chess.js';
import type { UciEngine, EvalLine } from './uci';
import { scoreOf } from './uci';
import { parseUci, VAL, fileOf, rankOf, findKing, phaseOf, kingShield, opp, material } from '../chess/util';

export interface Level {
  id: string;
  name: string;
  /** Approximate strength; not calibrated against a human rating pool. */
  elo: number;
  depth: number;
  multipv: number;
  /** Max centipawns below the best line a move may be and still be considered. */
  window: number;
  /** Softmax temperature in centipawns. */
  temp: number;
  /** Chance per move of a human oversight: deciding from a very shallow search. */
  slip: number;
  slipDepth: number;
  movetime?: number;
  blurb: string;
}
export const LEVELS: Level[] = [
  { id: 'l1', name: 'Novice', elo: 700, depth: 2, multipv: 6, window: 400, temp: 140, slip: 0.25, slipDepth: 1, blurb: 'Knows the rules, develops some pieces, hangs things often.' },
  { id: 'l2', name: 'Beginner', elo: 900, depth: 3, multipv: 6, window: 260, temp: 100, slip: 0.18, slipDepth: 1, blurb: 'Plays sensible moves but misses two-move tactics.' },
  { id: 'l3', name: 'Casual', elo: 1100, depth: 4, multipv: 5, window: 180, temp: 70, slip: 0.12, slipDepth: 2, blurb: 'Sees simple threats; still drops material under pressure.' },
  { id: 'l4', name: 'Club', elo: 1300, depth: 5, multipv: 5, window: 120, temp: 50, slip: 0.08, slipDepth: 2, blurb: 'Plays reasonably and punishes loose pieces. Occasionally misses tactics.' },
  { id: 'l5', name: 'Intermediate', elo: 1500, depth: 7, multipv: 4, window: 80, temp: 35, slip: 0.05, slipDepth: 3, blurb: 'Solid, finds most short tactics.' },
  { id: 'l6', name: 'Strong club', elo: 1700, depth: 9, multipv: 4, window: 55, temp: 25, slip: 0.03, slipDepth: 4, blurb: 'Good tactics and reasonable plans.' },
  { id: 'l7', name: 'Advanced', elo: 1900, depth: 11, multipv: 3, window: 35, temp: 15, slip: 0.015, slipDepth: 5, blurb: 'Strong positional and tactical play.' },
  { id: 'l8', name: 'Expert', elo: 2200, depth: 14, multipv: 3, window: 20, temp: 8, slip: 0, slipDepth: 6, blurb: 'Rarely errs. Very hard to beat.' },
  { id: 'l9', name: 'Master', elo: 2600, depth: 18, multipv: 1, window: 0, temp: 1, slip: 0, slipDepth: 8, movetime: 1500, blurb: 'Stockfish at full depth for the time given.' },
];

export interface Personality { id: string; name: string; blurb: string }
export const PERSONALITIES: Personality[] = [
  { id: 'balanced', name: 'Balanced', blurb: 'No particular preference: picks good moves of every kind.' },
  { id: 'aggressive', name: 'Aggressive attacker', blurb: 'Goes for your king: checks, sacrifices, pawn storms.' },
  { id: 'defensive', name: 'Defensive', blurb: 'Keeps its king safe, protects everything, trades when ahead.' },
  { id: 'positional', name: 'Positional', blurb: 'Prefers quiet improving moves, central control and good structure.' },
  { id: 'tactical', name: 'Tactician', blurb: 'Loves forcing moves and complications.' },
  { id: 'endgame', name: 'Endgame specialist', blurb: 'Trades pieces toward the endgame, where it plays its best.' },
];

/** Style bonus in centipawns for a candidate move (only among already-acceptable moves). */
export function styleBonus(fen: string, uci: string, style: string): number {
  if (style === 'balanced') return 0;
  const c = new Chess(fen);
  const me = c.turn(), them = opp(me);
  const m = parseUci(uci);
  let mv;
  try { mv = c.move(m); } catch { return 0; }
  const theirKing = findKing(c, them);
  const dist = (a: string, b: string) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
  const check = c.isCheck() ? 1 : 0;
  const cap = mv.captured ? VAL[mv.captured] : 0;
  const closer = dist(m.from, theirKing) - dist(m.to, theirKing);
  const pawnStorm = mv.piece === 'p' && Math.abs(fileOf(m.to) - fileOf(theirKing)) <= 1 && phaseOf(fen) !== 'endgame' ? 1 : 0;
  const ph = phaseOf(fen);
  const mat = material(c);
  const ahead = (me === 'w' ? mat.w - mat.b : mat.b - mat.w) >= 2;
  const trade = mv.captured && VAL[mv.captured] === VAL[mv.piece] && mv.piece !== 'p' ? 1 : 0;
  const myShieldLoss = kingShield(new Chess(fen), me) - kingShield(c, me);
  const central = fileOf(m.to) >= 2 && fileOf(m.to) <= 5 && rankOf(m.to) >= 2 && rankOf(m.to) <= 5 ? 1 : 0;
  switch (style) {
    case 'aggressive': return 30 * check + 12 * closer + 25 * pawnStorm + 8 * cap - (trade ? 15 : 0);
    case 'tactical': return 35 * check + 15 * cap + 6 * closer;
    case 'defensive': return -25 * myShieldLoss + (ahead && trade ? 30 : 0) - 10 * check + (mv.san.includes('O-O') ? 30 : 0) + (dist(m.to, findKing(c, me)) <= 2 ? 6 : 0);
    case 'positional': return 15 * central - 12 * check - (mv.piece === 'p' && !central ? 10 : 0) + (mv.san.includes('O-O') ? 20 : 0) - 8 * cap;
    case 'endgame': return (trade ? 35 : 0) + (ph === 'endgame' && mv.piece === 'k' ? 15 : 0) - 8 * check;
    default: return 0;
  }
}

export interface ChoiceInfo { uci: string; lines: EvalLine[]; slipped: boolean }

export async function chooseMove(engine: UciEngine, fen: string, level: Level, style: string, rand = Math.random): Promise<ChoiceInfo> {
  const ph = phaseOf(fen);
  // The endgame specialist plays endgames two levels stronger and openings a bit weaker.
  let depth = level.depth;
  if (style === 'endgame') depth = ph === 'endgame' ? depth + 4 : Math.max(1, depth - 1);
  if (level.movetime) {
    const r = await engine.analyze(fen, { movetime: level.movetime, depth: level.depth + 6 });
    return { uci: r.bestmove ?? r.lines[0]?.pv[0], lines: r.lines, slipped: false };
  }
  const slipped = rand() < level.slip;
  const r = await engine.analyze(fen, { depth: slipped ? level.slipDepth : depth, multipv: level.multipv });
  const ls = r.lines.filter((l) => l.pv.length);
  if (!ls.length) return { uci: r.bestmove!, lines: r.lines, slipped };
  const best = scoreOf(ls[0]);
  // Never miss a mate in one or two at Casual and above: that would look artificial.
  if (ls[0].mate !== undefined && ls[0].mate > 0 && ls[0].mate <= 2 && level.elo >= 1100) return { uci: ls[0].pv[0], lines: ls, slipped };
  const ok = ls.filter((l) => best - scoreOf(l) <= level.window);
  const util = ok.map((l) => scoreOf(l) + styleBonus(fen, l.pv[0], style));
  const top = Math.max(...util);
  const w = util.map((u) => Math.exp((u - top) / Math.max(1, level.temp)));
  const sum = w.reduce((a, b) => a + b, 0);
  let x = rand() * sum;
  for (let i = 0; i < ok.length; i++) { x -= w[i]; if (x <= 0) return { uci: ok[i].pv[0], lines: ls, slipped }; }
  return { uci: ok[0].pv[0], lines: ls, slipped };
}

export const levelById = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[3];
/** Level whose nominal strength is closest to (estimate + stretch). */
export function recommendLevel(estimate: number, recentScore: number | null): Level {
  const stretch = recentScore === null ? 50 : recentScore > 0.65 ? 150 : recentScore < 0.35 ? -100 : 50;
  return LEVELS.slice(0, 8).reduce((a, b) => (Math.abs(b.elo - (estimate + stretch)) < Math.abs(a.elo - (estimate + stretch)) ? b : a));
}
