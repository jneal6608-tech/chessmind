// Hints that teach instead of pointing. Three levels, each giving away a bit
// more: (1) the IDEA, with the targets marked: "their rook on d7 has no
// defender", "your knight can hit two things at once"; (2) WHICH of your pieces
// does it and why; (3) the move itself as an arrow, with the reason.
import { Chess, type Square } from 'chess.js';
import { PIECE_NAME, tryMove, findKing, opp } from '../chess/util';
import { detectMotifs, type Motif } from '../chess/motifs';

export interface Hint { text: string; highlights: Record<string, 'hl-info' | 'hl-bad' | 'hl-good'>; arrow?: { from: string; to: string } }

const ORDER = ['back_rank_mate', 'mate', 'fork', 'skewer', 'pin', 'discovered', 'promotion', 'capture_hanging', 'winning_capture'];
const piece = (c: Chess, sq: string) => { const p = c.get(sq as Square); return p ? `${PIECE_NAME[p.type]} on ${sq}` : sq; };
const mark = (sqs: string[], tone: 'hl-info' | 'hl-bad' = 'hl-info') => Object.fromEntries(sqs.map((s) => [s, tone]));

/** Hints for finding `uci` in `fen` (side to move = you). */
export function buildHints(fen: string, uci: string): Hint[] {
  const c = new Chess(fen);
  const after = new Chess(fen);
  const mv = tryMove(after, uci);
  if (!mv) return [];
  const me = c.turn(), them = opp(me);
  const motifs = detectMotifs(fen, uci).filter((m) => m.kind !== 'check');
  const main: Motif | undefined = ORDER.map((k) => motifs.find((m) => m.kind === k)).find(Boolean);
  const moving = `${PIECE_NAME[mv.piece]} on ${mv.from}`;
  const legal = c.moves({ verbose: true });
  const checks = legal.filter((m) => m.san.includes('+') || m.san.includes('#')).length;
  const captures = legal.filter((m) => m.captured).length;
  const quiet = !mv.captured && !mv.san.includes('+') && !mv.san.includes('#');

  // ---- level 1: the idea, targets marked
  let idea: Hint;
  if (after.isCheckmate() || main?.kind === 'mate' || main?.kind === 'back_rank_mate') {
    const k = findKing(c, them);
    idea = { text: `There is a checkmate. Their king on ${k} has very few free squares${main?.kind === 'back_rank_mate' ? ', and its own pawns box it in on the back rank' : ''}. You have ${checks} check${checks === 1 ? '' : 's'}: try each one and ask where the king can go.`, highlights: mark([k], 'hl-bad') };
  } else if (main?.kind === 'fork') {
    const t = main.squares.slice(1);
    idea = { text: `Double attack: one of your pieces can hit ${t.map((s) => `their ${piece(c, s)}`).join(' and ')} at the same time. They can only save one. Which square attacks both?`, highlights: mark(t, 'hl-bad') };
  } else if (main?.kind === 'pin' || main?.kind === 'skewer') {
    const [a, b] = main.squares.slice(1);
    idea = { text: main.kind === 'pin'
      ? `Look at the line through their ${piece(c, a)} and their ${piece(c, b)}: the front piece is shielding the one behind it. Attack along that line.`
      : `Their ${piece(c, a)} stands in front of their ${piece(c, b)} on one line. Attack the front piece: when it moves, the one behind is exposed.`, highlights: mark([a, b], 'hl-bad') };
  } else if (main?.kind === 'discovered') {
    const [unmasked, , target] = main.squares;
    idea = { text: `Your ${piece(c, unmasked)} is blocked by one of your own pieces. If that piece moves away (ideally with its own threat), your ${PIECE_NAME[c.get(unmasked as Square)?.type ?? 'q']} suddenly hits their ${piece(c, target)}.`, highlights: mark([unmasked, target]) };
  } else if (main?.kind === 'capture_hanging') {
    idea = { text: `Something of theirs isn't defended: their ${piece(c, mv.to)}. Can you take it safely? Check what they can do after you take.`, highlights: mark([mv.to], 'hl-bad') };
  } else if (main?.kind === 'winning_capture') {
    const att = c.attackers(mv.to as Square, me).length, def = c.attackers(mv.to as Square, them).length;
    idea = { text: `Count on ${mv.to}: you attack their ${piece(c, mv.to)} ${att} time${att === 1 ? '' : 's'}, they defend it ${def} time${def === 1 ? '' : 's'}. Start the exchange with your cheapest piece.`, highlights: mark([mv.to], 'hl-bad') };
  } else if (main?.kind === 'promotion') {
    idea = { text: `Your pawn on ${mv.from} is close to queening. What stops it, and can you remove or deflect that piece?`, highlights: mark([mv.from]) };
  } else if (quiet) {
    idea = { text: `No capture or check works here: the best move is quiet. Look for a move that creates a threat they can't meet, or that improves your worst piece. (You have ${checks} check${checks === 1 ? '' : 's'} and ${captures} capture${captures === 1 ? '' : 's'}; rule them out first.)`, highlights: {} };
  } else {
    idea = { text: `List your forcing moves: you have ${checks} check${checks === 1 ? '' : 's'} and ${captures} capture${captures === 1 ? '' : 's'}. One of them works. For each, find their best reply before deciding.`, highlights: {} };
  }

  // ---- level 2: which piece, and why
  const why = main ? main.text.replace(/^it /, 'it ') : mv.captured ? `it captures on ${mv.to}` : mv.san.includes('+') ? 'it gives check' : 'it creates a threat';
  // Keep the destination hidden unless the first hint already pointed at it.
  const shown = mv.to in idea.highlights;
  const pieceHint: Hint = { text: `The piece to move is your ${moving}. The reason: ${shown ? why : why.replace(new RegExp(`\\bon ${mv.to}\\b|\\b${mv.to}\\b`, 'g'), '').replace(/\s+/g, ' ').trim()}.`, highlights: { ...idea.highlights, [mv.from]: 'hl-good' } };

  // ---- level 3: the move
  const moveHint: Hint = { text: `Play ${mv.san}: ${main ? main.text : why}.`, highlights: {}, arrow: { from: mv.from, to: mv.to } };
  return [idea, pieceHint, moveHint];
}
