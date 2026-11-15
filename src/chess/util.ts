// Board helpers on top of chess.js: geometry, static exchange evaluation,
// material, game phase and structural features. No engine calls here.
import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';

export const VAL: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};
export const FILES = 'abcdefgh';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const sqOf = (f: number, r: number) => (FILES[f] + (r + 1)) as Square;
export const fileOf = (s: string) => s.charCodeAt(0) - 97;
export const rankOf = (s: string) => Number(s[1]) - 1;
export const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

export interface UciMove { from: Square; to: Square; promotion?: PieceSymbol }
export function parseUci(uci: string): UciMove {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
  };
}

/** Play a UCI move; returns the verbose move or null if illegal. */
export function tryMove(c: Chess, uci: string) {
  try { return c.move(parseUci(uci)); } catch { return null; }
}
export function sanOf(fen: string, uci: string): string {
  const m = tryMove(new Chess(fen), uci);
  return m ? m.san : uci;
}
export function fenAfter(fen: string, uci: string): string | null {
  const c = new Chess(fen);
  return tryMove(c, uci) ? c.fen() : null;
}
/** Convert a UCI principal variation to SAN, stopping at the first illegal move. */
export function pvToSan(fen: string, pv: string[], max = 8): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    const m = tryMove(c, u);
    if (!m) break;
    out.push(m.san);
  }
  return out;
}
/** "12. Nf3 Nc6 13. d4" style text for a SAN line starting from a FEN. */
export function formatLine(fen: string, sans: string[]): string {
  const parts = fen.split(' ');
  let no = Number(parts[5]) || 1;
  let white = parts[1] === 'w';
  let s = '';
  sans.forEach((san, i) => {
    if (white) s += `${no}. ${san} `;
    else { s += i === 0 ? `${no}... ${san} ` : `${san} `; no++; }
    white = !white;
  });
  return s.trim();
}

/** Static exchange evaluation: material the side to move wins by capturing on `target`
 *  (least valuable attacker first, both sides may stop). 0 when no capture pays. */
export function see(fen: string, target: Square): number {
  return seeRec(new Chess(fen), target, 0);
}
function seeRec(c: Chess, target: Square, depth: number): number {
  if (depth > 12) return 0;
  const caps = c.moves({ verbose: true }).filter((m) => m.to === target && m.captured);
  if (!caps.length) return 0;
  caps.sort((a, b) => VAL[a.piece] - VAL[b.piece]);
  const m = caps[0];
  const gain = VAL[m.captured!] + (m.promotion ? VAL[m.promotion] - 1 : 0);
  c.move(m);
  const reply = seeRec(c, target, depth + 1);
  c.undo();
  return Math.max(0, gain - reply);
}
/** Net material result of one specific capture (can be negative). */
export function seeMove(fen: string, uci: string): number {
  const c = new Chess(fen);
  const m = tryMove(c, uci);
  if (!m) return 0;
  const gain = (m.captured ? VAL[m.captured] : 0) + (m.promotion ? VAL[m.promotion] - 1 : 0);
  return gain - seeRec(c, m.to, 0);
}

const DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
  k: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
export const sliderDirs = (p: PieceSymbol) => (p === 'b' || p === 'r' || p === 'q' ? DIRS[p] : []);

/** Pieces met along a ray from a square, nearest first. */
export function ray(c: Chess, from: Square, df: number, dr: number) {
  const out: { sq: Square; type: PieceSymbol; color: Color }[] = [];
  let f = fileOf(from) + df, r = rankOf(from) + dr;
  while (onBoard(f, r)) {
    const p = c.get(sqOf(f, r));
    if (p) out.push({ sq: sqOf(f, r), type: p.type, color: p.color });
    f += df; r += dr;
  }
  return out;
}
/** Squares holding pieces that the piece on `s` attacks (either colour). */
export function attackedPieces(c: Chess, s: Square) {
  const p = c.get(s);
  const out: { sq: Square; type: PieceSymbol; color: Color }[] = [];
  if (!p) return out;
  const f0 = fileOf(s), r0 = rankOf(s);
  const push = (f: number, r: number) => {
    if (!onBoard(f, r)) return;
    const q = c.get(sqOf(f, r));
    if (q) out.push({ sq: sqOf(f, r), type: q.type, color: q.color });
  };
  if (p.type === 'p') {
    const d = p.color === 'w' ? 1 : -1;
    push(f0 - 1, r0 + d); push(f0 + 1, r0 + d);
  } else if (p.type === 'n' || p.type === 'k') {
    for (const [df, dr] of DIRS[p.type]) push(f0 + df, r0 + dr);
  } else {
    for (const [df, dr] of DIRS[p.type]) {
      const first = ray(c, s, df, dr)[0];
      if (first) out.push(first);
    }
  }
  return out;
}
export const isDefended = (c: Chess, s: Square, by: Color) => c.attackers(s, by).length > 0;

export function findKing(c: Chess, color: Color): Square {
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return 'e1';
}
export function pieces(c: Chess, color?: Color) {
  const out: { square: Square; type: PieceSymbol; color: Color }[] = [];
  for (const row of c.board()) for (const p of row) if (p && (!color || p.color === color)) out.push(p);
  return out;
}

export interface Material { w: number; b: number; wNonPawn: number; bNonPawn: number }
export function material(c: Chess): Material {
  const m = { w: 0, b: 0, wNonPawn: 0, bNonPawn: 0 };
  for (const p of pieces(c)) {
    if (p.type === 'k') continue;
    m[p.color] += VAL[p.type];
    if (p.type !== 'p') m[p.color === 'w' ? 'wNonPawn' : 'bNonPawn'] += VAL[p.type];
  }
  return m;
}

export type Phase = 'opening' | 'middlegame' | 'endgame';
export function phaseOf(fen: string): Phase {
  const c = new Chess(fen);
  const m = material(c);
  const np = m.wNonPawn + m.bNonPawn;
  const queens = pieces(c).filter((p) => p.type === 'q').length;
  if (np <= 14 || (queens === 0 && np <= 22)) return 'endgame';
  const moveNo = Number(fen.split(' ')[5]) || 1;
  if (moveNo <= 10) return 'opening';
  if (moveNo <= 14 && (undeveloped(c, 'w') >= 2 || undeveloped(c, 'b') >= 2)) return 'opening';
  return 'middlegame';
}
/** Minor pieces still on their starting squares. */
export function undeveloped(c: Chess, color: Color): number {
  const r = color === 'w' ? '1' : '8';
  let n = 0;
  for (const [s, t] of [['b' + r, 'n'], ['g' + r, 'n'], ['c' + r, 'b'], ['f' + r, 'b']] as const) {
    const p = c.get(s as Square);
    if (p && p.type === t && p.color === color) n++;
  }
  return n;
}
export function hasCastlingRights(fen: string, color: Color) {
  const r = fen.split(' ')[2];
  return color === 'w' ? /[KQ]/.test(r) : /[kq]/.test(r);
}
export function kingLooksCastled(c: Chess, color: Color) {
  const k = findKing(c, color);
  return rankOf(k) === (color === 'w' ? 0 : 7) && (fileOf(k) >= 6 || fileOf(k) <= 2);
}
/** Friendly pawns on the three files around the king, within two ranks in front of it. */
export function kingShield(c: Chess, color: Color): number {
  const k = findKing(c, color);
  const d = color === 'w' ? 1 : -1;
  let n = 0;
  for (let df = -1; df <= 1; df++) for (let dr = 1; dr <= 2; dr++) {
    const f = fileOf(k) + df, r = rankOf(k) + dr * d;
    if (!onBoard(f, r)) continue;
    const p = c.get(sqOf(f, r));
    if (p && p.type === 'p' && p.color === color) n++;
  }
  return n;
}

export interface PawnInfo { doubled: number; isolated: number; passed: Square[]; islands: number }
export function pawnInfo(c: Chess, color: Color): PawnInfo {
  const mine: number[][] = Array.from({ length: 8 }, () => []);
  const theirs: number[][] = Array.from({ length: 8 }, () => []);
  for (const p of pieces(c)) if (p.type === 'p') (p.color === color ? mine : theirs)[fileOf(p.square)].push(rankOf(p.square));
  let doubled = 0, isolated = 0, islands = 0;
  const passed: Square[] = [];
  for (let f = 0; f < 8; f++) {
    if (mine[f].length > 1) doubled += mine[f].length - 1;
    if (mine[f].length && !(mine[f - 1]?.length) && !(mine[f + 1]?.length)) isolated += mine[f].length;
    if (mine[f].length && !(mine[f - 1]?.length)) islands++;
    for (const r of mine[f]) {
      let blocked = false;
      for (const ff of [f - 1, f, f + 1]) for (const tr of theirs[ff] ?? []) {
        if (color === 'w' ? tr > r : tr < r) blocked = true;
      }
      if (!blocked) passed.push(sqOf(f, r));
    }
  }
  return { doubled, isolated, passed, islands };
}

/** The same position with the other side to move ("what if I pass?"). Null when illegal. */
export function nullMoveFen(fen: string): string | null {
  const c = new Chess(fen);
  if (c.isCheck() || c.isGameOver()) return null;
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  try { const n = new Chess(p.join(' ')); return n.isGameOver() ? null : n.fen(); } catch { return null; }
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Positions Stockfish can safely search: legal FEN, kings not touching, side not to move not in check. */
export function isSanePosition(fen: string): boolean {
  let c: Chess;
  try { c = new Chess(fen); } catch { return false; }
  const ps = pieces(c);
  if (ps.filter((p) => p.type === 'k' && p.color === 'w').length !== 1 || ps.filter((p) => p.type === 'k' && p.color === 'b').length !== 1) return false;
  const wk = findKing(c, 'w'), bk = findKing(c, 'b');
  if (Math.abs(fileOf(wk) - fileOf(bk)) <= 1 && Math.abs(rankOf(wk) - rankOf(bk)) <= 1) return false;
  if (ps.some((p) => p.type === 'p' && (p.square[1] === '1' || p.square[1] === '8'))) return false;
  const other = c.turn() === 'w' ? 'b' : 'w';
  return !c.isAttacked(findKing(c, other), c.turn());
}
