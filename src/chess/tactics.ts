// A tiny material-only search, used to check tactical claims before we make
// them. "Fork", "pin", "attacks the knight" are only worth saying when the
// threat survives the opponent's best defence: a defended piece, a capture of
// the attacker, a counter-check. No engine needed: one full reply, then
// captures until the dust settles (quiescence), counting material only.
import { Chess, type Color, type Square } from 'chess.js';
import { VAL, tryMove } from './util';

const MATE = 1000;

function balance(c: Chess, side: Color): number {
  let s = 0;
  for (const row of c.board()) for (const p of row) {
    if (!p || p.type === 'k') continue;
    s += p.color === side ? VAL[p.type] : -VAL[p.type];
  }
  return s;
}

interface Budget { n: number }

/** Quiescence search: captures (and promotions) only; all moves when in check. Side-to-move view. */
function qs(c: Chess, alpha: number, beta: number, depth: number, b: Budget): number {
  b.n++;
  const inCheck = c.isCheck();
  const all = c.moves({ verbose: true });
  if (!all.length) return inCheck ? -MATE : 0;
  const stand = balance(c, c.turn());
  if (!inCheck) {
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
  }
  if (depth <= 0 || b.n > 6000) return inCheck ? stand : alpha;
  const moves = inCheck ? all : all.filter((m) => m.captured || m.promotion);
  moves.sort((x, y) => (VAL[y.captured ?? 'p'] * 10 - VAL[y.piece]) - (VAL[x.captured ?? 'p'] * 10 - VAL[x.piece]));
  let best = inCheck ? -MATE : alpha;
  for (const m of moves) {
    c.move(m);
    const v = -qs(c, -beta, -Math.max(alpha, best), depth - 1, b);
    c.undo();
    if (v > best) best = v;
    if (best >= beta) return best;
  }
  return best;
}

const cache = new Map<string, number>();

/**
 * Material the mover really wins by playing `uci` in `fen`, after the opponent's
 * best reply and all the captures that follow. Positive: wins material; 0: even;
 * negative: loses material. Checkmate counts as +/-1000.
 */
export function moveGain(fen: string, uci: string): number {
  const key = fen + '|' + uci;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = new Chess(fen);
  const me = c.turn();
  const before = balance(c, me);
  if (!tryMove(c, uci)) return 0;
  let value: number;
  const replies = c.moves({ verbose: true });
  if (!replies.length) value = c.isCheck() ? MATE : balance(c, me);
  else {
    const b: Budget = { n: 0 };
    // Opponent picks the reply that is best for them.
    let bestForThem = -Infinity;
    for (const r of replies) {
      c.move(r);
      const v = -qs(c, -Infinity, -bestForThem, 6, b); // from their point of view
      c.undo();
      if (v > bestForThem) bestForThem = v;
    }
    // qs above returns "us" view after their move; negate twice → their view.
    value = -bestForThem;
  }
  const gain = Math.abs(value) >= MATE ? value : value - before;
  if (cache.size > 5000) cache.clear();
  cache.set(key, gain);
  return gain;
}

/** What the side `by` wins by capturing on `sq` right now (static exchange), even if it is not their turn. */
export function threatOn(fen: string, sq: Square, by: Color): number {
  const parts = fen.split(' ');
  if (parts[1] !== by) { parts[1] = by; parts[3] = '-'; }
  let c: Chess;
  try { c = new Chess(parts.join(' ')); } catch { return 0; }
  return seeOn(c, sq, 0);
}
function seeOn(c: Chess, target: Square, d: number): number {
  if (d > 12) return 0;
  const caps = c.moves({ verbose: true }).filter((m) => m.to === target && m.captured);
  if (!caps.length) return 0;
  caps.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
  const m = caps[0];
  const gain = VAL[m.captured!];
  c.move(m);
  const reply = seeOn(c, target, d + 1);
  c.undo();
  return Math.max(0, gain - reply);
}
