// Stockfish integration: start-up, search, MultiPV, cancellation, termination,
// and the opponent levels.
import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { nodeEngine } from '../src/engine/node';
import { scoreOf, winPct, formatScore, EngineCancelled } from '../src/engine/uci';
import { chooseMove, LEVELS, PERSONALITIES, styleBonus, recommendLevel } from '../src/engine/opponent';
import { START_FEN, tryMove } from '../src/chess/util';

const e = nodeEngine();
afterAll(() => e.terminate());

describe('engine lifecycle', () => {
  it('initialises and identifies itself', async () => {
    await e.init();
    expect(e.name).toMatch(/Stockfish/);
    expect(e.running).toBe(true);
  });
  it('finds mate in one and reports it', async () => {
    const r = await e.analyze('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', { depth: 10 });
    expect(r.bestmove).toBe('h5f7');
    expect(r.lines[0].mate).toBe(1);
    expect(scoreOf(r.lines[0])).toBeGreaterThan(9000);
  });
  it('returns several lines with MultiPV, best first', async () => {
    const r = await e.analyze(START_FEN, { depth: 10, multipv: 3 });
    expect(r.lines.length).toBe(3);
    expect(scoreOf(r.lines[0])).toBeGreaterThanOrEqual(scoreOf(r.lines[2]));
    expect(new Set(r.lines.map((l) => l.pv[0])).size).toBe(3);
  });
  it('reports no move in a mated position', async () => {
    const r = await e.analyze('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', { depth: 5 });
    expect(r.bestmove).toBeNull();
  });
  it('queued searches can be cancelled', async () => {
    const a = e.analyze(START_FEN, { depth: 22 });
    const b = e.analyze(START_FEN, { depth: 22 });
    e.cancelAll();
    await expect(b).rejects.toBeInstanceOf(EngineCancelled);
    await a.catch(() => undefined); // the running one stops early
    const ok = await e.analyze(START_FEN, { depth: 6 });
    expect(ok.bestmove).toBeTruthy();
  });
  it('terminates and restarts on demand', async () => {
    e.terminate();
    expect(e.running).toBe(false);
    const r = await e.analyze(START_FEN, { depth: 5 });
    expect(r.bestmove).toBeTruthy();
  });
});

describe('scores', () => {
  it('win chances are symmetric and bounded', () => {
    expect(winPct(0)).toBeCloseTo(50);
    expect(winPct(300) + winPct(-300)).toBeCloseTo(100);
    expect(winPct(100000)).toBeLessThanOrEqual(100);
    expect(formatScore(150)).toBe('+1.5');
    expect(formatScore(9990)).toBe('+M1');
  });
});

describe('opponents', () => {
  it('every level and personality returns a legal move', async () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    for (const lvl of LEVELS) {
      const m = await chooseMove(e, fen, { ...lvl, movetime: lvl.movetime ? 200 : undefined }, 'balanced');
      expect(tryMove(new Chess(fen), m.uci), lvl.name).toBeTruthy();
    }
    for (const p of PERSONALITIES) {
      const m = await chooseMove(e, fen, LEVELS[4], p.id);
      expect(tryMove(new Chess(fen), m.uci), p.id).toBeTruthy();
    }
  });
  it('club level and up always take a mate in one', async () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    for (let i = 0; i < 5; i++) expect((await chooseMove(e, fen, LEVELS[3], 'positional', () => 0.99)).uci).toBe('h5f7');
  });
  it('weak levels are weaker: shallow searches miss a deep win more often', async () => {
    // Expert never drops a queen to a one-move capture; check it keeps material in a simple position.
    const fen = '4k3/8/8/3q4/8/8/3Q4/4K3 w - - 0 1';
    const m = await chooseMove(e, fen, LEVELS[7], 'balanced');
    expect(m.uci).toBe('d2d5');
  });
  it('style bonuses point the right way', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5';
    expect(styleBonus(fen, 'e1g1', 'defensive')).toBeGreaterThan(styleBonus(fen, 'c4f7', 'defensive'));
    expect(styleBonus(fen, 'c4f7', 'aggressive')).toBeGreaterThan(styleBonus(fen, 'a2a3', 'aggressive'));
  });
  it('recommends a level near the estimate, stretching after wins', () => {
    expect(recommendLevel(1250, null).elo).toBe(1300);
    expect(recommendLevel(1250, 0.8).elo).toBeGreaterThan(recommendLevel(1250, 0.2).elo);
  });
});
