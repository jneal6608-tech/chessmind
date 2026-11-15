// Chess rules as the app uses them: legal destinations (what the board offers),
// special moves, and game-ending conditions.
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { legalDests } from '../src/ui/Board';
import { tryMove, see, seeMove, phaseOf, nullMoveFen, pawnInfo, pvToSan, formatLine, START_FEN } from '../src/chess/util';

describe('legal move handling', () => {
  it('start position has 20 moves from 10 squares', () => {
    const d = legalDests(START_FEN);
    expect([...d.values()].flat().length).toBe(20);
    expect(d.get('g1' as never)).toEqual(expect.arrayContaining(['f3', 'h3']));
  });
  it('rejects illegal moves', () => {
    const c = new Chess();
    expect(tryMove(c, 'e2e5')).toBeNull();
    expect(tryMove(c, 'e7e5')).toBeNull(); // wrong side
    expect(c.history().length).toBe(0);
  });
  it('pinned pieces cannot move', () => {
    const d = legalDests('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(d.get('e2' as never)).toBeUndefined();
  });
});

describe('castling', () => {
  it('both sides, and the rook moves too', () => {
    const c = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    expect(legalDests(c.fen()).get('e1' as never)).toEqual(expect.arrayContaining(['g1', 'c1']));
    tryMove(c, 'e1g1');
    expect(c.get('f1')?.type).toBe('r');
    tryMove(c, 'e8c8');
    expect(c.get('d8')?.type).toBe('r');
  });
  it('not through check, not out of check', () => {
    expect(legalDests('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1').get('e1' as never)).not.toContain('g1');
    expect(legalDests('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1').get('e1' as never) ?? []).not.toContain('c1');
  });
  it('rights lost after the king moves', () => {
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    tryMove(c, 'e1f1'); tryMove(c, 'e8d8'); tryMove(c, 'f1e1'); tryMove(c, 'd8e8');
    expect(legalDests(c.fen()).get('e1' as never)).not.toContain('g1');
  });
});

describe('en passant', () => {
  it('available immediately and captures the pawn', () => {
    const c = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const m = tryMove(c, 'e5d6');
    expect(m?.flags).toContain('e');
    expect(c.get('d5')).toBeUndefined();
  });
  it('expires after one move', () => {
    const c = new Chess('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
    tryMove(c, 'd7d5'); tryMove(c, 'e1e2'); tryMove(c, 'e8e7');
    expect(tryMove(c, 'e5d6')).toBeNull();
  });
});

describe('promotion', () => {
  it('to each piece, including underpromotion', () => {
    for (const p of ['q', 'r', 'b', 'n']) {
      const c = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
      tryMove(c, 'e7e8' + p);
      expect(c.get('e8')?.type).toBe(p);
    }
  });
  it('capture-promotion', () => {
    const c = new Chess('3r4/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(tryMove(c, 'e7d8n')?.captured).toBe('r');
  });
});

describe('game end', () => {
  it('checkmate', () => {
    const c = new Chess();
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) tryMove(c, m);
    expect(c.isCheckmate()).toBe(true);
    expect(legalDests(c.fen()).size).toBe(0);
  });
  it('stalemate', () => {
    const c = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(c.isStalemate()).toBe(true);
  });
  it('threefold repetition and insufficient material', () => {
    const c = new Chess();
    for (let i = 0; i < 2; i++) for (const m of ['g1f3', 'g8f6', 'f3g1', 'f6g8']) tryMove(c, m);
    expect(c.isThreefoldRepetition()).toBe(true);
    expect(new Chess('8/8/4k3/8/8/2K5/5B2/8 w - - 0 1').isInsufficientMaterial()).toBe(true);
  });
  it('check is detected', () => {
    expect(new Chess('4k3/8/8/8/8/8/8/4KR2 b - - 0 1').isCheck()).toBe(false);
    expect(new Chess('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1').isCheck()).toBe(true);
  });
});

describe('board helpers', () => {
  it('static exchange evaluation', () => {
    // Free knight
    expect(see('4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', 'd5')).toBe(3);
    // Defended pawn: queen takes, pawn recaptures: not worth it
    expect(see('4k3/2p5/3p4/8/8/8/8/3QK3 w - - 0 1', 'd6')).toBe(0);
    expect(seeMove('4k3/2p5/3p4/8/8/8/8/3QK3 w - - 0 1', 'd1d6')).toBe(-8);
  });
  it('phase, null move, pawn structure, SAN lines', () => {
    expect(phaseOf(START_FEN)).toBe('opening');
    expect(phaseOf('8/5k2/8/8/8/8/2R2K2/8 w - - 0 60')).toBe('endgame');
    expect(nullMoveFen('4k3/8/8/8/8/8/8/4K2R w - - 0 1')?.split(' ')[1]).toBe('b');
    expect(nullMoveFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1')).toBeNull(); // in check
    const p = pawnInfo(new Chess('4k3/8/8/8/8/2P5/2P2P2/4K3 w - - 0 1'), 'w');
    expect(p.doubled).toBe(1); expect(p.isolated).toBe(3); expect(p.passed.length).toBe(3);
    expect(pvToSan(START_FEN, ['e2e4', 'e7e5', 'zzzz'])).toEqual(['e4', 'e5']);
    expect(formatLine('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2', ['Nf6', 'Bc4'])).toBe('2... Nf6 3. Bc4');
  });
});

import { isSanePosition } from '../src/chess/util';
describe('position sanity (protects the engine from crashing)', () => {
  it('rejects touching kings, missing kings, back-rank pawns, wrong side in check', () => {
    expect(isSanePosition(START_FEN)).toBe(true);
    expect(isSanePosition('8/8/8/8/8/2K5/3kp3/7Q w - - 0 1')).toBe(false);
    expect(isSanePosition('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(false);
    expect(isSanePosition('4k2P/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(false);
    expect(isSanePosition('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')).toBe(false);
    expect(isSanePosition('not a fen')).toBe(false);
  });
});
