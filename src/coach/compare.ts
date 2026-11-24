// "Why is this move better than that one?" Compares two candidate moves in the
// same position using their Stockfish lines and concrete board facts: material
// at the end of each line, pawn structure, king safety, development, loose
// pieces and what the opponent's best reply does. Every reason is a fact about
// the two resulting positions, never a guess.
import { Chess, type Color, type Square } from 'chess.js';
import type { UciEngine } from '../engine/uci';
import { scoreOf, winPct, formatScore } from '../engine/uci';
import { tryMove, pawnInfo, kingShield, undeveloped, pieces, PIECE_NAME, VAL, opp, sanOf } from '../chess/util';
import { threatOn } from '../chess/tactics';
import { detectMotifs } from '../chess/motifs';
import { settle, lineResult, feel } from './teach';
import { strategicReasons, planOf } from './positional';

export interface Candidate {
  uci: string;
  san: string;
  /** Engine score after the move, from the mover's point of view (centipawns, mates near +/-10000). */
  cp: number;
  /** Engine line starting with this move. */
  pv: string[];
}
export interface Comparison {
  /** The position both moves are played from. */
  fen: string;
  better: Candidate;
  worse: Candidate;
  /** True when the two moves are practically equal. */
  equal: boolean;
  summary: string;
  reasons: string[];
  /** What happens after each move, in one sentence. */
  betterResult: string;
  worseResult: string;
}

function after(fen: string, ucis: string[]): Chess {
  const c = new Chess(fen);
  for (const u of ucis) if (!tryMove(c, u)) break;
  return c;
}

/** Number of moves `side` would have in `c` (as if it were their turn). */
function mobility(c: Chess, side: Color): number {
  const p = c.fen().split(' ');
  if (p[1] !== side) { p[1] = side; p[3] = '-'; }
  try { return new Chess(p.join(' ')).moves().length; } catch { return 0; }
}

/** Pieces of `side` that the other side wins by capturing (threat that survives the defenders). */
function loosePieces(c: Chess, side: Color) {
  const fen = c.fen();
  return pieces(c, side).filter((p) => p.type !== 'k' && p.type !== 'p' && threatOn(fen, p.square, opp(side)) > 0);
}

const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'];
function centerControl(c: Chess, side: Color): number {
  return CENTER.reduce((n, s) => n + c.attackers(s, side).length + (c.get(s)?.color === side && c.get(s)?.type === 'p' ? 1 : 0), 0);
}
function castleRights(c: Chess, side: Color) {
  const r = c.fen().split(' ')[2];
  return side === 'w' ? /[KQ]/.test(r) : /[kq]/.test(r);
}
function bishops(c: Chess, side: Color) { return pieces(c, side).filter((p) => p.type === 'b').length; }

interface Facts {
  doubled: number; isolated: number; passed: number;
  oppDoubled: number; oppIsolated: number; oppPassed: number;
  shield: number; castle: boolean; undeveloped: number;
  mobility: number; center: number; loose: { square: Square; type: string }[];
  bishops: number; oppBishops: number;
}
function facts(c: Chess, me: Color): Facts {
  const mine = pawnInfo(c, me), theirs = pawnInfo(c, opp(me));
  return {
    doubled: mine.doubled, isolated: mine.isolated, passed: mine.passed.length,
    oppDoubled: theirs.doubled, oppIsolated: theirs.isolated, oppPassed: theirs.passed.length,
    shield: kingShield(c, me), castle: castleRights(c, me), undeveloped: undeveloped(c, me),
    mobility: mobility(c, me), center: centerControl(c, me), loose: loosePieces(c, me),
    bishops: bishops(c, me), oppBishops: bishops(c, opp(me)),
  };
}

/**
 * Compare two candidates. `a` and `b` can be given in any order; the better one
 * (by engine score) comes out first.
 */
export function compareMoves(fen: string, x: Candidate, y: Candidate): Comparison {
  const me = new Chess(fen).turn();
  const [A, B] = x.cp >= y.cp ? [x, y] : [y, x];
  const gap = winPct(A.cp) - winPct(B.cp);
  const pawns = (A.cp - B.cp) / 100;
  const equal = gap < 3 && Math.abs(A.cp - B.cp) < 35;
  const reasons: string[] = [];

  // 1. Where each line ends up: mate / material.
  const lineA = A.pv.length ? A.pv : [A.uci], lineB = B.pv.length ? B.pv : [B.uci];
  const stA = settle(fen, lineA), stB = settle(fen, lineB);
  const resA = lineResult(fen, lineA, stA), resB = lineResult(fen, lineB, stB);
  if (resB.includes('get checkmated')) reasons.push(`After ${B.san} you get checkmated by force; ${A.san} avoids it.`);
  else if (resA.includes('checkmate them') && !resB.includes('checkmate them')) reasons.push(`${A.san} leads to a forced checkmate; ${B.san} does not.`);
  else if (Math.round(stA.delta) !== Math.round(stB.delta)) {
    if (stA.delta > stB.delta) reasons.push(`Material: after ${A.san} ${resA}; after ${B.san} ${resB}.`);
    else if (!equal) reasons.push(`${B.san} grabs more material in the short run (${resB}${stA.delta !== 0 ? `, against: ${resA} after ${A.san}` : ''}), but it does not pay off: Stockfish counts the rest of the position as more important here.`);
  }

  // 2. The opponent's best answer to the worse move, if it does something concrete.
  const fB1 = after(fen, [B.uci]).fen();
  const replyB = lineB[1];
  if (replyB) {
    const mot = detectMotifs(fB1, replyB).find((m) => m.kind !== 'check');
    if (mot) reasons.push(`After ${B.san} they answer ${sanOf(fB1, replyB)}: ${mot.text}.`);
  }

  // 3. Board facts right after each move (and after the reply, so recaptures settle).
  const cA = after(fen, lineA.slice(0, 2)), cB = after(fen, lineB.slice(0, 2));
  const a = facts(cA, me), b = facts(cB, me);
  const a1 = facts(after(fen, [A.uci]), me), b1 = facts(after(fen, [B.uci]), me);
  const struct: string[] = [];
  if (b1.doubled > a1.doubled) struct.push(`${B.san} gives you doubled pawns`);
  else if (a1.doubled > b1.doubled) struct.push(`${A.san} does double your pawns, but that matters less than the rest`);
  if (b1.isolated > a1.isolated) struct.push(`${B.san} leaves you with ${b1.isolated - a1.isolated === 1 ? 'an isolated pawn' : 'isolated pawns'} (no pawn beside it to protect it)`);
  if (a1.oppDoubled > b1.oppDoubled || a1.oppIsolated > b1.oppIsolated) struct.push(`${A.san} damages their pawns`);
  if (a1.passed > b1.passed) struct.push(`${A.san} gives you a passed pawn`);
  if (b1.oppPassed > a1.oppPassed) struct.push(`${B.san} gives them a passed pawn`);
  if (struct.length) reasons.push(capSafe(struct.join('; ')) + '.');

  const king: string[] = [];
  if (a1.castle && !b1.castle) king.push(`${B.san} gives up your right to castle`);
  const kA = after(fen, [A.uci]).board().flat().find((p) => p?.type === 'k' && p.color === me)?.square;
  const kB = after(fen, [B.uci]).board().flat().find((p) => p?.type === 'k' && p.color === me)?.square;
  if (kA && kA === kB && b1.shield < a1.shield) king.push(`${B.san} weakens the pawns in front of your king`);
  if (king.length) reasons.push(capSafe(king.join(', and ')) + '.');

  if (b.loose.length && b.loose.length > a.loose.length) {
    const p = b.loose[0];
    reasons.push(`After ${B.san}${lineB[1] ? ` ${sanOf(fB1, lineB[1])}` : ''}, your ${PIECE_NAME[p.type as keyof typeof PIECE_NAME]} on ${p.square} is loose: they can win it.`);
  }
  if (b1.undeveloped > a1.undeveloped && a1.undeveloped < 4) reasons.push(`${A.san} develops a piece; ${B.san} leaves one more at home.`);
  if (a1.bishops === 2 && b1.bishops < 2 && b1.oppBishops >= a1.oppBishops) reasons.push(`${A.san} keeps your two bishops (the bishop pair is strong in open positions).`);
  if (a.center - b.center >= 2) reasons.push(`${A.san} keeps more control of the centre (d4, e4, d5, e5).`);
  if (a.mobility - b.mobility >= 6) reasons.push(`Your pieces have more room after ${A.san} (${a.mobility} moves vs ${b.mobility}).`);

  // 4. What the better move does.
  const motA = detectMotifs(fen, A.uci).find((m) => m.kind !== 'check');
  const motB = new Set(detectMotifs(fen, B.uci).map((m) => m.kind));
  if (motA && !motB.has(motA.kind)) reasons.unshift(`${A.san}: ${motA.text}.`);

  // 5. Strategy in words: outposts, open files, threats, prophylaxis, the plan.
  let strat: string[] = [];
  try { strat = strategicReasons(fen, { uci: A.uci, san: A.san, pv: lineA }, { uci: B.uci, san: B.san, pv: lineB }); } catch { strat = []; }
  for (const r of strat) if (!reasons.includes(r)) reasons.push(r);

  if (!reasons.length) {
    if (equal) reasons.push(`Both lead to similar positions; neither changes the material or the pawns, so pick the one whose plan you understand.`);
    else {
      const plan = (() => { try { return planOf(fen, lineA); } catch { return null; } })();
      reasons.push(plan
        ? `${plan.text} ${plan.ideas[0].text}`
        : `Nothing is lost right away. The difference is the follow-up: after ${A.san} (${shortLine(fen, lineA)}) your pieces keep the initiative, while after ${B.san} (${shortLine(fen, lineB)}) they get time to organise. When two moves look similar, prefer the one that makes a threat or improves your worst piece.`);
    }
  }

  const evalA = formatScore(me === 'w' ? A.cp : -A.cp), evalB = formatScore(me === 'w' ? B.cp : -B.cp);
  const summary = equal
    ? `${A.san} and ${B.san} are about equally good (${evalA} vs ${evalB}).`
    : `${A.san} is better than ${B.san}: with ${A.san} ${feel(A.cp)} (${evalA}), with ${B.san} ${feel(B.cp)} (${evalB})${Math.abs(pawns) >= 0.3 && Math.abs(A.cp) < 9000 && Math.abs(B.cp) < 9000 ? `, a difference of about ${Math.abs(pawns).toFixed(1)} pawn${Math.abs(pawns) >= 1.5 ? 's' : ''}` : ''}.`;
  return { fen, better: A, worse: B, equal, summary, reasons: reasons.slice(0, 6), betterResult: resA, worseResult: resB };
}

function shortLine(fen: string, ucis: string[]) {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of ucis.slice(0, 4)) { const m = tryMove(c, u); if (!m) break; out.push(m.san); }
  return out.join(' ');
}

/** Engine lines for specific moves at the same depth (searchmoves), mover's view. */
export async function analyzeCandidates(engine: UciEngine, fen: string, ucis: string[], depth = 14): Promise<Candidate[]> {
  const uniq = [...new Set(ucis)];
  const r = await engine.analyze(fen, { depth, multipv: uniq.length, searchmoves: uniq });
  return uniq.map((u) => {
    const l = r.lines.find((x) => x.pv[0] === u);
    return { uci: u, san: sanOf(fen, u), cp: l ? scoreOf(l) : -99999, pv: l?.pv ?? [u] };
  }).filter((c) => c.cp > -99999);
}

/** Moves that capture on the same square as another legal move: "you can take back two ways". */
export function alternativeCaptures(fen: string): { square: Square; ucis: string[]; sans: string[] }[] {
  const c = new Chess(fen);
  const by = new Map<Square, { ucis: string[]; sans: string[] }>();
  for (const m of c.moves({ verbose: true })) {
    if (!m.captured) continue;
    const e = by.get(m.to) ?? { ucis: [], sans: [] };
    if (!e.ucis.includes(m.lan)) { e.ucis.push(m.lan); e.sans.push(m.san); }
    by.set(m.to, e);
  }
  return [...by.entries()].filter(([, v]) => v.ucis.length >= 2).map(([square, v]) => ({ square, ...v }))
    .sort((p, q) => VAL[c.get(q.square)!.type] - VAL[c.get(p.square)!.type]);
}

// Sentences here start with a move in SAN (bxc6 vs Bxc6 are different moves): never change their case.
const capSafe = (s: string) => s;
