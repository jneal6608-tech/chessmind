// Turns engine output into teaching: what each move does in plain words, how
// the material ends up, and why a move works or fails. Nothing here invents
// evaluations: every verdict comes from Stockfish lines.
import { Chess, type Color, type Square, type PieceSymbol } from 'chess.js';
import type { UciEngine } from '../engine/uci';
import { scoreOf, winPct } from '../engine/uci';
import { VAL, PIECE_NAME, tryMove, attackedPieces, isDefended, material, findKing, parseUci, opp, seeMove } from '../chess/util';
import { threatOn } from '../chess/tactics';
import { detectMotifs } from '../chess/motifs';
import type { CoachLevel } from './explain';
import { compareMoves, type Comparison } from './compare';

const whose = (c: Color, me: Color) => (c === me ? 'your' : 'their');
const ref = (t: PieceSymbol, c: Color, sq: string, me: Color) => `${whose(c, me)} ${PIECE_NAME[t]} on ${sq}`;

/** Who defends `sq` for `color`, in words: "the pawn on e6 and the queen on d8". */
function defendersText(c: Chess, sq: Square, color: Color, me: Color): string {
  const ds = c.attackers(sq, color).map((s) => ({ s, p: c.get(s)! })).sort((a, b) => VAL[a.p.type] - VAL[b.p.type]);
  const words = ds.slice(0, 2).map((d) => `${whose(color, me)} ${PIECE_NAME[d.p.type]} on ${d.s}`);
  return words.join(' and ');
}

/** One move in plain words, from `me`'s point of view. */
export function describeMove(fen: string, uci: string, me: Color): string {
  const before = new Chess(fen);
  const c = new Chess(fen);
  const mv = tryMove(c, uci);
  if (!mv) return uci;
  const who = mv.color === me ? 'You' : 'They';
  const mine = mv.color === me;
  const them = opp(mv.color);
  const piece = PIECE_NAME[mv.piece];
  let s: string;
  if (mv.san.startsWith('O-O')) s = `${who} castle ${mv.san === 'O-O' ? 'kingside' : 'queenside'}, tucking the king away and bringing a rook toward the centre`;
  else if (mv.captured) s = `${who} take ${ref(mv.captured, them, mv.to, me)} with ${mine ? 'your' : 'their'} ${piece}`;
  else if (mv.promotion) s = `${who} push the pawn to ${mv.to} and promote it to a ${PIECE_NAME[mv.promotion]}`;
  else s = `${who} move ${mine ? 'your' : 'their'} ${piece} from ${mv.from} to ${mv.to}`;
  if (mv.promotion && mv.captured) s += `, promoting to a ${PIECE_NAME[mv.promotion]}`;
  const extras: string[] = [];
  if (c.isCheckmate()) return `${s}. Checkmate!`;
  if (c.isCheck()) extras.push('giving check');
  // Captures: was the piece defended? Then it is a trade, not a free piece.
  let captureNote = '';
  if (mv.captured && !c.isCheckmate()) {
    const defended = before.attackers(mv.to, them).length > 0;
    const net = seeMove(fen, uci);
    const capV = VAL[mv.captured], pieceV = VAL[mv.piece];
    if (!defended) captureNote = mv.captured === 'p' ? 'The pawn was not defended, so it is a free pawn.' : `The ${PIECE_NAME[mv.captured]} was not defended, so it is free.`;
    else {
      const dtext = defendersText(c, mv.to, them, me);
      const back = mine ? 'they can take back' : 'you can take back';
      if (!dtext) captureNote = '';
      else if (net < 0) captureNote = `But it is defended by ${dtext}, so ${back} and ${mine ? 'you lose' : 'they lose'} material (${PIECE_NAME[mv.piece]} for ${PIECE_NAME[mv.captured] === 'pawn' ? 'a pawn' : PIECE_NAME[mv.captured]}).`;
      else if (net === 0 || capV === pieceV) captureNote = `It is defended by ${dtext}, so ${back}: this is a trade, not a free piece.`;
      else if (capV > pieceV) captureNote = `It is defended by ${dtext}, but the ${PIECE_NAME[mv.captured]} is worth more than the ${PIECE_NAME[mv.piece]}, so ${mine ? 'you' : 'they'} still come out ahead.`;
      else captureNote = `It is defended by ${dtext}, but ${mine ? 'you' : 'they'} still win material after the exchanges.`;
    }
  }
  // New targets of the moved piece: only real threats (they would win material
  // by taking, even counting the defenders), not pieces that are protected.
  const fenNow = c.fen();
  const movedLoose = mv.piece !== 'k' && mv.piece !== 'p' && !c.isCheck() && threatOn(fenNow, mv.to, them) > 0;
  const prev = new Set(attackedPieces(before, mv.from).map((p) => p.sq));
  const targets = movedLoose ? [] : attackedPieces(c, mv.to)
    .filter((p) => p.color !== mv.color && p.type !== 'k' && !prev.has(p.sq))
    .filter((p) => threatOn(fenNow, p.sq, mv.color) > 0);
  if (targets.length) extras.push(`attacking ${targets.map((p) => ref(p.type, p.color, p.sq, me)).join(' and ')}${targets.every((p) => !isDefended(c, p.sq, p.color)) ? ' (not defended)' : ''}`);
  else if (!movedLoose) {
    // Piling up: the moved piece joins an attack that now wins the target.
    const pile = attackedPieces(c, mv.to).filter((p) => p.color !== mv.color && p.type !== 'k' && !prev.has(p.sq))
      .map((p) => ({ p, a: c.attackers(p.sq as Square, mv.color).length, d: c.attackers(p.sq as Square, p.color).length }))
      .find((x) => x.a >= 2 && x.a > x.d && threatOn(fenNow, x.p.sq, mv.color) > 0);
    if (pile) extras.push(`ganging up on ${ref(pile.p.type, pile.p.color, pile.p.sq, me)} (attacked ${pile.a} times, defended ${pile.d === 0 ? 'not at all' : pile.d === 1 ? 'once' : pile.d + ' times'})`);
  }
  // Development
  const home = mv.color === 'w' ? '1' : '8';
  if ((mv.piece === 'n' || mv.piece === 'b') && mv.from[1] === home && !mv.captured) extras.push('getting a piece into the game');
  if (mv.piece === 'p' && !mv.captured && 'de'.includes(mv.to[0]) && ['4', '5'].includes(mv.to[1])) extras.push('grabbing space in the centre');
  // The best pattern, if any (fork, pin, ...): detectMotifs only reports ones that really win something.
  const motif = detectMotifs(fen, uci).find((m) => ['fork', 'pin', 'skewer', 'discovered'].includes(m.kind));
  let out = s + (extras.length ? `, ${extras.join(', ')}` : '') + '.';
  if (captureNote) out += ` ${captureNote}`;
  if (motif) out += ` ${cap(motif.text)}.`;
  else if (movedLoose && !mv.captured) {
    const att = c.attackers(mv.to, them).map((x) => ({ x, p: c.get(x)! })).sort((a, b) => VAL[a.p.type] - VAL[b.p.type])[0];
    if (att) out += ` Careful: the ${PIECE_NAME[mv.piece]} on ${mv.to} can be taken by ${whose(them, me)} ${PIECE_NAME[att.p.type]} on ${att.x}${isDefended(c, mv.to, mv.color) ? ' and the recapture does not make up for it' : ' and nothing defends it'}.`;
  }
  return out;
}

export interface Step { uci: string; san: string; text: string; fenAfter: string }
/** Narrate a line move by move. */
export function narrate(fen: string, ucis: string[], me: Color, max = 6): Step[] {
  const c = new Chess(fen);
  const out: Step[] = [];
  for (const u of ucis.slice(0, max)) {
    const f = c.fen();
    const m = tryMove(c, u);
    if (!m) break;
    out.push({ uci: u, san: m.san, text: describeMove(f, u, me), fenAfter: c.fen() });
  }
  return out;
}

/** Where the material dust settles along a line: stop after captures are over. */
export function settle(fen: string, ucis: string[], maxPly = 8): { plies: number; delta: number; lost: PieceSymbol[]; won: PieceSymbol[] } {
  const c = new Chess(fen);
  const me = c.turn();
  const bal = () => { const m = material(c); return me === 'w' ? m.w - m.b : m.b - m.w; };
  const start = bal();
  let plies = 0;
  const lost: PieceSymbol[] = [], won: PieceSymbol[] = [];
  let lastTo: Square | null = null, lastCapture = false;
  // Past maxPly, keep going only while the captures continue (never stop between a capture and its recapture).
  for (let i = 0; i < Math.min(maxPly + 6, ucis.length); i++) {
    const m = tryMove(c, ucis[i]);
    if (!m) break;
    plies = i + 1;
    lastTo = m.to; lastCapture = !!m.captured;
    if (m.captured) (m.color === me ? won : lost).push(m.captured);
    if (m.promotion) (m.color === me ? won : lost).push(m.promotion); // a new queen counts as material gained
    const next = ucis[i + 1];
    const nextCaptures = next ? !!new Chess(c.fen()).moves({ verbose: true }).find((x) => x.lan === next)?.captured : false;
    if (c.isCheckmate()) break;
    if (i >= 1 && !m.captured && !nextCaptures && !c.isCheck()) break;
    if (i >= maxPly - 1 && !nextCaptures) break;
  }
  // The line stopped right after a capture (a short puzzle solution, say). If the
  // piece can simply be taken back, the exchange is not over: finish it on that
  // square, cheapest attacker first, as long as recapturing actually wins material (an optional even trade is not played).
  if (lastCapture && lastTo && plies === ucis.length && !c.isGameOver()) finishExchange(c, lastTo, me, won, lost);
  return { plies, delta: bal() - start, lost, won };
}

function finishExchange(c: Chess, sq: Square, me: Color, won: PieceSymbol[], lost: PieceSymbol[]) {
  for (let k = 0; k < 6 && !c.isGameOver(); k++) {
    const caps = c.moves({ verbose: true }).filter((x) => x.to === sq && x.captured)
      .sort((a, b) => VAL[a.piece] - VAL[b.piece]);
    const best = caps.find((x) => seeMove(c.fen(), x.lan) > 0);
    if (!best) return;
    c.move(best);
    (best.color === me ? won : lost).push(best.captured!);
  }
}

const NAMES: Record<string, [string, string]> = { p: ['a pawn', 'pawns'], n: ['a knight', 'knights'], b: ['a bishop', 'bishops'], r: ['a rook', 'rooks'], q: ['a queen', 'queens'], k: ['the king', 'kings'] };
function listPieces(ps: PieceSymbol[], own: 'your' | 'their' | ''): string {
  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  const parts: string[] = [];
  for (const t of order) {
    const n = ps.filter((x) => x === t).length;
    if (!n) continue;
    parts.push(n === 1 ? (own ? `${own} ${PIECE_NAME[t]}` : NAMES[t][0]) : `${n} ${NAMES[t][1]}`);
  }
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "you win a knight", "you give up your queen for a knight"-style summary (side to move = you). */
export function tradeWords(st: { delta: number; lost: PieceSymbol[]; won: PieceSymbol[] }): string {
  // Cancel out like-for-like trades
  const lost = [...st.lost], won = [...st.won];
  for (const t of [...lost]) { const j = won.indexOf(t); if (j >= 0) { won.splice(j, 1); lost.splice(lost.indexOf(t), 1); } }
  if (!lost.length && !won.length) return 'material stays even';
  if (!lost.length) return `you win ${listPieces(won, '')}`;
  if (!won.length) return `you lose ${listPieces(lost, 'your')}`;
  const d = Math.round(st.delta);
  const net = d === 0 ? 'an even trade' : d > 0 ? `you come out ${d} point${d === 1 ? '' : 's'} ahead` : `you end up ${-d} point${d === -1 ? '' : 's'} down`;
  return `you give up ${listPieces(lost, 'your')} for ${listPieces(won, '')} (${net})`;
}

/** Summary from points only (when the pieces are not known). */
export function materialWords(delta: number, who: 'you' | 'they' = 'you'): string {
  const d = Math.round(delta);
  if (d === 0) return 'material stays even';
  const n = Math.abs(d);
  const thing = n === 1 ? 'a pawn' : n === 2 ? 'two pawns' : n === 3 ? 'a piece (3 points)' : n === 5 ? 'a rook (5 points)' : n === 9 ? 'a queen (9 points)' : `${n} points of material`;
  if (who === 'you') return d > 0 ? `you come out ${thing} ahead` : `you lose ${thing}`;
  return d > 0 ? `they come out ${thing} ahead` : `they lose ${thing}`;
}

/** How the position feels, in words (side `me`). */
export function feel(cpForMe: number): string {
  if (cpForMe >= 9000) return 'you have a forced checkmate';
  if (cpForMe <= -9000) return 'you get checkmated';
  if (cpForMe >= 300) return 'you are winning';
  if (cpForMe >= 120) return 'you are clearly better';
  if (cpForMe >= 40) return 'you are a bit better';
  if (cpForMe > -40) return 'it is about equal';
  if (cpForMe > -120) return 'you are a bit worse';
  if (cpForMe > -300) return 'you are clearly worse';
  return 'you are losing';
}

export interface Verdict {
  ok: boolean;
  /** One-sentence answer. */
  headline: string;
  /** The story of what happens after the move. */
  story: Step[];
  /** Material summary of the story. */
  result: string;
  /** Why it fails / why it works, in one or two sentences. */
  reason: string;
  /** The better move and its story (when the try was not good enough). */
  better?: { san: string; uci: string; story: Step[]; result: string };
  /** Full line (UCI) after the tried move, for stepping on the board. */
  lineUci: string[];
  /** Why the engine's move is better (or as good), in words. Absent when you found the best move. */
  compare?: Comparison;
}

/**
 * The follow-up loop: "what if I play this?" Plays the move, lets Stockfish
 * answer, and explains the outcome in plain words.
 */
export async function tryIdea(engine: UciEngine, fen: string, uci: string, level: CoachLevel): Promise<Verdict> {
  const c = new Chess(fen);
  const me = c.turn();
  const mv = tryMove(c, uci);
  if (!mv) throw new Error('illegal move');
  const depth = 14;
  const bestR = await engine.analyze(fen, { depth, multipv: 2 });
  const best = bestR.lines[0];
  const bestCp = scoreOf(best);
  const n = level === 'beginner' ? 4 : level === 'intermediate' ? 6 : 8;
  if (c.isCheckmate()) return { ok: true, headline: `${mv.san} is checkmate. Perfect!`, story: [], result: '', reason: '', lineUci: [uci] };
  const after = c.isGameOver() ? null : (await engine.analyze(c.fen(), { depth })).lines[0];
  const myCp = after ? -scoreOf(after) : 0;
  const line = [uci, ...(after?.pv ?? [])];
  const st = settle(fen, line);
  const story = narrate(fen, line, me, Math.min(10, Math.max(n, st.plies)));
  const result = lineResult(fen, line, st);
  const loss = winPct(bestCp) - winPct(myCp);
  const sameAsBest = best?.pv[0] === uci;
  const ok = sameAsBest || loss <= 4;
  // Reason: the opponent's reply and what it does
  const reply = after?.pv[0];
  const replyMotif = reply ? detectMotifs(c.fen(), reply).find((m) => m.kind !== 'check') : undefined;
  let reason: string;
  if (ok) {
    const motif = detectMotifs(fen, uci).find((m) => m.kind !== 'check');
    reason = motif ? `It works because ${motif.text}.` : st.delta > 0 ? `It works: after the exchanges ${result}.`
      : st.delta < 0 ? `It gives a little back (${result}), but that's fine: ${feel(myCp)} afterwards.` : `It keeps your position healthy: ${feel(myCp)}.`;
  } else if (myCp <= -9000) {
    reason = `It allows a forced checkmate${reply ? `, starting with ${new Chess(c.fen()).moves({ verbose: true }).find((x) => x.lan === reply)?.san}` : ''}.`;
  } else if (st.delta < 0) {
    reason = replyMotif ? `Their answer is the problem: ${replyMotif.text}. In the end ${result}.` : `After their best answer ${result}.`;
  } else if (bestCp >= 9000) {
    reason = `It is not bad by itself, but you had a forced checkmate and this lets it slip.`;
  } else if (st.delta === 0 && settle(fen, best?.pv ?? []).delta > 0) {
    reason = `Nothing terrible happens, but you miss a chance to win material.`;
  } else {
    const kingNote = kingWorse(fen, c.fen(), me) ? ' It also loosens the pawns around your king.' : '';
    reason = `You don't lose material right away, but afterwards ${feel(myCp)}. With the best move, ${feel(bestCp)}.${kingNote}`;
  }
  // Perpetual check: the opponent's moves in the line are all checks and the result is level.
  const oppMoves = story.filter((_, i) => i % 2 === 1);
  const perpetual = !ok && oppMoves.length >= 2 && oppMoves.every((x) => /giving check/.test(x.text)) && Math.abs(myCp) < 60;
  let finalResult = result;
  if (perpetual) {
    reason = `Your opponent can give check after check and your king can't escape: a perpetual check, so the game is only a draw. With the best move, ${feel(bestCp)}.`;
    finalResult = 'a draw by perpetual check';
  }
  const headline = ok
    ? (sameAsBest ? `Yes! ${mv.san} is the best move here.` : `${mv.san} works. It is about as good as the engine's choice.`)
    : `${mv.san} doesn't work. Here's why.`;
  let better: Verdict['better'];
  if (!ok && best) {
    const bst = settle(fen, best.pv);
    const bs = narrate(fen, best.pv, me, Math.min(10, Math.max(n, bst.plies)));
    better = { san: bs[0]?.san ?? best.pv[0], uci: best.pv[0], story: bs, result: lineResult(fen, best.pv, bst) };
  }
  let compare: Comparison | undefined;
  if (!sameAsBest && best?.pv[0]) {
    try {
      compare = compareMoves(fen, { uci: best.pv[0], san: new Chess(fen).moves({ verbose: true }).find((x) => x.lan === best.pv[0])?.san ?? best.pv[0], cp: bestCp, pv: best.pv },
        { uci, san: mv.san, cp: myCp, pv: line });
    } catch { compare = undefined; }
  }
  const headline2 = ok && !sameAsBest && compare && !compare.equal ? `${mv.san} is playable, but ${compare.better.san} is stronger. Here's why.` : headline;
  return { ok, headline: headline2, story, result: finalResult, reason, better, lineUci: line, compare };
}

function kingWorse(before: string, after: string, me: Color) {
  const a = new Chess(before), b = new Chess(after);
  const shield = (c: Chess) => {
    const k = findKing(c, me);
    let n = 0;
    for (let df = -1; df <= 1; df++) for (let dr = 1; dr <= 2; dr++) {
      const f = k.charCodeAt(0) - 97 + df, r = Number(k[1]) - 1 + dr * (me === 'w' ? 1 : -1);
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = c.get((String.fromCharCode(97 + f) + (r + 1)) as Square);
      if (p && p.type === 'p' && p.color === me) n++;
    }
    return n;
  };
  return shield(b) < shield(a);
}

/** Result of a line for the side to move at `fen`: checkmate if the line mates, else the material outcome. */
export function lineResult(fen: string, ucis: string[], st = settle(fen, ucis)): string {
  const c = new Chess(fen);
  const me = c.turn();
  for (const u of ucis.slice(0, 10)) { if (!tryMove(c, u)) break; if (c.isCheckmate()) return c.turn() === me ? 'you get checkmated' : 'you checkmate them'; }
  return tradeWords(st);
}

/** Text for a stored engine line (review pages: no engine call needed). `me` is the side to move at `fen`. */
export function storyFor(fen: string, ucis: string[], me: Color, level: CoachLevel) {
  const st = settle(fen, ucis);
  const steps = narrate(fen, ucis, me, Math.min(10, Math.max(level === 'beginner' ? 4 : level === 'intermediate' ? 6 : 8, st.plies)));
  // settle() measures from the side to move at fen; flip if that is not `me`.
  const flip = new Chess(fen).turn() !== me;
  let result = lineResult(fen, ucis, st);
  if (flip) result = result.startsWith('you checkmate') ? 'you get checkmated' : result.startsWith('you get') ? 'you checkmate them' : tradeWords({ delta: -st.delta, lost: st.won, won: st.lost });
  return { steps, result };
}
export { parseUci };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ThreatInfo { uci: string; san: string; steps: Step[]; result: string; summary: string }
/**
 * "What are they threatening?" The move the opponent would play if it were
 * their turn, told as a story with what it wins. `known` is a stored threat
 * move (bank exercises); otherwise Stockfish finds it.
 */
export async function explainThreat(engine: UciEngine, fen: string, level: CoachLevel, known?: string): Promise<ThreatInfo | null> {
  const me = new Chess(fen).turn();
  const p = fen.split(' ');
  if (new Chess(fen).isCheck()) return null;
  p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-';
  let nm: string;
  try { nm = new Chess(p.join(' ')).fen(); } catch { return null; }
  const r = await engine.analyze(nm, { depth: 13 });
  const line = r.lines[0];
  let pv = line?.pv ?? [];
  if (known && pv[0] !== known) {
    const r2 = await engine.analyze(nm, { depth: 12, searchmoves: [known] });
    pv = r2.lines[0]?.pv ?? [known];
  }
  if (!pv.length) return null;
  const st = storyFor(nm, pv, me, level);
  const san = new Chess(nm).moves({ verbose: true }).find((x) => x.lan === pv[0])?.san ?? pv[0];
  const first = describeMove(nm, pv[0], me).replace(/^They /, '').replace(/\.$/, '');
  const summary = st.result.includes('checkmated')
    ? `They are threatening checkmate, starting with ${san}. If you ignore it, ${st.result}.`
    : `They are threatening ${san}: they would ${first}. If you ignore it, ${st.result}.`;
  return { uci: pv[0], san, steps: st.steps, result: st.result, summary };
}
