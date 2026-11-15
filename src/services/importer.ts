// PGN import (paste, file, or fetched from Lichess / Chess.com) and export.
import { Chess } from 'chess.js';
import type { GameRecord } from '../analysis/types';
import { identifyOpening } from '../openings/identify';
import { uid } from '../chess/util';

export function splitPgn(text: string): string[] {
  const norm = text.replace(/\r\n?/g, '\n').trim();
  if (!norm) return [];
  const parts = norm.split(/\n\s*\n(?=\[Event )/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export interface ParsedGame { rec: GameRecord; white: string; black: string; colorKnown: boolean }

/** Parse one PGN. `names` are the user's names/aliases (case-insensitive). */
export function parseGame(pgn: string, names: string[], fallbackColor: 'w' | 'b' = 'w'): ParsedGame {
  const c = new Chess();
  c.loadPgn(pgn, { strict: false });
  const h = c.getHeaders();
  const verbose = c.history({ verbose: true });
  const white = h.White ?? '?', black = h.Black ?? '?';
  const lower = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  let userColor: 'w' | 'b' = fallbackColor;
  let colorKnown = false;
  if (lower.includes(white.toLowerCase())) { userColor = 'w'; colorKnown = true; } else if (lower.includes(black.toLowerCase())) { userColor = 'b'; colorKnown = true; }
  const startFen = h.SetUp === '1' && h.FEN ? h.FEN : undefined;
  const result = (['1-0', '0-1', '1/2-1/2'].includes(h.Result ?? '') ? h.Result : c.isCheckmate() ? (c.turn() === 'w' ? '0-1' : '1-0') : '*') as GameRecord['result'];
  const oppElo = Number(userColor === 'w' ? h.BlackElo : h.WhiteElo) || undefined;
  const myElo = Number(userColor === 'w' ? h.WhiteElo : h.BlackElo) || undefined;
  const date = parseDate(h.UTCDate ?? h.Date, h.UTCTime ?? h.StartTime);
  // Clock comments ([%clk 0:09:58]) give the time spent per move.
  const times = clockTimes(pgn, h.TimeControl);
  const rec: GameRecord = {
    id: uid(), date, source: 'import', pgn, startFen, moves: verbose.map((m) => m.lan), sans: verbose.map((m) => m.san),
    times: times && times.length === verbose.length ? times : undefined, userColor, result,
    termination: h.Termination ?? '', opponent: { kind: 'human', name: userColor === 'w' ? black : white, elo: oppElo },
    timeControl: h.TimeControl, opening: identifyOpening(verbose.map((m) => m.lan), startFen), userElo: myElo,
  };
  return { rec, white, black, colorKnown };
}
function parseDate(d?: string, t?: string) {
  if (!d || d.includes('?')) return Date.now();
  const iso = d.replace(/\./g, '-') + 'T' + (t && /^\d\d:\d\d/.test(t) ? t : '12:00:00') + 'Z';
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : Date.now();
}
export function clockTimes(pgn: string, tc?: string): number[] | undefined {
  const clk = [...pgn.matchAll(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map((m) => (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
  if (clk.length < 2 || !tc || !/^\d+\+\d+$/.test(tc)) return undefined;
  const [base, inc] = tc.split('+').map((x) => Number(x) * 1000);
  const out: number[] = [];
  const last = [base, base];
  clk.forEach((v, i) => { const side = i % 2; out.push(Math.max(0, last[side] - v + inc)); last[side] = v; });
  return out;
}

/** Fetch recent games. Both APIs allow browser requests (CORS). */
export async function fetchLichess(user: string, max = 20): Promise<string> {
  const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=${max}&clocks=true&opening=false&perfType=rapid,classical,blitz`, { headers: { Accept: 'application/x-chess-pgn' } });
  if (r.status === 404) throw new Error(`Lichess user "${user}" not found.`);
  if (!r.ok) throw new Error(`Lichess returned ${r.status}.`);
  return r.text();
}
export async function fetchChessCom(user: string, max = 20): Promise<{ pgn: string; rapid?: number }> {
  const u = encodeURIComponent(user.toLowerCase());
  const a = await fetch(`https://api.chess.com/pub/player/${u}/games/archives`);
  if (a.status === 404) throw new Error(`Chess.com user "${user}" not found.`);
  if (!a.ok) throw new Error(`Chess.com returned ${a.status}.`);
  const { archives } = (await a.json()) as { archives: string[] };
  const pgns: string[] = [];
  for (const url of archives.slice().reverse()) {
    const m = await fetch(url);
    if (!m.ok) break;
    const { games } = (await m.json()) as { games: { pgn?: string; rules: string }[] };
    for (const g of games.reverse()) if (g.pgn && g.rules === 'chess') pgns.push(g.pgn);
    if (pgns.length >= max) break;
  }
  let rapid: number | undefined;
  try {
    const s = await fetch(`https://api.chess.com/pub/player/${u}/stats`);
    if (s.ok) rapid = ((await s.json()) as { chess_rapid?: { last?: { rating?: number } } }).chess_rapid?.last?.rating;
  } catch { /* optional */ }
  return { pgn: pgns.slice(0, max).join('\n\n'), rapid };
}

export function exportPgn(gs: GameRecord[]) {
  return gs.map((g) => g.pgn.trim()).join('\n\n') + '\n';
}
export function download(name: string, text: string, type = 'application/x-chess-pgn') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Same game already stored? (matching moves and players) */
export function sameGame(a: GameRecord, b: GameRecord) {
  return a.moves.join(' ') === b.moves.join(' ') && a.opponent.name === b.opponent.name && Math.abs(a.date - b.date) < 86400000 * 2;
}
