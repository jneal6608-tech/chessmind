import { describe, it, expect } from 'vitest';
import { nextCard, themeRatings } from '../src/training/srs';
import { pick } from '../src/training/select';
import type { Exercise } from '../src/training/types';
import type { Attempt } from '../src/store/db';

const DAY = 86400000;
const ex = (id: string, theme: string, rating: number, source: Exercise['source'] = 'bank'): Exercise =>
  ({ id, source, kind: source === 'game' ? 'own_mistake' : 'tactic', theme, fen: '', solution: [], rating, phase: 'middlegame', prompt: '', explanation: '', goal: 'best' });
const att = (exerciseId: string, theme: string, rating: number, success: boolean, t: number): Attempt =>
  ({ id: exerciseId + t, exerciseId, date: t, success, timeMs: 10000, theme, kind: 'tactic', rating, hints: 0, mode: 'tactics' });

describe('spaced repetition', () => {
  it('failures come back tomorrow, successes at growing intervals', () => {
    const now = 1_000_000_000_000;
    const f = nextCard(undefined, 'x', false, 5000, now);
    expect(f.due - now).toBe(DAY);
    let c = nextCard(undefined, 'x', true, 5000, now);
    const i1 = c.interval;
    c = nextCard(c, 'x', true, 5000, now);
    c = nextCard(c, 'x', true, 5000, now);
    expect(c.interval).toBeGreaterThan(i1 * 2);
    const lapse = nextCard(c, 'x', false, 5000, now);
    expect(lapse.interval).toBe(1);
    expect(lapse.ease).toBeLessThan(c.ease);
  });
});

describe('adaptive difficulty', () => {
  it('theme rating rises with success and falls with failure', () => {
    const ups = Array.from({ length: 6 }, (_, i) => att('a' + i, 'fork', 1250, true, i));
    const downs = Array.from({ length: 6 }, (_, i) => att('b' + i, 'pin', 1250, false, i));
    const r = themeRatings([...ups, ...downs], 1250);
    expect(r.fork).toBeGreaterThan(1350);
    expect(r.pin).toBeLessThan(1150);
  });
  it('selection: due reviews first, then own mistakes, then exercises near the level; no repeats', () => {
    const exercises = [
      ex('own1', 'fork', 1200, 'game'), ex('due1', 'fork', 1300), ex('easy', 'fork', 700), ex('near', 'fork', 1300), ex('hard', 'fork', 2300), ex('done', 'fork', 1300),
    ];
    const now = 2_000_000_000_000;
    const cards = new Map([['due1', { exerciseId: 'due1', due: now - 1, interval: 1, ease: 2.3, reps: 0, lapses: 1, lastSuccess: false }]]);
    const attempts = [att('done', 'fork', 1300, true, now - DAY), att('due1', 'fork', 1300, false, now - 2 * DAY)];
    const got = pick({ exercises, cards, attempts, base: 1250, now }, { themes: ['fork'], count: 3, seed: 1 }).map((e) => e.id);
    expect(got[0]).toBe('due1');
    expect(got).toContain('own1');
    expect(got).toContain('near');
    expect(got).not.toContain('done');
    expect(got).not.toContain('hard');
  });
  it('difficulty follows the player: a strong theme rating gets harder positions', () => {
    const exercises = [ex('e1', 'pin', 900), ex('e2', 'pin', 1300), ex('e3', 'pin', 1800)];
    const strong = Array.from({ length: 12 }, (_, i) => att('s' + i, 'pin', 1700, true, i));
    const got = pick({ exercises, cards: new Map(), attempts: strong, base: 1250, now: 1e12 }, { themes: ['pin'], count: 1, seed: 3 });
    expect(got[0].id).toBe('e3');
  });
});
