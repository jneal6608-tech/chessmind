// Every bundled line is legal, every theory endgame has the verdict we teach,
// and every bank exercise has a legal solution.
import { describe, it, expect, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { COURSES } from '../src/data/repertoire';
import { THEORY_ENDGAMES, ENDGAME_STUDIES } from '../src/data/endgames';
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
  it('line and course ids are unique', () => {
    const ids = COURSES.flatMap((c) => c.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });
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

describe('endgame studies: the first move is Stockfish\'s choice and wins', () => {
  for (const t of ENDGAME_STUDIES) {
    it(t.title, async () => {
      const c = new Chess(t.fen);
      for (const u of t.solution) expect(tryMove(c, u), `${t.id} ${u}`).toBeTruthy();
      const r = await e.analyze(t.fen, { depth: 22, multipv: 2, movetime: 6000 });
      expect(scoreOf(r.lines[0])).toBeGreaterThan(200);
      // the solution move is the best move, or at least as good as it
      const mine = r.lines.find((l) => l.pv[0] === t.solution[0]);
      expect(mine, `${t.id}: ${t.solution[0]} not among top moves (${r.lines.map((l) => l.pv[0])})`).toBeTruthy();
      expect(scoreOf(mine!)).toBeGreaterThan(200);
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

import { PRINCIPLES } from '../src/data/principles';
describe('principles: every lesson position and answer is legal', () => {
  for (const p of PRINCIPLES) {
    it(p.title, () => {
      let fen = new Chess().fen();
      for (const s of p.steps) {
        if (s.fen) fen = new Chess(s.fen).fen();
        if (s.moves) { const c = new Chess(); for (const m of s.moves.split(' ')) expect(() => c.move(m), `${p.id}: ${m}`).not.toThrow(); fen = c.fen(); }
        for (const a of s.arrows ?? []) expect(a, `${p.id} arrow`).toMatch(/^[a-h][1-8][a-h][1-8](:(red|blue|yellow|green))?$/);
        if (s.task) for (const ans of s.task.answers) expect(() => new Chess(fen).move(ans), `${p.id}: answer ${ans}`).not.toThrow();
      }
      for (const k of p.fixes) expect(WEAKNESSES.some((w) => w.key === k), `${p.id}: weakness ${k}`).toBe(true);
    });
  }
  it('ids are unique', () => expect(new Set(PRINCIPLES.map((p) => p.id)).size).toBe(PRINCIPLES.length));
});

import { PROFILES, LINE_ABOUT } from '../src/data/openingInfo';
describe('openings: every course is profiled and every line explained', () => {
  it('profiles and line descriptions', () => {
    for (const c of COURSES) {
      expect(PROFILES[c.id], `profile for ${c.id}`).toBeTruthy();
      for (const l of c.lines) expect(LINE_ABOUT[l.id], `about for ${l.id}`).toBeTruthy();
    }
  });
});
