import { describe, it, expect, afterAll } from 'vitest';
import { compareMoves, analyzeCandidates, alternativeCaptures } from '../src/coach/compare';
import { nodeEngine } from '../src/engine/node';

const e = nodeEngine();
afterAll(() => e.terminate());

describe('comparing two moves', () => {
  it('finds both ways to take back', () => {
    // After 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6: Black can take back with the b- or d-pawn
    const fen = 'r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4';
    const alts = alternativeCaptures(fen);
    expect(alts[0].square).toBe('c6');
    expect(alts[0].sans.sort()).toEqual(['bxc6', 'dxc6']);
  });
  it('explains why one recapture is better than the other', async () => {
    const fen = 'r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4';
    const cands = await analyzeCandidates(e, fen, ['d7c6', 'b7c6'], 12);
    expect(cands.length).toBe(2);
    const cmp = compareMoves(fen, cands[0], cands[1]);
    expect(cmp.summary).toMatch(/xc6/);
    expect(cmp.reasons.length).toBeGreaterThan(0);
  }, 30000);
  it('a move that hangs the queen is explained by material', async () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const cands = await analyzeCandidates(e, fen, ['b8c6', 'd8g5'], 12);
    const cmp = compareMoves(fen, cands[0], cands[1]);
    expect(cmp.better.san).toBe('Nc6');
    expect(cmp.reasons.join(' ')).toMatch(/queen/);
  }, 30000);
});
