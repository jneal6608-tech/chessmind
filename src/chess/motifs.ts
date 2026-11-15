// Tactical pattern recognition for a single move: what does this move *do*?
// Used to name the idea behind an engine move (fork, pin, skewer, ...), so
// mistakes are classified by pattern and not only by evaluation.
import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';
import { VAL, PIECE_NAME, attackedPieces, ray, sliderDirs, tryMove, seeMove, see, isDefended, fileOf, rankOf, findKing, opp } from './util';

export type MotifKind =
  | 'mate' | 'back_rank_mate' | 'fork' | 'pin' | 'skewer' | 'discovered'
  | 'capture_hanging' | 'winning_capture' | 'promotion' | 'check' | 'trap_threat';

export interface Motif {
  kind: MotifKind;
  /** Plain-English description with squares, e.g. "the knight on e5 attacks the king and the rook on h8". */
  text: string;
  squares: Square[];
}

const nm = (t: PieceSymbol) => PIECE_NAME[t];
const on = (t: PieceSymbol, s: string) => `${nm(t)} on ${s}`;

/** Patterns created by playing `uci` in `fen`. Empty when the move is illegal or quiet. */
export function detectMotifs(fen: string, uci: string): Motif[] {
  const before = new Chess(fen);
  const c = new Chess(fen);
  const mv = tryMove(c, uci);
  if (!mv) return [];
  const out: Motif[] = [];
  const me: Color = mv.color, them = opp(me);
  const moved = c.get(mv.to)!;

  if (c.isCheckmate()) {
    const k = findKing(c, them);
    const backRank = rankOf(k) === (them === 'w' ? 0 : 7) && (moved.type === 'r' || moved.type === 'q') && rankOf(mv.to) === rankOf(k);
    out.push({
      kind: backRank ? 'back_rank_mate' : 'mate',
      text: backRank ? `checkmate on the back rank: the king on ${k} is boxed in by its own pawns` : `it is checkmate`,
      squares: [mv.to, k],
    });
    return out;
  }

  // Captures
  if (mv.captured) {
    const net = seeMove(fen, uci);
    const wasDefended = isDefended(before, mv.to, them);
    if (!wasDefended && mv.captured !== 'p' || (!wasDefended && net >= 1)) {
      out.push({ kind: 'capture_hanging', text: `it takes the undefended ${on(mv.captured, mv.to)} for free`, squares: [mv.to] });
    } else if (net >= 1) {
      out.push({ kind: 'winning_capture', text: `the capture on ${mv.to} wins material after the exchanges`, squares: [mv.to] });
    }
  }
  if (mv.promotion) out.push({ kind: 'promotion', text: `the pawn promotes to a ${nm(mv.promotion)}`, squares: [mv.to] });

  // Is the moved piece simply lost on its new square? Then "fork"/"pin" claims are not real.
  const loose = see(c.fen(), mv.to) >= VAL[moved.type] && moved.type !== 'p' && !c.isCheck();

  // Fork: the moved piece attacks two or more worthwhile targets.
  if (!loose) {
    const targets = attackedPieces(c, mv.to).filter((t) => t.color === them).filter((t) =>
      t.type === 'k' || VAL[t.type] > VAL[moved.type] || (!isDefended(c, t.sq, them) && t.type !== 'p'));
    if (targets.length >= 2) {
      const names = targets.map((t) => (t.type === 'k' ? 'the king' : `the ${on(t.type, t.sq)}`));
      out.push({
        kind: 'fork',
        text: `the ${on(moved.type, mv.to)} attacks ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} at the same time (a fork)`,
        squares: [mv.to, ...targets.map((t) => t.sq)],
      });
    }
  }

  // Pin / skewer along the lines of the moved piece.
  if (!loose) for (const [df, dr] of sliderDirs(moved.type)) {
    const line = ray(c, mv.to, df, dr);
    if (line.length < 2) continue;
    const [a, b] = line;
    if (a.color !== them || b.color !== them) continue;
    // Only count lines this move created (the same piece did not already hit them from its old square).
    if (a.type === 'k') {
      if (b.type !== 'p' && (!isDefended(c, b.sq, them) || VAL[b.type] > VAL[moved.type])) {
        out.push({ kind: 'skewer', text: `the check forces the king off the line and the ${on(b.type, b.sq)} behind it falls (a skewer)`, squares: [mv.to, a.sq, b.sq] });
      }
    } else if (b.type === 'k' && a.type !== 'p') {
      // An absolute pin always matters: the piece cannot legally move off the line.
      const wins = VAL[a.type] > VAL[moved.type] || !isDefended(c, a.sq, them) || pawnCanHit(c, a.sq, me);
      out.push({ kind: 'pin', text: `the ${on(a.type, a.sq)} is pinned to the king and cannot move away${wins ? ', and it can be won' : ''}`, squares: [mv.to, a.sq, b.sq] });
    } else if (VAL[a.type] > VAL[b.type] && VAL[a.type] > VAL[moved.type] && b.type !== 'p' && (!isDefended(c, b.sq, them) || VAL[b.type] > VAL[moved.type])) {
      out.push({ kind: 'skewer', text: `the ${on(a.type, a.sq)} must move and the ${on(b.type, b.sq)} behind it is lost (a skewer)`, squares: [mv.to, a.sq, b.sq] });
    } else if (VAL[b.type] > VAL[a.type] && a.type !== 'p' && VAL[b.type] > VAL[moved.type] && (VAL[a.type] > VAL[moved.type] || !isDefended(c, a.sq, them))) {
      out.push({ kind: 'pin', text: `the ${on(a.type, a.sq)} is pinned: if it moves, the ${on(b.type, b.sq)} behind it is lost`, squares: [mv.to, a.sq, b.sq] });
    }
  }

  // Discovered attack: moving away opened the line of a friendly bishop, rook or queen.
  for (const p of piecesOf(c, me)) {
    if (p.square === mv.to || !(p.type === 'b' || p.type === 'r' || p.type === 'q')) continue;
    for (const [df, dr] of sliderDirs(p.type)) {
      if (!passesThrough(p.square, mv.from, df, dr)) continue;
      const first = ray(c, p.square, df, dr)[0];
      if (!first || first.color !== them) continue;
      const blockedBefore = ray(before, p.square, df, dr)[0]?.sq === mv.from;
      if (!blockedBefore) continue;
      if (first.type === 'k' || VAL[first.type] > VAL[p.type] || (!isDefended(c, first.sq, them) && first.type !== 'p')) {
        out.push({
          kind: 'discovered',
          text: first.type === 'k'
            ? `moving the ${nm(moved.type)} uncovers a check from the ${on(p.type, p.square)} (a discovered check)`
            : `moving the ${nm(moved.type)} uncovers an attack from the ${on(p.type, p.square)} on the ${on(first.type, first.sq)} (a discovered attack)`,
          squares: [p.square, mv.from, first.sq],
        });
      }
    }
  }

  if (c.isCheck() && !out.some((m) => m.kind === 'fork' || m.kind === 'skewer' || m.kind === 'discovered')) {
    out.push({ kind: 'check', text: 'it gives check, so the reply is forced', squares: [mv.to, findKing(c, them)] });
  }
  return out;
}

function pawnCanHit(c: Chess, s: Square, by: Color) {
  return c.attackers(s, by).some((a) => c.get(a)?.type === 'p');
}
function piecesOf(c: Chess, color: Color) {
  const out: { square: Square; type: PieceSymbol }[] = [];
  for (const row of c.board()) for (const p of row) if (p && p.color === color) out.push(p);
  return out;
}
function passesThrough(from: Square, via: Square, df: number, dr: number) {
  const f = fileOf(via) - fileOf(from), r = rankOf(via) - rankOf(from);
  if (f === 0 && r === 0) return false;
  if (df === 0) return f === 0 && Math.sign(r) === dr;
  if (dr === 0) return r === 0 && Math.sign(f) === df;
  return Math.abs(f) === Math.abs(r) && Math.sign(f) === df && Math.sign(r) === dr;
}

/** Motifs of the first move, or of the follow-up two plies later when the first move is only a forcing set-up. */
export function detectLineMotifs(fen: string, pv: string[]): { motifs: Motif[]; atPly: number } {
  const first = detectMotifs(fen, pv[0]);
  const strong = first.filter((m) => m.kind !== 'check');
  if (strong.length || pv.length < 3) return { motifs: first, atPly: 0 };
  const c = new Chess(fen);
  if (!tryMove(c, pv[0]) || !tryMove(c, pv[1])) return { motifs: first, atPly: 0 };
  const later = detectMotifs(c.fen(), pv[2]).filter((m) => m.kind !== 'check');
  if (later.length) return { motifs: later, atPly: 2 };
  return { motifs: first, atPly: 0 };
}
