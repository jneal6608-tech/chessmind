// Find an opening line by id, from the built-in courses or your own repertoire.
import { Chess } from 'chess.js';
import { COURSES } from '../data/repertoire';
import type { RepertoireLine } from '../store/db';
import { tryMove } from '../chess/util';

export interface BookLine { id: string; name: string; color: 'w' | 'b'; uci: string[]; san: string[]; notes: Record<number, string>; courseId?: string }

export function findBookLine(id: string, repertoire: RepertoireLine[] = []): BookLine | undefined {
  for (const c of COURSES) {
    const l = c.lines.find((x) => x.id === id);
    if (!l) continue;
    const ch = new Chess();
    const uci: string[] = [], san: string[] = [];
    for (const s of l.san.split(' ')) { const m = ch.move(s); uci.push(m.lan); san.push(m.san); }
    return { id: l.id, name: `${c.name}: ${l.name}`, color: c.color, uci, san, notes: l.notes ?? {}, courseId: c.id };
  }
  const r = repertoire.find((x) => x.id === id);
  if (!r) return undefined;
  const ch = new Chess();
  const san = r.moves.map((u) => tryMove(ch, u)?.san ?? u);
  return { id: r.id, name: r.name, color: r.color, uci: r.moves, san, notes: {} };
}
