// Why each opening move is played, in words. Combines the course's hand-written
// note (opening-specific knowledge) with ideas read off the board: development,
// centre control, castling, squares taken away from the opponent (prophylaxis),
// pieces attacked, lines opened, pawn breaks. Also gives a "clue" for each move
// (the idea without the move) for the guided Learn mode.
import { Chess, type Square } from 'chess.js';
import { PIECE_NAME, tryMove, attackedPieces, fileOf, rankOf, sqOf, onBoard, opp } from '../chess/util';
import { moveIdeas, mobilityOf } from '../coach/positional';

export interface MoveTeaching {
  san: string;
  /** Full explanation: what the move does and why. */
  text: string;
  /** The idea without naming the move, for "find the move that..." prompts. */
  clue: string;
  mine: boolean;
}

const CENTRE = new Set(['d4', 'e4', 'd5', 'e5']);
const EXT_CENTRE = new Set(['c4', 'c5', 'f4', 'f5', 'c3', 'c6', 'f3', 'f6', 'd3', 'd6', 'e3', 'e6']);

const CLUE: Record<string, string> = {
  castle: 'Get your king to safety and connect the rooks.',
  develop: 'Bring a new piece into play.',
  outpost: 'Put a piece on a strong square that pawns can\'t attack.',
  open_file: 'Put a rook on an open line.',
  seventh: 'Activate a rook deep in their camp.',
  break: 'Challenge their pawn chain with a pawn.',
  space: 'Gain space in the centre with a pawn.',
  threat: 'Make a threat so they have to react.',
  stops_threat: 'Deal with their threat first.',
  activate: 'Improve one of your pieces.',
  passer: 'Create a passed pawn.',
  bishop_pair: 'Take away their bishop pair.',
  king_attack: 'Bring another piece toward their king.',
  trade_bad_bishop: 'Trade off your bad bishop.',
};

/** Squares a pawn move takes away from enemy minor pieces that could have used them next move. */
function prophylaxis(before: Chess, after: Chess, to: string, me: 'w' | 'b'): string | null {
  const them = opp(me);
  const f = fileOf(to), r = rankOf(to) + (me === 'w' ? 1 : -1);
  for (const df of [-1, 1]) {
    if (!onBoard(f + df, r)) continue;
    const sq = sqOf(f + df, r);
    if (before.get(sq as Square)) continue;
    // An enemy knight or bishop that could have jumped there next move.
    const p = before.fen().split(' '); p[1] = them; p[3] = '-';
    let c: Chess; try { c = new Chess(p.join(' ')); } catch { continue; }
    const users = c.moves({ verbose: true }).filter((m) => m.to === sq && (m.piece === 'n' || m.piece === 'b'));
    if (users.length) {
      const u = users[0];
      const pinTarget = attackedPiecesAfter(c, u.lan).find((x) => x.color === me && (x.type === 'n' || x.type === 'q' || x.type === 'k'));
      return `it takes ${sq} away from their ${PIECE_NAME[u.piece]} on ${u.from}${pinTarget ? ` (from ${sq} it would harass your ${PIECE_NAME[pinTarget.type]} on ${pinTarget.sq})` : ''}`;
    }
  }
  void after;
  return null;
}
function attackedPiecesAfter(c: Chess, uci: string) {
  const x = new Chess(c.fen());
  const m = tryMove(x, uci);
  return m ? attackedPieces(x, m.to) : [];
}

export function teachMove(fenBefore: string, uci: string, myColor: 'w' | 'b', note?: string): MoveTeaching {
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const mv = tryMove(after, uci);
  if (!mv) return { san: uci, text: note ?? '', clue: note ?? '', mine: false };
  const mine = mv.color === myColor;
  const whose = mine ? 'your' : 'their';
  const reasons: string[] = [];
  let clueKey: string | null = null;

  const ideas = (() => { try { return moveIdeas(fenBefore, uci).filter((x) => x.weight > 0); } catch { return []; } })();
  for (const x of ideas.slice(0, 2)) {
    let t = x.text.replace(new RegExp(`^${mv.san.replace(/[+#]/g, '\\$&')} `), '').replace(/^(\w)/, (c) => c.toLowerCase()).replace(/[.]+$/, '');
    // moveIdeas speaks to the mover; for the opponent's moves, flip it to your point of view.
    if (!mine) t = flipPov(t);
    reasons.push(t);
    clueKey ??= x.key;
  }
  if (mv.piece === 'p' && !mv.captured) {
    const ctrl = attackedSquares(after, mv.to);
    const centre = ctrl.filter((s) => CENTRE.has(s));
    if (CENTRE.has(mv.to) || centre.length) {
      reasons.unshift(`it fights for the centre${centre.length ? ` (controls ${centre.join(' and ')})` : ` (occupies ${mv.to})`}`);
      clueKey ??= 'centre';
    } else if (EXT_CENTRE.has(mv.to) && !reasons.length) reasons.push(`it supports the centre`);
    // Opens lines for pieces behind it.
    const opened = (['b', 'q'] as const).flatMap((t) => after.board().flat().filter((p) => p && p.color === mv.color && p.type === t))
      .map((p) => ({ p: p!, gain: mobilityOf(after, p!.square) - mobilityOf(before, p!.square) })).filter((x) => x.gain >= 2).sort((a, b) => b.gain - a.gain)[0];
    if (opened) { reasons.push(`it opens the diagonal for ${whose} ${PIECE_NAME[opened.p.type]} on ${opened.p.square}`); clueKey ??= 'opens'; }
    const pro = prophylaxis(before, after, mv.to, mv.color);
    if (pro) { reasons.push(mine ? pro : flipPov(pro)); clueKey ??= 'prophylaxis'; }
  }
  if (mv.captured) {
    reasons.unshift(`it takes the ${PIECE_NAME[mv.captured]} on ${mv.to}`);
    clueKey ??= 'capture';
  }
  // New attacks on enemy pieces (pawns excluded).
  const newTargets = attackedPieces(after, mv.to).filter((p) => p.color !== mv.color && p.type !== 'p' && !attackedPieces(before, mv.from).some((q) => q.sq === p.sq));
  if (newTargets.length && !mv.captured) {
    reasons.push(`it attacks ${mine ? 'their' : 'your'} ${newTargets.map((t) => `${PIECE_NAME[t.type]} on ${t.sq}`).join(' and ')}`);
    clueKey ??= 'attack';
  }
  if (after.isCheck()) reasons.push('it gives check');
  // Quiet piece moves the detectors above don't name.
  if (!reasons.length && mv.piece === 'r') {
    const own = before.board().flat().find((p) => p && p.color === mv.color && p.type === 'p' && p.square[0] === mv.to[0]);
    reasons.push(own ? `it puts the rook on the ${mv.to[0]}-file behind the ${own.square} pawn: it supports that pawn now and is ready when the file opens` : `it brings the rook to the ${mv.to[0]}-file`);
  }
  if (!reasons.length && (mv.piece === 'b' || mv.piece === 'q') && Math.abs(fileOf(mv.from) - fileOf(mv.to)) === Math.abs(rankOf(mv.from) - rankOf(mv.to))) {
    const back = (mv.color === 'w' ? rankOf(mv.to) < rankOf(mv.from) : rankOf(mv.to) > rankOf(mv.from));
    if (back && mv.piece === 'b') reasons.push(`it steps back along the same diagonal: the bishop keeps its aim but is out of reach of pawn attacks that would gain time`);
  }
  if (!reasons.length && (mv.piece === 'n' || mv.piece === 'b') && mv.from[1] !== (mv.color === 'w' ? '1' : '8')) reasons.push(`it re-routes the ${PIECE_NAME[mv.piece]} to a better square (${mobilityOf(before, mv.from)} → ${mobilityOf(after, mv.to)} squares)`);

  const why = reasons.length ? capFirst(dedupe(reasons).slice(0, 3).join('; ')).replace(/[.]+$/, '') + '.' : '';
  const text = [note, why].filter(Boolean).join(' ');
  const clue = note ? note.replace(/\b[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?/g, (m) => (m === mv.san ? 'this' : m))
    : clueKey && CLUE[clueKey] ? CLUE[clueKey]
    : clueKey === 'centre' ? 'Fight for the centre with a pawn.'
    : clueKey === 'opens' ? 'Open a line for one of your pieces.'
    : clueKey === 'prophylaxis' ? 'Take an important square away from their pieces.'
    : clueKey === 'capture' ? 'Take back / capture.'
    : clueKey === 'attack' ? 'Develop with an attack on one of their pieces.'
    : 'Find the natural move in this structure.';
  return { san: mv.san, text: text || `${mv.san}: a natural developing move.`, clue, mine };
}

function attackedSquares(c: Chess, sq: string): string[] {
  const p = c.get(sq as Square);
  if (!p || p.type !== 'p') return [];
  const f = fileOf(sq), r = rankOf(sq) + (p.color === 'w' ? 1 : -1);
  return [-1, 1].filter((df) => onBoard(f + df, r)).map((df) => sqOf(f + df, r));
}
const dedupe = (xs: string[]) => [...new Set(xs)];
/** Swap the point of view of a sentence written to the mover ("your pieces", "they have to"). */
function flipPov(t: string): string {
  const map: Record<string, string> = { your: 'their', their: 'your', you: 'they', they: 'you', yours: 'theirs', theirs: 'yours', You: 'They', They: 'You', Your: 'Their', Their: 'Your' };
  return t.replace(/\b(your|their|you|they|yours|theirs|You|They|Your|Their)\b/g, (w) => map[w] ?? w);
}
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the final position of a line is about: structure facts plus the course's plans. */
export function lineSummary(fenEnd: string, myColor: 'w' | 'b'): string[] {
  const c = new Chess(fenEnd);
  const out: string[] = [];
  const pawns = (col: 'w' | 'b') => c.board().flat().filter((p) => p && p.type === 'p' && p.color === col).map((p) => p!.square);
  const mine = pawns(myColor), theirs = pawns(opp(myColor));
  const centreMine = mine.filter((s) => CENTRE.has(s)), centreTheirs = theirs.filter((s) => CENTRE.has(s));
  if (centreMine.length || centreTheirs.length) out.push(`Centre: you have ${centreMine.length ? `pawns on ${centreMine.join(', ')}` : 'no pawn in the centre'}; they have ${centreTheirs.length ? centreTheirs.join(', ') : 'none'}.`);
  const castled = (col: 'w' | 'b') => { const k = c.board().flat().find((p) => p && p.type === 'k' && p.color === col)!.square; return ['g1', 'h1', 'c1', 'b1', 'g8', 'h8', 'c8', 'b8'].includes(k) ? (k.startsWith('g') || k.startsWith('h') ? 'castled short' : 'castled long') : 'still in the centre'; };
  out.push(`Kings: yours is ${castled(myColor)}, theirs is ${castled(opp(myColor))}.`);
  const home = myColor === 'w' ? '1' : '8';
  const undeveloped = c.board().flat().filter((p) => p && p.color === myColor && (p.type === 'n' || p.type === 'b') && p.square[1] === home).map((p) => `${PIECE_NAME[p!.type]} on ${p!.square}`);
  out.push(undeveloped.length ? `Still to develop: ${undeveloped.join(', ')}.` : 'All your minor pieces are developed.');
  return out;
}
