// Generates the bundled exercise bank from engine self-play. Every exercise is
// verified by Stockfish: a unique winning (or only saving) move, checked again
// at higher depth. Usage: npx tsx scripts/gen-puzzles.ts <seed> <games> <out.json>
import { writeFileSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { nodeEngine } from '../src/engine/node';
import { scoreOf, winPct, type EvalLine } from '../src/engine/uci';
import { detectLineMotifs, detectMotifs } from '../src/chess/motifs';
import { phaseOf, tryMove, nullMoveFen, material, pieces, seeMove } from '../src/chess/util';
import { endgameType, themeFromMotifs } from '../src/training/themes';
import type { Exercise } from '../src/training/types';

const [seedArg, gamesArg, outPath] = process.argv.slice(2);
let seed = Number(seedArg) || 1;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const openings = Object.values(JSON.parse(readFileSync('src/data/openings.json', 'utf8')) as Record<string, [string, string, number, string]>)
  .filter((o) => o[2] >= 4 && o[2] <= 12);
const e = nodeEngine();
const out: Exercise[] = [];
const seen = new Set<string>();

function rateDifficulty(trail: string[], best: string, nPlayerMoves: number, theme: string): number {
  // depth at which the engine first settles on the solution move ~ how hidden it is
  let settled = trail.length;
  for (let d = trail.length - 1; d >= 1; d--) { if (trail[d] && trail[d] !== best) break; settled = d; }
  let r = 900 + settled * 70 + (nPlayerMoves - 1) * 220;
  if (theme === 'capture_hanging') r -= 250;
  if (theme === 'mate_in_1') r -= 200;
  if (theme === 'defense') r += 100;
  return Math.max(600, Math.min(2400, Math.round(r / 50) * 50));
}

/** Unique solution: the best line is far ahead of the runner-up (mates: the runner-up is not a mate). */
function clearlyBest(a: EvalLine, b: EvalLine, gap: number) {
  if (a.mate !== undefined && a.mate > 0) return b.mate === undefined || b.mate <= 0 ? scoreOf(b) < 500 : b.mate > a.mate + 2 && false;
  return winPct(scoreOf(a)) - winPct(scoreOf(b)) >= gap;
}
async function lines(fen: string, depth: number, multipv: number) {
  return (await e.analyze(fen, { depth, multipv })).lines;
}

/** Extend the solution while the solver keeps having a single clearly-best move. */
async function buildSolution(fen: string, first: EvalLine[]): Promise<string[]> {
  const sol = [first[0].pv[0]];
  const c = new Chess(fen);
  tryMove(c, sol[0]);
  for (let k = 0; k < 2; k++) {
    if (c.isGameOver()) break;
    const reply = (await lines(c.fen(), 12, 1))[0];
    if (!reply) break;
    const r = reply.pv[0];
    tryMove(c, r);
    if (c.isGameOver()) { c.undo(); break; }
    const nx = await lines(c.fen(), 13, 2);
    if (nx.length < 2) { c.undo(); break; }
    const material0 = scoreOf(nx[0]);
    if (!clearlyBest(nx[0], nx[1], 20)) { c.undo(); break; }
    if (material0 < 200) { c.undo(); break; }
    sol.push(r, nx[0].pv[0]);
    tryMove(c, nx[0].pv[0]);
  }
  return sol;
}

const F: Record<string, number> = {};
const CAP: Record<string, number> = { capture_hanging: 15, winning_capture: 15 };
const f = (k: string) => { F[k] = (F[k] ?? 0) + 1; };
async function considerTactic(fen: string, prevScoreForMover: number) {
  const ls = await lines(fen, 12, 2);
  if (ls.length < 2) return;
  f('t0'); if (scoreOf(ls[0]) >= 250) f('t_win');
  const s0 = scoreOf(ls[0]);
  if (s0 < 250 || !clearlyBest(ls[0], ls[1], 20)) return;
  f('t_unique');
  if (prevScoreForMover > 150) return; f('t_fresh'); // already winning before the blunder: not a puzzle moment
  const deep = await e.analyze(fen, { depth: 16, multipv: 2 });
  if (deep.lines.length < 2 || deep.lines[0].pv[0] !== ls[0].pv[0]) return;
  if (!clearlyBest(deep.lines[0], deep.lines[1], 18)) return;
  f('t_deep');
  const sol = await buildSolution(fen, deep.lines);
  const mate = deep.lines[0].mate;
  const { motifs } = detectLineMotifs(fen, deep.lines[0].pv);
  let theme = mate !== undefined && mate > 0 && mate <= 3 ? `mate_in_${mate}` : themeFromMotifs(motifs);
  if (motifs.some((m) => m.kind === 'back_rank_mate') || (theme.startsWith('mate') && isBackRank(fen, deep.lines[0].pv))) theme = 'back_rank';
  if (!theme) return;
  if ((CAP[theme] ?? 999) <= (F['t_' + theme] ?? 0)) return;
  f('t_' + theme);
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key)) return;
  seen.add(key);
  const nPlayer = Math.ceil(sol.length / 2);
  out.push({
    id: `bank-${theme}-${out.length}-${seedArg}`, source: 'bank', kind: 'tactic', theme, fen, solution: sol,
    rating: rateDifficulty(deep.depthTrail, sol[0], nPlayer, theme), phase: phaseOf(fen),
    prompt: '', explanation: motifs.map((m) => m.text).join('; '),
    goal: 'best', evalCp: scoreOf(deep.lines[0]),
  });
}
function isBackRank(fen: string, pv: string[]) {
  const c = new Chess(fen);
  for (const u of pv.slice(0, 5)) if (!tryMove(c, u)) return false;
  if (!c.isCheckmate()) return false;
  const k = pieces(c).find((p) => p.type === 'k' && p.color === c.turn())!;
  return k.square[1] === (c.turn() === 'w' ? '1' : '8');
}

/** "Your opponent threatens something": only one move holds the balance. */
async function considerDefense(fen: string) {
  const nm = nullMoveFen(fen);
  if (!nm) return;
  const s = await lines(fen, 12, 3);
  if (s.length < 3) return;
  const s0 = scoreOf(s[0]);
  if (s0 < -150 || s0 > 200) return;
  if (winPct(s0) - winPct(scoreOf(s[1])) < 25) return;
  const threat = (await lines(nm, 11, 1))[0];
  if (!threat || scoreOf(threat) < 250) return;
  const tm = detectMotifs(nm, threat.pv[0]);
  const deep = await e.analyze(fen, { depth: 16, multipv: 2 });
  if (deep.lines.length < 2 || deep.lines[0].pv[0] !== s[0].pv[0]) return;
  if (winPct(scoreOf(deep.lines[0])) - winPct(scoreOf(deep.lines[1])) < 20) return;
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key)) return;
  seen.add(key);
  const theme = tm.some((m) => m.kind === 'mate' || m.kind === 'back_rank_mate') || threat.mate !== undefined ? 'mating_threat' : 'defense';
  if (theme === 'defense' && (F.defense = (F.defense ?? 0) + 1) > 25) return;
  out.push({
    id: `bank-${theme}-${out.length}-${seedArg}`, source: 'bank', kind: 'tactic', theme, fen, solution: [deep.lines[0].pv[0]],
    rating: rateDifficulty(deep.depthTrail, deep.lines[0].pv[0], 1, 'defense'), phase: phaseOf(fen),
    prompt: '', explanation: tm.map((m) => m.text).join('; '), threat: threat.pv[0],
    goal: 'hold', evalCp: scoreOf(deep.lines[0]),
  });
}

async function considerEndgame(fen: string) {
  const type = endgameType(fen);
  if (!type) return;
  const c = new Chess(fen);
  if (pieces(c).length > 12 || c.isCheck()) return;
  const ls = await lines(fen, 16, 1);
  if (!ls.length) return;
  const sc = scoreOf(ls[0]);
  let goal: 'win' | 'draw' | null = null;
  if (sc >= 250 && sc < 9000) goal = 'win';
  else if (Math.abs(sc) <= 40 && material(c)[c.turn()] < material(c)[c.turn() === 'w' ? 'b' : 'w']) goal = 'draw';
  if (!goal) return;
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    id: `bank-eg-${type}-${out.length}-${seedArg}`, source: 'bank', kind: 'endgame', theme: type, fen, solution: [ls[0].pv[0]],
    rating: goal === 'win' ? 1100 + Math.min(800, Math.max(0, 600 - sc)) : 1500, phase: 'endgame',
    prompt: '', explanation: '', goal, evalCp: sc,
  });
}

async function selfPlay() {
  const op = openings[Math.floor(rand() * openings.length)];
  const c = new Chess();
  for (const u of op[3].split(' ')) tryMove(c, u);
  let prev = 0;
  const egTaken = { n: 0 };
  let lopsided = 0;
  for (let ply = 0; ply < 160 && !c.isGameOver(); ply++) {
    const fen = c.fen();
    const r = await e.analyze(fen, { depth: 5 + Math.floor(rand() * 4), multipv: 4 });
    if (!r.lines.length) break;
    // Tactic opportunities show up after a weak move by the side that just moved.
    if (c.moveNumber() > 6) await considerTactic(fen, -prev);
    if (rand() < 0.25 && c.moveNumber() > 8) await considerDefense(fen);
    if (phaseOf(fen) === 'endgame' && egTaken.n < 3 && rand() < 0.3) { await considerEndgame(fen); egTaken.n++; }
    // Pick a human-ish move: mostly good, sometimes the 2nd-4th choice.
    const best = scoreOf(r.lines[0]);
    // Once one side is clearly winning, the game stops producing fresh puzzle moments (endgames excepted).
    lopsided = Math.abs(best) > 450 && phaseOf(fen) !== 'endgame' ? lopsided + 1 : 0;
    if (lopsided >= 4) break;
    const ok = r.lines.filter((l) => best - scoreOf(l) <= (rand() < 0.22 ? 700 : 60));
    let pick = ok[Math.floor(rand() * ok.length)] ?? r.lines[0];
    if (ply > 8 && rand() < 0.16) {
      // A human-like oversight: a move that looks fine at depth 1 but walks into a tactic.
      const shallow = await e.analyze(fen, { depth: 1, multipv: 10 });
      const cand = shallow.lines.filter((l) => l.pv.length);
      const pk = cand[Math.floor(rand() * cand.length)];
      if (pk) pick = { pv: [pk.pv[0]], depth: 1, cp: best - 300 };
    } else if (ply > 10 && rand() < 0.03) {
      const legal = c.moves({ verbose: true });
      const mv = legal[Math.floor(rand() * legal.length)];
      pick = { pv: [mv.lan], depth: 0, cp: best - 300 };
    }
    prev = best; // the mover's evaluation before their move (best play)
    if (Math.abs(scoreOf(pick)) > 1500 && ply > 20) break;
    tryMove(c, pick.pv[0]);
  }
}

const games = Number(gamesArg) || 10;
for (let g = 0; g < games; g++) {
  await selfPlay();
  if (g % 5 === 4) { writeFileSync(outPath, JSON.stringify(out)); console.error(`seed ${seedArg}: game ${g + 1}/${games}, ${out.length} items`, JSON.stringify(F)); }
}
writeFileSync(outPath, JSON.stringify(out));
e.terminate();
void seeMove;
