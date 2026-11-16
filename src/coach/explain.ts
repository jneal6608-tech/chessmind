// Plain-language explanations built only from engine output and detected
// patterns: nothing here is invented. Sophistication follows the player's level.
import type { MoveAnalysis } from '../analysis/types';
import { formatScore } from '../engine/uci';
import { formatLine, colorName } from '../chess/util';
import { WEAKNESS } from '../training/themes';

export type CoachLevel = 'beginner' | 'intermediate' | 'advanced';
export function levelFor(rating: number, override: string): CoachLevel {
  if (override === 'beginner' || override === 'intermediate' || override === 'advanced') return override;
  return rating < 1450 ? 'beginner' : rating < 1850 ? 'intermediate' : 'advanced';
}

const CLS_TEXT: Record<string, string> = {
  blunder: 'a blunder', mistake: 'a mistake', inaccuracy: 'an inaccuracy', miss: 'a missed opportunity',
  brilliant: 'a brilliant move (a sound sacrifice)', great: 'a great move (the only good move here)',
  best: 'the best move', excellent: 'an excellent move', good: 'a good move', book: 'a book move', forced: 'the only legal move',
};

export function verdictWords(cpWhite: number, side: 'w' | 'b'): string {
  const v = side === 'w' ? cpWhite : -cpWhite;
  if (v >= 9000) return 'you have a forced checkmate';
  if (v <= -9000) return 'you are getting mated';
  if (v >= 300) return 'you are winning';
  if (v >= 120) return 'you are clearly better';
  if (v >= 40) return 'you are slightly better';
  if (v > -40) return 'the position is about equal';
  if (v > -120) return 'you are slightly worse';
  if (v > -300) return 'you are clearly worse';
  return 'you are losing';
}

export interface Explanation { headline: string; problem: string; problemShort: string; feelAfter: string; bestIdea: string; better: string; concept: string; recognize: string; lineText: string; replyText: string }

export function explainMove(m: MoveAnalysis, level: CoachLevel): Explanation {
  const moveNo = Math.floor(m.ply / 2) + 1;
  const label = `${moveNo}${m.color === 'w' ? '.' : '...'}${m.san}`;
  const tag = m.tags[0];
  const before = verdictWords(m.evalBefore, m.color);
  const after = verdictWords(m.evalAfter, m.color);
  const evalTxt = level === 'beginner' ? '' : ` (engine: ${formatScore(m.evalBefore)} → ${formatScore(m.evalAfter)}, ${m.winLoss.toFixed(0)}% winning chances lost)`;
  const headline = `${label} was ${CLS_TEXT[m.cls] ?? m.cls}.` + (m.cls === 'blunder' ? ' It changed the game a lot.' : m.cls === 'miss' ? ' You had a chance to win more here.' : '');
  let problem = before === after
    ? `${before[0].toUpperCase()}${before.slice(1)} both before and after this move, but it gives away ${m.winLoss.toFixed(0)}% of your winning chances (${formatScore(m.evalBefore)} → ${formatScore(m.evalAfter)}).`
    : `Before the move ${before}; after it ${after}${evalTxt}.`;
  if (tag) problem += ` ${tag.why}`;
  if (tag && tag.confidence < 0.5) problem += ' (This cause is a best guess: the engine shows the move is worse, but the reason is less clear-cut.)';
  if (m.threatSan && !(tag && tag.key.includes('threat'))) problem += ` Note: your opponent was threatening ${m.threatSan}.`;
  const replyText = m.replyLine.length ? formatLine(m.fenAfter, m.replyLine.slice(0, level === 'beginner' ? 3 : 6)) : '';
  if (replyText && m.cls !== 'inaccuracy') problem += ` The engine's answer to ${m.san}: ${replyText}.`;
  const lineText = formatLine(m.fenBefore, m.bestLine.slice(0, level === 'beginner' ? 3 : level === 'intermediate' ? 5 : 8));
  const motif = m.motifsBest.find((x) => x.kind !== 'check') ?? m.motifsBest[0];
  let better = `Better was ${m.bestSan}`;
  better += motif ? `: ${motif.text}.` : '.';
  better += ` Engine line: ${lineText}.`;
  const def = tag ? WEAKNESS[tag.key] : undefined;
  const concept = def ? def.lesson : 'Compare candidate moves: checks, captures and threats first, then improve your worst piece.';
  const recognize = def ? recognizeHint(def.key, level) : 'Ask after every opponent move: what changed, and what does it attack?';
  const sign = m.color === 'w' ? 1 : -1;
  const feelAfter = feelWords(m.evalAfter * sign);
  const problemShort = before === after
    ? `${cap(before)} both before and after, but this move gave away a big part of your chances.`
    : `Before this move ${before}. After it, ${after}.`;
  const bm = m.motifsBest.find((x) => x.kind !== 'check');
  const bestIdea = bm ? `${cap(bm.text)}.` : '';
  return { headline, problem, problemShort, feelAfter, bestIdea, better, concept, recognize, lineText, replyText };
}

function recognizeHint(key: string, level: CoachLevel): string {
  const H: Record<string, [string, string]> = {
    missed_fork: ['Look for two enemy pieces a knight\'s jump apart from one empty square, or a king and a loose piece.', 'Fork patterns appear when targets are on the same colour (knights) or line up with a free queen square; scan for undefended pieces first.'],
    missed_pin: ['A piece in front of the king or queen on a line can be pinned.', 'Note relative vs absolute pins: pile up on the pinned piece with pawns before it can be unpinned.'],
    missed_skewer: ['King or queen in front of another piece on a line = skewer chance.', 'Skewers often follow a check that drives the king onto a line with a loose rook.'],
    missed_discovered: ['If your piece is in the way of your rook, bishop or queen, moving it can attack twice.', 'The moving piece is free to make its own threat or check: that is what makes discoveries so strong.'],
    missed_free_material: ['After every opponent move, count: is anything left undefended?', 'Count attackers and defenders on every contact square; the exchange sequence tells you if a capture is free.'],
    hanging_pieces: ['Before you move, check: after this move, what can my opponent capture?', 'Blunder check: list your opponent\'s checks, captures and threats after your candidate move.'],
    back_rank: ['Rooks and queens on an open file + a king behind unmoved pawns = back-rank danger. Make luft (h3/h6).', 'Count back-rank defenders: if the last one can be deflected, the mate is on.'],
    missed_mate: ['Always look at every check, especially near the enemy king.', 'Forced sequences (checks) can be calculated to the end; look for them first when the enemy king is exposed.'],
    missed_mating_threat: ['Ask "if it were their move, could they mate me?"', 'Use the null-move test: what would your opponent do if you passed?'],
    missed_threat: ['Every opponent move has a purpose: find it before choosing your own move.', 'Look at what the moved piece attacks and what lines it opened.'],
    moving_fast: ['Use your time when the position is tense: captures, checks or a piece under attack.', 'Spend time at critical moments (tension, transitions), save it in routine positions.'],
  };
  const h = H[key];
  return h ? (level === 'beginner' ? h[0] : h[1]) : (WEAKNESS[key]?.lesson ?? '');
}

export function summaryLine(color: 'w' | 'b', acc: number, counts: { blunder: number; mistake: number; inaccuracy: number }) {
  return `${colorName(color)}: ${acc.toFixed(0)}% accuracy, ${counts.blunder} blunder${counts.blunder === 1 ? '' : 's'}, ${counts.mistake} mistake${counts.mistake === 1 ? '' : 's'}, ${counts.inaccuracy} inaccurac${counts.inaccuracy === 1 ? 'y' : 'ies'}.`;
}

function feelWords(cp: number) {
  if (cp >= 9000) return 'you still have a forced mate';
  if (cp <= -9000) return 'you get checkmated';
  if (cp >= 300) return 'you are still winning';
  if (cp >= 120) return 'you are still better';
  if (cp > -40) return 'the position is about equal';
  if (cp > -300) return 'you are worse';
  return 'you are losing';
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
