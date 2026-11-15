import { describe, it, expect } from 'vitest';
import { detectMotifs } from '../src/chess/motifs';
const kinds = (fen: string, uci: string) => detectMotifs(fen, uci).map((m) => m.kind);

describe('tactical motif detection', () => {
  it('knight fork of king and rook', () => {
    expect(kinds('4k3/8/8/8/1n6/8/8/R3K3 b - - 0 1', 'b4c2')).toContain('fork');
  });
  it('royal fork: knight hits king and queen', () => {
    expect(kinds('q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7')).toContain('fork');
  });
  it('a fork on a square where the knight is simply taken is not counted', () => {
    expect(kinds('3qk3/4b3/8/4N3/8/8/8/4K3 w - - 0 1', 'e5c6')).not.toContain('fork');
  });
  it('absolute pin', () => {
    expect(kinds('4k3/4n3/8/8/8/8/8/2B1K3 w - - 0 1', 'c1g5')).not.toContain('pin'); // not on a line with the king
    expect(kinds('4k3/3n4/8/8/8/8/8/B3K3 w - - 0 1', 'a1b2')).not.toContain('pin');
    expect(kinds('4k3/3n4/8/8/8/8/8/4K1B1 w - - 0 1', 'g1a7')).not.toContain('pin');
    expect(kinds('6k1/5n2/8/8/8/8/4B3/4K3 w - - 0 1', 'e2c4')).toContain('pin');
  });
  it('skewer: king in front of a rook', () => {
    expect(kinds('8/8/8/8/8/1k6/8/r3K2R w - - 0 1', 'h1h3')).not.toContain('skewer');
    expect(kinds('8/qk6/8/8/8/8/8/4K2R w - - 0 1', 'h1h7')).toContain('skewer');
    // Rook behind a defending king: just a trade, not a skewer
    expect(kinds('8/rk6/8/8/8/8/8/4K2R w - - 0 1', 'h1h7')).not.toContain('skewer');
  });
  it('discovered attack', () => {
    expect(kinds('3qk3/8/8/8/8/3N4/8/3RK3 w - - 0 1', 'd3f4')).toContain('discovered');
  });
  it('capturing a hanging piece', () => {
    expect(kinds('4k3/8/8/3r4/8/8/8/3RK3 w - - 0 1', 'd1d5')).toContain('capture_hanging');
  });
  it('mates, including back-rank mate', () => {
    expect(kinds('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8')).toContain('back_rank_mate');
    expect(kinds('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', 'd8h4')).toContain('mate');
  });
});

import { isBackRankMateLine } from '../src/analysis/classify';
describe('back-rank mate recognition', () => {
  it('true back-rank mate', () => {
    expect(isBackRankMateLine('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', ['a1a8'])).toBe(true);
  });
  it("scholar's mate is not a back-rank mate", () => {
    expect(isBackRankMateLine('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', ['h5f7'])).toBe(false);
  });
});
