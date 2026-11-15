// Opening names from the Lichess chess-openings table (CC0), keyed by position,
// so transpositions are recognised too.
import table from '../data/openings.json';
import { Chess } from 'chess.js';
import { tryMove, START_FEN } from '../chess/util';

type Row = [eco: string, name: string, ply: number, uci: string];
const T = table as unknown as Record<string, Row>;
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function isBookPosition(fen: string): boolean { return !!T[key(fen)]; }
export function lookupOpening(fen: string): { eco: string; name: string } | null {
  const r = T[key(fen)];
  return r ? { eco: r[0], name: r[1] } : null;
}
/** Deepest named position reached in the game. */
export function identifyOpening(moves: string[], startFen?: string): { eco: string; name: string; ply: number } | undefined {
  if (startFen && startFen !== START_FEN) return undefined;
  const c = new Chess();
  let found: { eco: string; name: string; ply: number } | undefined;
  for (let i = 0; i < Math.min(moves.length, 30); i++) {
    if (!tryMove(c, moves[i])) break;
    const r = T[key(c.fen())];
    if (r) found = { eco: r[0], name: r[1], ply: i + 1 };
  }
  return found;
}
/** Family name ("Sicilian Defense") from a full name ("Sicilian Defense: Najdorf Variation"). */
export const openingFamily = (name: string) => name.split(':')[0].trim();
