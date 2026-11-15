// Why did this move go wrong? Turns an engine verdict into likely causes, using
// the position itself: tactical patterns in the engine line, threats that were
// already on the board, what the move changed structurally, game phase and
// time spent. Every cause carries a confidence; uncertain cases say so.
import { Chess, type Square } from 'chess.js';
import { winPct } from '../engine/uci';
import type { MoveAnalysis, Tag } from './types';
import type { Motif } from '../chess/motifs';
import {
  VAL, PIECE_NAME, parseUci, fileOf, rankOf, findKing, kingShield, pawnInfo, undeveloped, hasCastlingRights,
  kingLooksCastled, seeMove, see, pieces, material,
} from '../chess/util';
import { endgameType } from '../training/themes';

interface Ctx { medianTime?: number; opening?: { eco: string; name: string; ply: number } }

const MOTIF_TO_MISSED: Record<string, string> = {
  fork: 'missed_fork', pin: 'missed_pin', skewer: 'missed_skewer', discovered: 'missed_discovered',
  capture_hanging: 'missed_free_material', winning_capture: 'missed_free_material',
  mate: 'missed_mate', back_rank_mate: 'missed_mate', promotion: 'promotion_technique',
};

export function classifyMove(m: MoveAnalysis, all: MoveAnalysis[], ctx: Ctx): Tag[] {
  const tags: Tag[] = [];
  const add = (key: string, confidence: number, why: string) => {
    const ex = tags.find((t) => t.key === key);
    if (ex) { if (confidence > ex.confidence) { ex.confidence = confidence; ex.why = why; } return; }
    tags.push({ key, confidence: Math.round(confidence * 100) / 100, why });
  };
  const before = new Chess(m.fenBefore);
  const after = new Chess(m.fenAfter);
  const me = m.color;
  const sign = me === 'w' ? 1 : -1;
  const moverBefore = m.evalBefore * sign, moverAfter = m.evalAfter * sign;
  const wBefore = winPct(moverBefore), wAfter = winPct(moverAfter);
  const mv = parseUci(m.uci);
  const piece = before.get(mv.from)!;
  const playedMove = before.moves({ verbose: true }).find((x) => x.from === mv.from && x.to === mv.to);
  const big = m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss';

  // ---------- 1. What did the best move do that we missed? ----------
  const bestMate = m.evalBefore * sign >= 9000;
  const strongBest = m.motifsBest.filter((x) => x.kind !== 'check');
  if (bestMate && !(moverAfter >= 9000)) {
    const backRank = m.motifsBest.some((x) => x.kind === 'back_rank_mate');
    add(backRank ? 'missed_mate' : 'missed_mate', 0.95, `There was a forced checkmate starting with ${m.bestSan} (${m.bestLine.slice(0, 5).join(' ')}).`);
    if (m.bestLine.length > 1) add('ignored_forcing', 0.5, `The winning line was a series of forcing moves (checks).`);
  } else if (wBefore - wAfter >= 8 && wBefore >= 55) {
    const first = pickMotif(strongBest);
    if (first) {
      const key = MOTIF_TO_MISSED[first.kind];
      if (key) add(key, 0.8, `${m.bestSan} was strong: ${first.text}.`);
    } else if (wBefore >= 70 && big) {
      add('missed_tactic', 0.45, `${m.bestSan} kept a large advantage; the idea is deeper than a one-move pattern (line: ${m.bestLine.slice(0, 5).join(' ')}).`);
    }
  }

  // ---------- 2. What did our move allow? ----------
  const reply = m.replyLineUci[0];
  const replyMate = moverAfter <= -9000;
  if (reply && wBefore - wAfter >= 8) {
    const r = parseUci(reply);
    const replyMove = after.moves({ verbose: true }).find((x) => x.from === r.from && x.to === r.to);
    const strongReply = m.motifsReply.filter((x) => x.kind !== 'check');
    const threatExisted = !!m.threatUci && m.threatUci === reply;
    if (replyMate && !(moverBefore <= -9000)) {
      const backRank = m.motifsReply.some((x) => x.kind === 'back_rank_mate') || isBackRankMateLine(m.fenAfter, m.replyLineUci);
      if (backRank) add('back_rank', 0.9, `After ${m.san}, ${m.replyLine.slice(0, 3).join(' ')} mates on the back rank: the king had no escape square.`);
      add(threatExisted ? 'missed_mating_threat' : 'missed_mating_threat', threatExisted ? 0.9 : 0.75,
        threatExisted ? `The mating idea ${m.threatSan} was already threatened before your move, and ${m.san} did not stop it.`
          : `${m.san} allowed a forced mate: ${m.replyLine.slice(0, 5).join(' ')}.`);
    } else if (replyMove?.captured) {
      // Did our move leave something undefended or create the target?
      const target = replyMove.to;
      const lostSee = seeMove(m.fenAfter, reply);
      const wasSafe = before.get(target) ? see(flipTurn(m.fenBefore), target) < VAL[before.get(target)!.type] : true;
      const movedPiece = target === mv.to;
      if (lostSee >= 2 || (lostSee >= 1 && replyMove.captured !== 'p')) {
        if (threatExisted && !movedPiece) {
          add('missed_threat', 0.85, `Before your move, ${m.threatSan} was already threatening the ${PIECE_NAME[replyMove.captured]} on ${target}; ${m.san} did not deal with it.`);
        } else if (movedPiece) {
          add('hanging_pieces', 0.85, `${m.san} put the ${PIECE_NAME[piece.type]} on ${target}, where it can be taken (${m.replyLine[0]}) and you lose material.`);
          add('no_blunder_check', 0.55, `A quick check of your opponent's captures after ${m.san} would have shown ${m.replyLine[0]}.`);
        } else if (wasSafe) {
          add('hanging_pieces', 0.75, `${m.san} left the ${PIECE_NAME[replyMove.captured]} on ${target} without enough protection; ${m.replyLine[0]} wins it.`);
          add('no_blunder_check', 0.5, `After ${m.san}, the capture ${m.replyLine[0]} was a one-move reply.`);
        } else {
          add('missed_threat', 0.6, `The ${PIECE_NAME[replyMove.captured]} on ${target} was already under attack and ${m.san} did not save it.`);
        }
      }
      if (playedMove?.captured && seeMove(m.fenBefore, m.uci) < 0) {
        add('bad_exchange', 0.75, `${m.san} started an exchange that loses material once all the captures are counted.`);
      }
    }
    const tacticalReply = pickMotif(strongReply);
    if (tacticalReply && !replyMate && !tags.some((t) => t.key === 'hanging_pieces' && t.confidence > 0.8)) {
      const k = tacticalReply.kind;
      if (k === 'fork' || k === 'pin' || k === 'skewer' || k === 'discovered') {
        add(threatExisted ? 'missed_threat' : 'no_blunder_check', threatExisted ? 0.8 : 0.7,
          `${m.san} allowed ${m.replyLine[0]}: ${tacticalReply.text}.`);
        if (k === 'fork') add('missed_threat', 0.5, `Watch the squares where an enemy knight or queen could attack two pieces.`);
      }
    }
    if (threatExisted && !tags.some((t) => t.key === 'missed_threat' || t.key === 'missed_mating_threat')) {
      add('missed_threat', 0.7, `Your opponent was threatening ${m.threatSan}, and ${m.san} did not stop it.`);
    }
    // Forcing move by us that was miscalculated (refutation is not immediate)
    if (playedMove && (playedMove.captured || playedMove.san.includes('+')) && big && !tacticalReply && !replyMove?.captured) {
      add('poor_calculation', 0.5, `${m.san} is a forcing move, but the follow-up does not work: ${m.replyLine.slice(0, 4).join(' ')}.`);
    }
  }

  // ---------- 3. Time ----------
  if (m.timeMs !== undefined && ctx.medianTime && (m.cls === 'blunder' || m.cls === 'mistake')) {
    if (m.timeMs < Math.max(3000, ctx.medianTime * 0.4)) {
      add('moving_fast', 0.6, `You played ${m.san} in ${(m.timeMs / 1000).toFixed(1)}s (your usual: ${(ctx.medianTime / 1000).toFixed(0)}s) in a position that needed care.`);
    }
  }

  // ---------- 4. Phase-specific causes (quiet errors) ----------
  const tacticalCause = tags.some((t) => t.confidence >= 0.7);
  const moveNo = Math.floor(m.ply / 2) + 1;
  if (m.phase === 'opening' || moveNo <= 12) {
    const devBefore = undeveloped(before, me);
    if (piece.type === 'q' && moveNo <= 8 && devBefore >= 2) {
      add('early_queen', tacticalCause ? 0.45 : 0.7, `The queen came out on move ${moveNo} while ${devBefore} minor pieces were still at home.`);
    }
    const movedTwice = all.slice(0, m.ply).some((x) => x.color === me && parseUci(x.uci).to === mv.from) && piece.type !== 'p' && piece.type !== 'k' && !playedMove?.captured;
    if (movedTwice && devBefore >= 2 && moveNo <= 10) {
      add('opening_development', tacticalCause ? 0.4 : 0.65, `${m.san} moves the same piece again while ${devBefore} pieces are undeveloped.`);
    }
    const best = parseUci(m.bestUci);
    const bestPiece = before.get(best.from);
    const flank = piece.type === 'p' && (fileOf(mv.from) <= 1 || fileOf(mv.from) >= 6);
    const centralBest = bestPiece && (bestPiece.type === 'p' && fileOf(best.from) >= 2 && fileOf(best.from) <= 5 || centralSquare(best.to));
    if (flank && centralBest && !tacticalCause) {
      add('center_control', 0.55, `${m.san} is a side pawn move; ${m.bestSan} fights for the centre instead.`);
    } else if (piece.type === 'p' && devBefore >= 3 && moveNo <= 8 && !centralSquare(mv.to) && !tacticalCause) {
      add('opening_development', 0.5, `Pawn moves like ${m.san} delay development; get the knights and bishops out first.`);
    }
    if (!tacticalCause && !tags.length) {
      add('opening_unfamiliar', 0.4, `An opening inaccuracy${ctx.opening ? ` in the ${ctx.opening.name}` : ''}; ${m.bestSan} is the usual idea here.`);
    }
  }

  // King safety
  if (piece.type === 'p' && kingLooksCastled(before, me)) {
    const k = findKing(before, me);
    if (Math.abs(fileOf(mv.from) - fileOf(k)) <= 1 && kingShield(after, me) < kingShield(before, me)) {
      add('king_safety', tacticalCause ? 0.4 : 0.65, `${m.san} pushes a pawn in front of your castled king and weakens its shelter.`);
    }
  }
  if (moveNo >= 10 && moveNo <= 20 && hasCastlingRights(m.fenBefore, me) && !kingLooksCastled(before, me)
      && isCastle(m.bestUci, before) && !isCastle(m.uci, before)) {
    add('king_safety', 0.6, `Your king is still in the centre on move ${moveNo}; castling (${m.bestSan}) was the priority.`);
  }

  if (m.phase !== 'endgame' && !tacticalCause) {
    // Pawn structure damage
    const pb = pawnInfo(before, me), pa = pawnInfo(after, me);
    if ((pa.doubled > pb.doubled || pa.isolated > pb.isolated) && !playedMove?.captured) {
      add('pawn_structure', 0.55, `${m.san} creates ${pa.doubled > pb.doubled ? 'doubled' : 'isolated'} pawns that will be hard to defend later.`);
    } else if (playedMove?.captured && (pa.doubled > pb.doubled || pa.isolated > pb.isolated) && m.cls !== 'inaccuracy') {
      add('pawn_structure', 0.45, `Recapturing like this damages your pawn structure.`);
    }
    // Bad trade
    if (playedMove?.captured && VAL[playedMove.captured] >= 3 && VAL[playedMove.captured] === VAL[piece.type] && !tags.some((t) => t.key === 'bad_exchange')) {
      add('bad_exchange', 0.45, `Trading with ${m.san} helped your opponent; ${m.bestSan} kept more tension.`);
    }
    // Piece placement: knight to the rim / piece retreats into passivity
    if (piece.type === 'n' && (fileOf(mv.to) === 0 || fileOf(mv.to) === 7)) {
      add('piece_placement', 0.55, `The knight on ${mv.to} is on the edge of the board and controls few squares.`);
    } else if (piece.type !== 'p' && piece.type !== 'k' && isRetreat(mv.from, mv.to, me) && !playedMove?.captured) {
      const mobB = before.moves({ square: mv.from }).length;
      const mobA = mobilityAt(after, mv.to, me);
      if (mobA < mobB - 2) add(moverBefore >= 100 ? 'passive_play' : 'piece_placement', 0.45, `${m.san} retreats the ${PIECE_NAME[piece.type]} to a passive square (${mobA} moves instead of ${mobB}).`);
    }
    if (moverBefore >= 150 && moverAfter < moverBefore - 120 && !tags.length) {
      add('missed_advantage', 0.5, `You were clearly better; ${m.bestSan} would have increased the pressure.`);
    }
    if (!tags.length && Math.abs(moverBefore) < 150 && m.cls !== 'inaccuracy') {
      add('passive_play', 0.35, `Hard to name one cause: ${m.bestSan} was the more active choice (engine line ${m.bestLine.slice(0, 4).join(' ')}).`);
    }
  }

  // ---------- 5. Endgames ----------
  if (m.phase === 'endgame') {
    const type = endgameType(m.fenBefore);
    const best = parseUci(m.bestUci);
    const bestPiece = before.get(best.from);
    if (moverBefore >= 300 && moverAfter < 200) add('conversion', 0.75, `You were winning (${fmt(moverBefore)}) and ${m.san} let much of it slip (${fmt(moverAfter)}).`);
    if (Math.abs(moverBefore) <= 80 && moverAfter <= -200) add('holding_draws', 0.7, `The position was holdable, but after ${m.san} it is losing.`);
    if (bestPiece?.type === 'k' && piece.type !== 'k') {
      const kb = findKing(before, me);
      add('king_activity', 0.6, `${m.bestSan} activates the king; in endgames the king must join the fight (yours is on ${kb}).`);
    }
    if (type === 'eg_pawn' && bestPiece?.type === 'k' && piece.type === 'k') add('opposition', 0.55, `In king-and-pawn endings the exact king square matters: ${m.bestSan} (taking the opposition or a key square) was needed.`);
    if (bestPiece?.type === 'p' && pawnInfo(before, me).passed.includes(best.from)) add('promotion_technique', 0.6, `Your passed pawn on ${best.from} should advance: ${m.bestSan}.`);
    if (type === 'eg_rook') add('rook_endgames', tags.length ? 0.45 : 0.6, `Rook endgame technique: ${m.bestSan} (line ${m.bestLine.slice(0, 4).join(' ')}).`);
    if (type === 'eg_minor') add('minor_endgames', tags.length ? 0.4 : 0.55, `Minor-piece endgame technique: ${m.bestSan} was better.`);
  }

  if (!tags.length) {
    add(big ? 'missed_tactic' : 'passive_play', 0.25, `The engine prefers ${m.bestSan} (${m.bestLine.slice(0, 4).join(' ')}), but the reason is not a clear pattern; treat this one as uncertain.`);
  }
  return tags.sort((a, b) => b.confidence - a.confidence);
}

function pickMotif(ms: Motif[]): Motif | undefined {
  const order = ['back_rank_mate', 'mate', 'fork', 'skewer', 'pin', 'discovered', 'capture_hanging', 'winning_capture', 'promotion'];
  for (const k of order) { const f = ms.find((x) => x.kind === k); if (f) return f; }
  return undefined;
}
function flipTurn(fen: string) { const p = fen.split(' '); p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); }
const centralSquare = (s: string) => fileOf(s) >= 2 && fileOf(s) <= 5 && rankOf(s) >= 2 && rankOf(s) <= 5;
function isCastle(uci: string, c: Chess) { const p = c.get(uci.slice(0, 2) as Square); return p?.type === 'k' && Math.abs(fileOf(uci.slice(0, 2)) - fileOf(uci.slice(2, 4))) === 2; }
function isRetreat(from: string, to: string, me: 'w' | 'b') { return me === 'w' ? rankOf(to) < rankOf(from) : rankOf(to) > rankOf(from); }
function mobilityAt(after: Chess, sq: Square, me: 'w' | 'b') {
  const f = after.fen().split(' '); f[1] = me; f[3] = '-';
  try { return new Chess(f.join(' ')).moves({ square: sq }).length; } catch { return 0; }
}
/** Mate by a rook or queen along the back rank, with the king hemmed in by its own pieces. */
export function isBackRankMateLine(fen: string, pv: string[]) {
  const c = new Chess(fen);
  let last;
  for (const u of pv.slice(0, 7)) { try { last = c.move(parseUci(u)); } catch { return false; } if (c.isCheckmate()) break; }
  if (!c.isCheckmate() || !last) return false;
  const side = c.turn();
  const k = findKing(c, side);
  const back = side === 'w' ? 0 : 7;
  if (rankOf(k) !== back || !(last.piece === 'r' || last.piece === 'q') || rankOf(last.to) !== back) return false;
  const fwd = side === 'w' ? 1 : -1;
  let blockedByOwn = 0;
  for (let df = -1; df <= 1; df++) {
    const f = fileOf(k) + df;
    if (f < 0 || f > 7) continue;
    const p = c.get((String.fromCharCode(97 + f) + (back + fwd + 1)) as Square);
    if (p && p.color === side) blockedByOwn++;
  }
  return blockedByOwn >= 2;
}
const fmt = (cp: number) => (cp >= 9000 ? 'mate' : (cp / 100 > 0 ? '+' : '') + (cp / 100).toFixed(1));
void pieces; void material;
