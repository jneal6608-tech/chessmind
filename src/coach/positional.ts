// Strategy in words. Stockfish says WHICH move is better; this module says WHY
// in the terms a coach would use: outposts, open files, bad bishops, space,
// pawn breaks, prophylaxis (stopping their idea), king safety and the plan the
// engine line is following. Every sentence is a fact read off the board, never
// a guess: if no idea is found, nothing is said.
import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js';
import { PIECE_NAME, VAL, tryMove, pieces, fileOf, rankOf, sqOf, onBoard, opp, findKing, pawnInfo, sanOf } from '../chess/util';
import { moveGain } from '../chess/tactics';

export interface Idea {
  key: string;
  /** Short label used in plan summaries: "outpost", "open file". */
  short: string;
  /** Full sentence, with the reason it matters. */
  text: string;
  weight: number;
}

const forward = (c: Color) => (c === 'w' ? 1 : -1);
const relRank = (sq: Square, c: Color) => (c === 'w' ? rankOf(sq) : 7 - rankOf(sq)); // 0 = own back rank
const light = (sq: Square) => (fileOf(sq) + rankOf(sq)) % 2 === 1;

function flip(c: Chess, side: Color): Chess | null {
  const p = c.fen().split(' ');
  if (p[1] === side) return c;
  p[1] = side; p[3] = '-';
  try { return new Chess(p.join(' ')); } catch { return null; }
}
/** Squares a piece reaches from `sq` (as if it were its side's turn). */
export function mobilityOf(c: Chess, sq: Square): number {
  const p = c.get(sq);
  if (!p) return 0;
  const f = flip(c, p.color);
  if (!f) return 0;
  try { return f.moves({ square: sq, verbose: true }).length; } catch { return 0; }
}

/** A knight or bishop square in the enemy half that no enemy pawn can ever attack, supported by a pawn. */
export function isOutpost(c: Chess, sq: Square, color: Color): boolean {
  const rr = relRank(sq, color);
  if (rr < 3 || rr > 5) return false;
  const f = fileOf(sq), r = rankOf(sq), d = forward(color);
  const supported = [-1, 1].some((df) => onBoard(f + df, r - d) && (() => { const q = c.get(sqOf(f + df, r - d)); return q?.type === 'p' && q.color === color; })());
  if (!supported) return false;
  for (const df of [-1, 1]) {
    if (!onBoard(f + df, 0)) continue;
    for (let rr2 = 0; rr2 < 8; rr2++) {
      const q = c.get(sqOf(f + df, rr2));
      if (q?.type === 'p' && q.color !== color && (color === 'w' ? rr2 > r : rr2 < r)) return false;
    }
  }
  return true;
}
function fileState(c: Chess, file: number, color: Color): 'open' | 'semi' | 'closed' {
  let mine = false, theirs = false;
  for (let r = 0; r < 8; r++) { const q = c.get(sqOf(file, r)); if (q?.type === 'p') { if (q.color === color) mine = true; else theirs = true; } }
  return !mine && !theirs ? 'open' : !mine ? 'semi' : 'closed';
}
/** Own pawns standing on the bishop's colour (blocking it). */
function pawnsOnColour(c: Chess, sq: Square, color: Color) {
  const lt = light(sq);
  return pieces(c, color).filter((p) => p.type === 'p' && light(p.square) === lt).length;
}
/** Enemy pieces hitting the squares around a king. */
export function kingPressure(c: Chess, color: Color): number {
  const k = findKing(c, color);
  const them = opp(color);
  let n = 0;
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    const f = fileOf(k) + df, r = rankOf(k) + dr;
    if (!onBoard(f, r)) continue;
    n += c.attackers(sqOf(f, r), them).length;
  }
  return n;
}
/** Pawn-controlled squares in the opponent's half: a simple measure of space. */
export function space(c: Chess, color: Color): number {
  const set = new Set<string>();
  for (const p of pieces(c, color)) {
    if (p.type !== 'p') continue;
    const f = fileOf(p.square), r = rankOf(p.square) + forward(color);
    for (const df of [-1, 1]) if (onBoard(f + df, r) && relRank(sqOf(f + df, r), color) >= 4) set.add(sqOf(f + df, r));
  }
  return set.size;
}
/** The opponent's best material threat if it were their move (captures and checks only). */
export function biggestThreat(fen: string, by: Color): { uci: string; san: string; gain: number } | null {
  const c = new Chess(fen);
  const f = flip(c, by);
  if (!f || f.isGameOver()) return null;
  // A side not to move can't be in check from the side that is: skip illegal flips.
  if (c.turn() !== by && c.isCheck()) return null;
  const ff = f.fen();
  let best: { uci: string; san: string; gain: number } | null = null;
  for (const m of f.moves({ verbose: true })) {
    if (!m.captured && !m.san.includes('+')) continue;
    const g = moveGain(ff, m.lan);
    if (g >= 1 && (!best || g > best.gain)) best = { uci: m.lan, san: m.san, gain: g };
  }
  return best;
}
function worth(g: number) {
  return g >= 900 ? 'checkmate' : g >= 9 ? 'the queen' : g >= 5 ? 'a rook' : g >= 3 ? 'a piece' : g >= 2 ? 'two pawns' : 'a pawn';
}

/** What a single move is trying to do, strategically. Side to move at `fen` plays `uci`. */
export function moveIdeas(fen: string, uci: string): Idea[] {
  const before = new Chess(fen);
  const c = new Chess(fen);
  const mv = tryMove(c, uci);
  if (!mv) return [];
  const me = mv.color, them = opp(me);
  const out: Idea[] = [];
  const name = PIECE_NAME[mv.piece];
  const add = (key: string, short: string, text: string, weight: number) => out.push({ key, short, text, weight });

  // Stops their threat (prophylaxis / defence)
  const threatBefore = biggestThreat(fen, them);
  if (threatBefore && !c.isCheckmate()) {
    const still = c.isGameOver() ? null : (() => { const r = c.moves({ verbose: true }).find((x) => x.lan === threatBefore.uci); return r ? moveGain(c.fen(), r.lan) : null; })();
    if (still === null || still < 1) add('stops_threat', `stops ${threatBefore.san}`, `${mv.san} deals with their threat: they were ready to play ${threatBefore.san}, winning ${worth(threatBefore.gain)}.`, 6);
  }
  // Creates a threat of its own (tempo)
  if (!c.isGameOver() && !c.isCheck()) {
    const t = biggestThreat(c.fen(), me);
    const tBefore = biggestThreat(fen, me);
    if (t && (!tBefore || t.gain > tBefore.gain || t.uci !== tBefore.uci) && t.gain >= 1)
      add('threat', `threatens ${t.san}`, `${mv.san} makes a threat: next it wants ${t.san}, winning ${worth(t.gain)}, so they have to spend their move answering it. That is how you keep the initiative.`, 5);
  }
  if (mv.san.startsWith('O-O')) add('castle', 'castles', `${mv.san} gets the king to safety and brings a rook toward the centre. Until you castle, central files can open against your king.`, 4);
  const home = me === 'w' ? '1' : '8';
  if ((mv.piece === 'n' || mv.piece === 'b') && mv.from[1] === home)
    add('develop', 'develops', `${mv.san} develops a piece. In the opening every move that brings a new piece into play counts; the side with more pieces out usually wins the first fight.`, 3);
  if ((mv.piece === 'n' || mv.piece === 'b') && isOutpost(c, mv.to, me))
    add('outpost', `outpost on ${mv.to}`, `${mv.san} puts the ${name} on an outpost: ${mv.to} is supported by a pawn and no enemy pawn can ever chase it away, so the ${name} stays strong for the rest of the game.`, 5);
  if (mv.piece === 'r') {
    const fs = fileState(c, fileOf(mv.to), me), fsFrom = fileState(before, fileOf(mv.from), me);
    if (fileOf(mv.to) !== fileOf(mv.from) && fs !== 'closed' && fsFrom === 'closed')
      add('open_file', `rook to the ${fs === 'open' ? 'open' : 'half-open'} ${'abcdefgh'[fileOf(mv.to)]}-file`, `${mv.san} puts the rook on the ${fs === 'open' ? 'open' : 'half-open'} ${'abcdefgh'[fileOf(mv.to)]}-file. Rooks need open lines; behind your own pawns they do nothing.`, 4);
    if (relRank(mv.to, me) === 6 && relRank(mv.from, me) !== 6)
      add('seventh', 'rook to the 7th', `${mv.san} lands on the 7th rank, where the rook attacks pawns from the side and traps the king on the back rank.`, 5);
  }
  // Improves a bad piece / centralises
  if (mv.piece !== 'k' && mv.piece !== 'p') {
    const m0 = mobilityOf(before, mv.from), m1 = mobilityOf(c, mv.to);
    if (m1 - m0 >= 4 && !out.some((x) => x.key === 'develop'))
      add('activate', `activates the ${name}`, `${mv.san} improves the ${name}: it goes from ${m0} squares to ${m1}. "Improve your worst piece" is one of the best plans when nothing is happening.`, 3);
    // Trading a bishop hemmed in by its own pawns for a real piece.
    if (mv.piece === 'b' && (mv.captured === 'n' || mv.captured === 'b') && pawnsOnColour(before, mv.from, me) >= 5)
      add('trade_bad_bishop', 'trades the bad bishop', `${mv.san} trades off your bad bishop (most of your pawns stand on its colour and block it) for one of their active pieces.`, 4);
  }
  if (mv.piece === 'p') {
    // Pawn break: the pawn now touches an enemy pawn (or attacks one).
    const f = fileOf(mv.to), r = rankOf(mv.to), d = forward(me);
    const contact = [-1, 1].some((df) => onBoard(f + df, r + d) && (() => { const q = c.get(sqOf(f + df, r + d)); return q?.type === 'p' && q.color === them; })());
    if (contact && !mv.captured) add('break', `the pawn break ${mv.san}`, `${mv.san} is a pawn break: it challenges their pawn chain and opens lines for your pieces. Breaks are how you change a locked position in your favour.`, 4);
    const s0 = space(before, me), s1 = space(c, me);
    if (s1 > s0 && !contact && 'cdef'.includes(mv.to[0])) add('space', 'gains space', `${mv.san} gains space: your pawns now control more squares in their half, so their pieces have less room and yours have more.`, 2);
    const p0 = pawnInfo(before, me).passed.length, p1 = pawnInfo(c, me).passed.length;
    if (p1 > p0) add('passer', 'creates a passed pawn', `${mv.san} creates a passed pawn: nothing can stop it with a pawn, so it ties their pieces down.`, 4);
    // Weakens own king
    const k = findKing(before, me);
    if (Math.abs(fileOf(mv.from) - fileOf(k)) <= 1 && relRank(k, me) === 0 && relRank(mv.from, me) <= 2)
      add('weakens_king', 'loosens the king', `${mv.san} moves a pawn in front of your king. Those pawns cannot move back, so the squares they leave behind stay weak.`, -3);
  }
  // Captures that change the structure
  if (mv.captured && mv.captured !== 'p') {
    const theirB = pieces(before, them).filter((p) => p.type === 'b').length;
    if (mv.captured === 'b' && theirB === 2) add('bishop_pair', 'takes their bishop pair', `${mv.san} takes away their bishop pair. Two bishops together control both colours and get stronger as the board opens.`, 3);
  }
  // Pressure on the king
  const kp0 = kingPressure(before, them), kp1 = c.isGameOver() ? kp0 : kingPressure(c, them);
  if (kp1 - kp0 >= 2) add('king_attack', 'joins the attack', `${mv.san} brings another piece into the attack: ${kp1} of your attacks now hit the squares around their king.`, 3);
  return out.sort((a, b) => b.weight - a.weight);
}

/** "Stockfish's plan: first Nd5 (outpost on d5), then Rc1 (rook to the half-open c-file)." */
export function planOf(fen: string, pv: string[], maxMoves = 3): { text: string; ideas: Idea[] } | null {
  const c = new Chess(fen);
  const me = c.turn();
  const steps: string[] = [];
  const all: Idea[] = [];
  for (let i = 0; i < Math.min(pv.length, maxMoves * 2); i++) {
    const f = c.fen();
    const m = tryMove(c, pv[i]);
    if (!m) break;
    if (m.color !== me) continue;
    const ids = moveIdeas(f, pv[i]).filter((x) => x.weight > 0);
    if (ids[0]) { steps.push(`${m.san} (${ids[0].short})`); all.push(ids[0]); }
    else steps.push(m.san);
  }
  if (!all.length) return null;
  const text = steps.length === 1 ? `The idea: ${steps[0]}.` : `The plan: ${steps.slice(0, -1).join(', ')}, then ${steps[steps.length - 1]}.`;
  return { text, ideas: all };
}

/**
 * Strategic reasons why move A is better than move B (both from `fen`), in
 * words. Only reasons that separate the two moves are returned.
 */
export function strategicReasons(fen: string, a: { uci: string; san: string; pv: string[] }, b: { uci: string; san: string; pv: string[] }): string[] {
  const ia = moveIdeas(fen, a.uci), ib = moveIdeas(fen, b.uci);
  const keysB = new Set(ib.map((x) => x.key));
  const keysA = new Set(ia.map((x) => x.key));
  const out: string[] = [];
  // What A achieves that B does not
  for (const x of ia) if (x.weight > 0 && !keysB.has(x.key)) out.push(x.text + (x.key === 'stops_threat' ? ` ${b.san} doesn't stop it.` : ''));
  // What B does wrong that A avoids
  for (const x of ib) if (x.weight < 0 && !keysA.has(x.key)) out.push(x.text);
  // Their reply to B: does it create something A did not allow?
  const cb = new Chess(fen); tryMove(cb, b.uci);
  const reply = b.pv[1];
  if (reply && !cb.isGameOver()) {
    const ri = moveIdeas(cb.fen(), reply).filter((x) => x.weight >= 4 && x.key !== 'stops_threat');
    if (ri[0]) out.push(`After ${b.san} they get to play ${sanOf(cb.fen(), reply)}: ${ri[0].text.replace(/^\S+ /, 'it ')}`);
  }
  const plan = planOf(fen, a.pv);
  if (plan && !out.length) out.push(`${plan.text} ${plan.ideas[0].text}`);
  else if (plan && plan.ideas.length > 1) out.push(plan.text);
  return out.slice(0, 4);
}

export const PIECE_VAL = VAL as Record<PieceSymbol, number>;
