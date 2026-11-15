// Every bundled line is legal, every theory endgame has the verdict we teach,
// and every bank exercise has a legal solution.
import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { COURSES } from '../src/data/repertoire';
import { THEORY_ENDGAMES } from '../src/data/endgames';
import { BANK } from '../src/training/bank';
import { nodeEngine } from '../src/engine/node';
import { scoreOf } from '../src/engine/uci';
import { tryMove } from '../src/chess/util';
import { identifyOpening } from '../src/openings/identify';
import { WEAKNESSES, THEME_LABEL } from '../src/training/themes';

const e = nodeEngine();
afterAll(() => e.terminate());

describe('repertoire', () => {
  for (const c of COURSES) for (const l of c.lines) {
    it(`${c.name}: ${l.name} is legal`, () => {
      const ch = new Chess();
      for (const s of l.san.split(' ')) expect(() => ch.move(s), `${s} in ${l.id}`).not.toThrow();
      for (const k of Object.keys(l.notes ?? {})) expect(Number(k)).toBeLessThan(l.san.split(' ').length);
      if (l.trap) expect(l.trap.badPly).toBeLessThan(l.san.split(' ').length);
    });
  }
  it('openings are identified by name', () => {
    expect(identifyOpening(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'])?.name).toMatch(/Italian/);
    expect(identifyOpening(['e2e4', 'c7c6'])?.name).toMatch(/Caro-Kann/);
  });
});

describe('theory endgames: engine agrees with the verdict', () => {
  for (const t of THEORY_ENDGAMES) {
    it(t.title, async () => {
      const r = await e.analyze(t.fen, { depth: 22 });
      const s = scoreOf(r.lines[0]);
      if (t.goal === 'win') expect(s, `${t.id} eval ${s}`).toBeGreaterThan(250);
      else expect(Math.abs(s), `${t.id} eval ${s}`).toBeLessThan(80);
    }, 60000);
  }
});

describe('exercise bank', () => {
  it('every exercise is a legal position with a legal solution and known theme', () => {
    const themes = new Set([...Object.keys(THEME_LABEL)]);
    for (const x of BANK) {
      const c = new Chess(x.fen);
      for (const u of x.solution) expect(tryMove(c, u), `${x.id} ${u}`).toBeTruthy();
      expect(themes.has(x.theme), x.theme).toBe(true);
    }
  });
  it('every weakness can be trained by some theme', () => {
    for (const w of WEAKNESSES) expect(w.train.length).toBeGreaterThan(0);
  });
});
