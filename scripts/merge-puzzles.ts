// Merges generator output into src/data/puzzles.json: de-duplicates, re-checks
// legality, re-tags themes with the current motif detectors, caps themes that
// self-play over-produces, and spreads difficulty ratings by rank.
// Usage: npx tsx scripts/merge-puzzles.ts
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { detectLineMotifs } from '../src/chess/motifs';
import { isBackRankMateLine } from '../src/analysis/classify';
import { tryMove } from '../src/chess/util';
import { themeFromMotifs } from '../src/training/themes';
import type { Exercise } from '../src/training/types';

// Start from the current bundled bank, then add new generator output.
const existing: Exercise[] = JSON.parse(readFileSync('src/data/puzzles.json', 'utf8'));
const fresh: Exercise[] = readdirSync('data-src/gen').filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(`data-src/gen/${f}`, 'utf8')));
const all: Exercise[] = [...existing, ...fresh];
const seen = new Set<string>();
const out: Exercise[] = [];
for (const x of all) {
  const key = x.fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key)) continue;
  const c = new Chess(x.fen);
  if (!x.solution.every((u) => tryMove(c, u))) continue;
  seen.add(key);
  if (x.kind === 'tactic' && x.goal === 'best') {
    const mate = x.evalCp !== undefined && x.evalCp >= 9000 ? Math.max(1, Math.round((10000 - x.evalCp) / 10)) : 0;
    const { motifs } = detectLineMotifs(x.fen, x.solution);
    if (mate && mate <= 3) x.theme = isBackRankMateLine(x.fen, x.solution) ? 'back_rank' : `mate_in_${mate}`;
    else x.theme = themeFromMotifs(motifs);
    if (motifs.length) x.explanation = motifs.map((m) => m.text).join('; ');
  }
  x.prompt = x.goal === 'hold' ? (x.theme === 'mating_threat' ? 'Your opponent threatens mate. Find the only move that stops it.' : 'Your opponent has a threat. First work out what it is, then find the only move that holds.')
    : x.goal === 'best' ? (x.theme.startsWith('mate') || x.theme === 'back_rank' ? 'There is a forced checkmate. Find it.' : 'Your opponent just made a mistake. Find the move that punishes it.')
      : x.goal === 'win' ? 'You are winning. Convert it against Stockfish: promote or mate.' : 'Hold the draw against Stockfish.';
  if (x.kind === 'endgame') x.explanation = x.goal === 'win' ? 'Activate your king, push passed pawns, avoid counterplay.' : 'Keep your pieces active and your king in front of the pawns.';
  out.push(x);
}
const CAPS: Record<string, number> = { capture_hanging: 130, winning_capture: 110, defense: 160 };
const by: Record<string, Exercise[]> = {};
for (const x of out) (by[x.theme] ??= []).push(x);
const kept: Exercise[] = [];
for (const [t, xs] of Object.entries(by)) {
  // When capping, keep puzzles that know the opponent's last move first (it can be shown
  // and replayed), then the hardest-looking ones (higher raw rating first).
  xs.sort((a, b) => Number(!!b.lastMove) - Number(!!a.lastMove) || b.rating - a.rating);
  const eg = xs.filter((x) => x.phase === 'endgame'), rest = xs.filter((x) => x.phase !== 'endgame');
  kept.push(...eg, ...rest.slice(0, CAPS[t] ?? 10000));
}
// Rank-based spread of raw difficulty into ~700-1900, so every level has material.
const tactics = kept.filter((x) => x.kind === 'tactic').sort((a, b) => a.rating - b.rating || a.solution.length - b.solution.length);
tactics.forEach((x, i) => {
  const base = 700 + Math.round((i / Math.max(1, tactics.length - 1)) * 1200);
  const bonus = x.theme === 'mate_in_3' ? 150 : x.theme === 'mate_in_2' ? 80 : x.theme === 'mate_in_1' ? -150 : 0;
  x.rating = Math.round(Math.max(600, Math.min(2200, base + bonus)) / 25) * 25;
});
// Stable ids (hash of the position), so attempt history survives bank updates.
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
kept.forEach((x) => { x.id = `bank-${hash(x.fen.split(' ').slice(0, 4).join(' '))}`; });
writeFileSync('src/data/puzzles.json', JSON.stringify(kept));
const count: Record<string, number> = {};
for (const x of kept) count[x.theme] = (count[x.theme] ?? 0) + 1;
console.log(kept.length, 'exercises', count);
