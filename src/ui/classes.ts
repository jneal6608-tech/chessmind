// Move classification labels, glyphs and one-line meanings, shared by every screen.
import type { MoveClass } from '../analysis/types';

export const CLASS_LABEL: Record<MoveClass, string> = {
  brilliant: 'Brilliant', great: 'Great', best: 'Best', excellent: 'Excellent', good: 'Good', book: 'Book',
  inaccuracy: 'Inaccuracy', mistake: 'Mistake', miss: 'Miss', blunder: 'Blunder', forced: 'Forced',
};
export const CLASS_GLYPH: Record<MoveClass, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '·', book: '≡',
  inaccuracy: '?!', mistake: '?', miss: '✕', blunder: '??', forced: '□',
};
export const CLASS_MEANING: Record<MoveClass, string> = {
  brilliant: 'A sacrifice that works: it gives up material and the position stays good.',
  great: 'The only good move: every other move was much worse.',
  best: "Stockfish's first choice.",
  excellent: 'Almost as good as the best move.',
  good: 'A reasonable move that loses a little.',
  book: 'Known opening theory.',
  inaccuracy: 'Loses some of your winning chances.',
  mistake: 'Loses a lot of your winning chances.',
  miss: 'Your opponent had just erred and you let the chance go.',
  blunder: 'Changes the result: throws away a big part of the game.',
  forced: 'The only legal move.',
};
export const CLASS_ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

/** Glyph shown in the bubble on the board. */
export const BADGE_GLYPH: Record<MoveClass, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '👍', good: '✓', book: '📖',
  inaccuracy: '?!', mistake: '?', miss: '✕', blunder: '??', forced: '→',
};
export function badgeFor(square: string, cls: MoveClass) {
  return { square, cls, glyph: BADGE_GLYPH[cls], title: `${CLASS_LABEL[cls]}: ${CLASS_MEANING[cls]}` };
}
