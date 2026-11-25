// Exercises from your own games: every serious mistake becomes a position to
// solve, so you practise exactly the moments you got wrong.
import type { GameRecord, MoveAnalysis } from '../analysis/types';
import type { Exercise } from './types';
import { WEAKNESS } from './themes';
import { colorName } from '../chess/util';

const TAG_THEME: Record<string, string> = {
  missed_fork: 'fork', missed_pin: 'pin', missed_skewer: 'skewer', missed_discovered: 'discovered',
  missed_free_material: 'capture_hanging', missed_mate: 'mate_in_2', hanging_pieces: 'defense', missed_threat: 'defense',
  missed_mating_threat: 'mating_threat', back_rank: 'back_rank', no_blunder_check: 'defense',
};

export function exercisesFromGame(g: GameRecord): Exercise[] {
  if (!g.analysis) return [];
  const out: Exercise[] = [];
  const opp = g.opponent.name;
  const byPly = new Map(g.analysis.moves.map((x) => [x.ply, x]));
  for (const m of g.analysis.moves) {
    if (m.color !== g.userColor) continue;
    if (!(m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss')) continue;
    if (!m.bestLineUci.length) continue;
    const primary = m.tags[0];
    const sign = m.color === 'w' ? 1 : -1;
    const moverBefore = m.evalBefore * sign;
    const defending = moverBefore < 150 && !!m.threatUci;
    // Two solver moves when the point only appears after a forcing first move.
    const n = m.bestLineUci.length >= 3 && m.motifsBest.length && isSetup(m) ? 3 : 1;
    const moveNo = Math.floor(m.ply / 2) + 1;
    const theme = defending ? 'defense' : TAG_THEME[primary?.key ?? ''] ?? (m.phase === 'endgame' ? 'eg_conversion' : m.phase === 'opening' ? 'opening' : 'advantage');
    out.push({
      id: `game-${g.id}-${m.ply}`, source: 'game', kind: 'own_mistake', theme, fen: m.fenBefore,
      solution: m.bestLineUci.slice(0, n), rating: estimateRating(m), phase: m.phase,
      title: `${colorName(g.userColor)} vs ${opp}, move ${moveNo}`,
      prompt: defending ? `Your opponent has a threat here. First work out what it is (tap "What are they threatening?" if you're stuck), then find the move that holds.` : `You played ${m.san} here. Find the stronger move.`,
      explanation: primary?.why ?? '', goal: defending ? 'hold' : 'best', evalCp: Math.round(moverBefore),
      played: m.uci, threat: defending ? m.threatUci : undefined, prevFen: byPly.get(m.ply - 1)?.fenBefore, lastMove: byPly.get(m.ply - 1)?.uci, gameId: g.id, ply: m.ply, weakness: primary?.key, tolerance: 4,
    });
  }
  return out;
}
function isSetup(m: MoveAnalysis) {
  return m.motifsBest.every((x) => x.kind === 'check');
}
function estimateRating(m: MoveAnalysis) {
  const k = m.tags[0]?.key ?? '';
  let r = 1300;
  if (k === 'missed_free_material' || k === 'hanging_pieces') r = 1000;
  else if (k === 'missed_fork' || k === 'missed_pin' || k === 'missed_threat') r = 1200;
  else if (k === 'missed_mate') r = 1100 + 150 * Math.max(0, m.bestLine.length / 2 - 1);
  else if (WEAKNESS[k]?.category === 'positional' || WEAKNESS[k]?.category === 'endgame') r = 1450;
  return Math.round(Math.min(2200, r) / 50) * 50;
}
