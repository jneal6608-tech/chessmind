// Engine review of a finished game: evaluation of every position, move
// classification, accuracy, critical moments, phase performance and lessons.
import { Chess, type Color } from 'chess.js';
import type { UciEngine, EvalLine } from '../engine/uci';
import { scoreOf, winPct } from '../engine/uci';
import { phaseOf, pvToSan, tryMove, nullMoveFen, opp, START_FEN } from '../chess/util';
import { detectLineMotifs } from '../chess/motifs';
import { classifyMove } from './classify';
import { identifyOpening, isBookPosition } from '../openings/identify';
import { WEAKNESS } from '../training/themes';
import type { GameAnalysis, GameRecord, MoveAnalysis, MoveClass, PhaseStats, Counts } from './types';

export const ANALYSIS_VERSION = 3;

/** Lichess move accuracy from win-chance loss (percentage points). */
export function moveAccuracy(winLoss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}
/** Game accuracy: mean of the arithmetic and harmonic means of move accuracies (punishes blunders). */
export function gameAccuracy(acc: number[]): number {
  if (!acc.length) return 0;
  const mean = acc.reduce((a, b) => a + b, 0) / acc.length;
  const harm = acc.length / acc.reduce((a, b) => a + 1 / Math.max(1, b), 0);
  return Math.round(((mean + harm) / 2) * 10) / 10;
}

export function classOf(winLoss: number, ctx: { book: boolean; forced: boolean; bestPlayed: boolean; missed: boolean; nearBest: boolean }): MoveClass {
  if (ctx.forced) return 'forced';
  if (ctx.book && winLoss < 5) return 'book';
  if (ctx.bestPlayed) return 'best';
  if (ctx.missed && winLoss >= 10) return 'miss';
  if (winLoss >= 20) return 'blunder';
  if (winLoss >= 10) return 'mistake';
  if (winLoss >= 5) return 'inaccuracy';
  return ctx.nearBest || winLoss < 2 ? 'excellent' : 'good';
}

export interface ReviewProgress { done: number; total: number }

export async function reviewGame(
  g: GameRecord, engine: UciEngine, depth = 12,
  onProgress?: (p: ReviewProgress) => void, isCancelled?: () => boolean,
): Promise<GameAnalysis> {
  const c = new Chess(g.startFen ?? START_FEN);
  const fens = [c.fen()];
  for (const u of g.moves) { if (!tryMove(c, u)) break; fens.push(c.fen()); }
  const n = fens.length - 1;
  // Evaluate every position (MultiPV 2: "only move" and missed-win detection need the runner-up).
  const evals: EvalLine[][] = [];
  for (let i = 0; i <= n; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    const pos = new Chess(fens[i]);
    if (pos.isGameOver()) {
      evals.push([{ cp: pos.isCheckmate() ? undefined : 0, mate: pos.isCheckmate() ? 0 : undefined, pv: [], depth }]);
    } else {
      evals.push((await engine.analyze(fens[i], { depth, multipv: 2 })).lines);
    }
    onProgress?.({ done: i + 1, total: n + 1 });
  }
  // Side-to-move score -> White's view
  const white = (i: number) => {
    const s = scoreOf(evals[i][0]);
    return fens[i].split(' ')[1] === 'w' ? s : -s;
  };
  const moves: MoveAnalysis[] = [];
  const opening = identifyOpening(g.moves, g.startFen);
  for (let i = 0; i < n; i++) {
    const fen = fens[i];
    const color = fen.split(' ')[1] as Color;
    const sign = color === 'w' ? 1 : -1;
    const before = white(i), after = white(i + 1);
    const moverBefore = before * sign, moverAfter = after * sign;
    const best = evals[i][0];
    const bestUci = best?.pv[0] ?? g.moves[i];
    const wBefore = winPct(moverBefore), wAfter = winPct(moverAfter);
    const played = g.moves[i];
    const bestPlayed = played === bestUci;
    const winLoss = bestPlayed ? 0 : Math.max(0, wBefore - wAfter);
    const legal = new Chess(fen).moves().length;
    const second = evals[i][1];
    const nearBest = !!second && second.pv[0] === played && winPct(scoreOf(best)) - winPct(scoreOf(second)) < 2;
    // A "miss": the opponent had just erred (we were winning only because of it) and we let it go.
    const prevMover = i > 0 ? winPct(white(i - 1) * sign) : 50; // our chances before their last move
    const missed = wBefore >= 70 && prevMover < 60 && wAfter < wBefore - 10;
    const book = i < 24 && isBookPosition(fens[i + 1]);
    const cls = classOf(winLoss, { book, forced: legal === 1, bestPlayed, missed, nearBest });
    const bestLineUci = best?.pv.slice(0, 10) ?? [];
    const replyLineUci = evals[i + 1][0]?.pv.slice(0, 8) ?? [];
    const m: MoveAnalysis = {
      ply: i, color, san: g.sans[i] ?? played, uci: played, fenBefore: fen, fenAfter: fens[i + 1],
      evalBefore: before, evalAfter: after, bestUci, bestSan: pvToSan(fen, [bestUci])[0] ?? bestUci,
      bestLine: pvToSan(fen, bestLineUci), bestLineUci,
      replyLine: pvToSan(fens[i + 1], replyLineUci), replyLineUci,
      winLoss: Math.round(winLoss * 10) / 10,
      cpl: bestPlayed ? 0 : Math.min(1000, Math.max(0, moverBefore - moverAfter)),
      accuracy: Math.round(moveAccuracy(winLoss) * 10) / 10,
      cls, phase: phaseOf(fen), timeMs: g.times?.[i],
      motifsBest: bestLineUci.length ? detectLineMotifs(fen, bestLineUci).motifs : [],
      motifsReply: replyLineUci.length ? detectLineMotifs(fens[i + 1], replyLineUci).motifs : [],
      tags: [], depth,
    };
    // Threat check (null move) only where it matters: the user's errors.
    if (color === g.userColor && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(cls)) {
      const nm = nullMoveFen(fen);
      if (nm) {
        const t = (await engine.analyze(nm, { depth: Math.min(depth, 11) })).lines[0];
        // A real threat: the opponent would gain >= 1.5 pawns of advantage if we "passed".
        if (t && scoreOf(t) - (-moverBefore) >= 150) {
          m.threatUci = t.pv[0];
          m.threatSan = pvToSan(nm, [t.pv[0]])[0];
        }
      }
    }
    moves.push(m);
  }
  // Tags need the full move list (time profile, previous moves).
  const userTimes = moves.filter((m) => m.color === g.userColor && m.timeMs).map((m) => m.timeMs!).sort((a, b) => a - b);
  const medianTime = userTimes.length ? userTimes[Math.floor(userTimes.length / 2)] : undefined;
  for (const m of moves) {
    if (m.color !== g.userColor) continue;
    if (['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.cls)) m.tags = classifyMove(m, moves, { medianTime, opening });
  }
  return summarize(g, moves, depth);
}

const ERR = ['inaccuracy', 'mistake', 'blunder', 'miss'] as const;
function counts(ms: MoveAnalysis[]): Counts {
  const c: Counts = { inaccuracy: 0, mistake: 0, blunder: 0, miss: 0, best: 0 };
  for (const m of ms) {
    if (m.cls === 'best' || m.cls === 'excellent') c.best++;
    else if ((ERR as readonly string[]).includes(m.cls)) c[m.cls as keyof Counts]++;
  }
  return c;
}

export function summarize(g: GameRecord, moves: MoveAnalysis[], depth: number): GameAnalysis {
  const by = (c: Color) => moves.filter((m) => m.color === c && m.cls !== 'forced');
  const mine = by(g.userColor);
  const phases = {} as Record<string, PhaseStats>;
  for (const ph of ['opening', 'middlegame', 'endgame'] as const) {
    const ms = mine.filter((m) => m.phase === ph);
    const cc = counts(ms);
    phases[ph] = { moves: ms.length, accuracy: gameAccuracy(ms.map((m) => m.accuracy)), inaccuracies: cc.inaccuracy, mistakes: cc.mistake + cc.miss, blunders: cc.blunder };
  }
  const errors = mine.filter((m) => m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss');
  const critical = errors.slice().sort((a, b) => b.winLoss - a.winLoss).slice(0, 6).map((m) => m.ply);
  // Lessons: weakness keys weighted by severity x confidence.
  const w: Record<string, { s: number; plies: number[] }> = {};
  for (const m of mine) for (const t of m.tags) {
    const sev = m.cls === 'blunder' ? 3 : m.cls === 'mistake' || m.cls === 'miss' ? 2 : 0.5;
    (w[t.key] ??= { s: 0, plies: [] }).s += sev * t.confidence;
    w[t.key].plies.push(m.ply);
  }
  const lessons = Object.entries(w).sort((a, b) => b[1].s - a[1].s).slice(0, 3)
    .map(([key, v]) => ({ key, text: WEAKNESS[key]?.lesson ?? key, plies: [...new Set(v.plies)] }));
  return {
    version: ANALYSIS_VERSION, depth, moves, critical,
    accuracy: { w: gameAccuracy(by('w').map((m) => m.accuracy)), b: gameAccuracy(by('b').map((m) => m.accuracy)) },
    counts: { w: counts(by('w')), b: counts(by('b')) },
    phases: phases as GameAnalysis['phases'], lessons,
    missedWins: mine.filter((m) => m.cls === 'miss').length,
    analyzedAt: Date.now(),
  };
}
export { opp };
