// Game review and weakness classification on real positions.
import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { nodeEngine } from '../src/engine/node';
import { reviewGame, moveAccuracy, gameAccuracy, classOf } from '../src/analysis/review';
import { buildProfile } from '../src/analysis/profile';
import { estimateStrength, performance } from '../src/analysis/strength';
import { exercisesFromGame } from '../src/training/fromGames';
import { explainMove } from '../src/coach/explain';
import { answer, extractMove } from '../src/coach/assistant';
import type { GameRecord } from '../src/analysis/types';

const e = nodeEngine();
afterAll(() => e.terminate());

let n = 0;
export function gameFrom(pgn: string, userColor: 'w' | 'b', extra: Partial<GameRecord> = {}): GameRecord {
  const c = new Chess(); c.loadPgn(pgn);
  const h = c.history({ verbose: true });
  return { id: `t${++n}`, date: Date.now() - (100 - n) * 86400000, source: 'import', pgn, moves: h.map((m) => m.lan), sans: h.map((m) => m.san),
    userColor, result: (c.getHeaders().Result as GameRecord['result']) ?? '*', termination: '', opponent: { kind: 'ai', name: 'x', elo: 1300 }, ...extra };
}
// White hangs the queen (8.Qc1?? allows ...Bxc2? no: Qb1?? Nxb1), Black misses a free bishop.
const LONDON = '[Result "1-0"]\n\n1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 Qb6 6. Qb3 c4 7. Qc2 Bf5 8. Qc1 e6 9. Ngf3 Bd6 10. Bxd6 Qxb2 11. Qxb2 Ne4 12. Bc7 Nxc3 13. Qb1 Nxb1 14. Rxb1 O-O 15. Be2 b6 16. O-O 1-0';
// Scholar's mate: Black misses the threat on f7.
const SCHOLAR = '[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';

describe('move classification', () => {
  it('accuracy formula', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0);
    expect(moveAccuracy(30)).toBeLessThan(30);
    expect(gameAccuracy([100, 100, 10])).toBeLessThan(gameAccuracy([70, 70, 70]));
    expect(classOf(25, { book: false, forced: false, bestPlayed: false, missed: false, nearBest: false })).toBe('blunder');
    expect(classOf(12, { book: false, forced: false, bestPlayed: false, missed: true, nearBest: false })).toBe('miss');
    expect(classOf(30, { book: false, forced: true, bestPlayed: false, missed: false, nearBest: false })).toBe('forced');
  });
});

describe('game review', () => {
  it('finds the hung queen and names the cause', async () => {
    const g = gameFrom(LONDON, 'w');
    g.analysis = await reviewGame(g, e, 12);
    const qb1 = g.analysis.moves.find((m) => m.san === 'Qb1')!;
    expect(['mistake', 'blunder']).toContain(qb1.cls);
    expect(qb1.tags[0].key).toBe('hanging_pieces');
    expect(qb1.tags[0].confidence).toBeGreaterThanOrEqual(0.8);
    // Black's ...Bf5 left the bishop loose and White missed Qxf5
    const qc1 = g.analysis.moves.find((m) => m.san === 'Qc1')!;
    expect(qc1.bestSan).toBe('Qxf5');
    expect(qc1.tags.map((t) => t.key)).toContain('missed_free_material');
    expect(g.analysis.critical.length).toBeGreaterThan(0);
    expect(g.analysis.lessons.length).toBeGreaterThan(0);
    expect(g.analysis.phases.opening.moves).toBeGreaterThan(0);
    expect(g.analysis.accuracy.w).toBeGreaterThan(0);
    // Exercises built from the user's own mistakes
    const ex = exercisesFromGame(g);
    expect(ex.length).toBeGreaterThan(0);
    expect(ex.find((x) => x.ply === qc1.ply)?.solution[0]).toBe('c2f5');
    // Explanations cite engine facts
    const text = explainMove(qb1, 'beginner');
    expect(text.better).toContain(qb1.bestSan);
  });
  it('recognises a missed threat that leads to mate (scholar\'s mate)', async () => {
    const g = gameFrom(SCHOLAR, 'b');
    g.analysis = await reviewGame(g, e, 12);
    const nf6 = g.analysis.moves.find((m) => m.san === 'Nf6')!;
    expect(nf6.cls).toBe('blunder');
    expect(nf6.tags.map((t) => t.key)).toContain('missed_mating_threat');
    expect(nf6.threatSan).toBe('Qxf7#');
  });
  it('profile: recurring vs one-time, priorities, strength estimate', async () => {
    const games: GameRecord[] = [];
    for (let i = 0; i < 3; i++) {
      const g = gameFrom(SCHOLAR, 'b', { result: '1-0' });
      g.analysis = await reviewGame(g, e, 10);
      games.push(g);
    }
    const g2 = gameFrom(LONDON, 'w');
    g2.analysis = await reviewGame(g2, e, 10);
    games.push(g2);
    const p = buildProfile(games);
    const mt = p.stats.find((s) => s.key === 'missed_mating_threat')!;
    expect(mt.status).toBe('recurring');
    expect(mt.gamesAffected).toBeGreaterThanOrEqual(3);
    expect(p.top[0].key).toBe('missed_mating_threat');
    expect(p.stats.some((s) => s.status === 'one_time')).toBe(true);
    const s = estimateStrength(games, 1250);
    expect(s.rating).toBeLessThan(1250); // four losses
    expect(performance(games)).toBeLessThan(1300);
  }, 200000);
});

describe('built-in coach', () => {
  it('answers threat and move questions from engine facts', async () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    const t = await answer(e, fen, 'What is my opponent threatening?', 'beginner');
    expect(t.text).toContain('Qxf7#');
    const m = await answer(e, fen, 'Is Nf6 good?', 'beginner');
    expect(m.text).toMatch(/Nf6/);
    expect(m.text).toMatch(/M1|mate/i);
    expect(extractMove(new Chess(fen), 'what about g6?')).toBe('g7g6');
  });
});
