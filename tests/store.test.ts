// Persistence: IndexedDB stores, backup export/import round trip, PGN import.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { games, attempts, kv, exportAll, importAll, wipeAll, srs, resetDbHandle } from '../src/store/db';
import { getSettings, saveSettings, clearSettingsCache, apiKey } from '../src/store/settings';
import { splitPgn, parseGame, clockTimes, sameGame } from '../src/services/importer';

const PGN = `[Event "Rated Rapid game"]
[White "someoneelse"]
[Black "MyName"]
[Result "0-1"]
[WhiteElo "1302"]
[BlackElo "1248"]
[TimeControl "600+0"]
[UTCDate "2026.11.01"]

1. e4 { [%clk 0:09:58] } e5 { [%clk 0:09:55] } 2. Qh5 { [%clk 0:09:50] } Nc6 { [%clk 0:09:40] } 3. Bc4 { [%clk 0:09:45] } g6 { [%clk 0:09:30] } 4. Qf3 { [%clk 0:09:40] } Nf6 { [%clk 0:09:20] } 0-1

[Event "Second"]
[White "MyName"]
[Black "x"]
[Result "1-0"]

1. f3 e5 2. g4 Qh4# 0-1`;

describe('persistence', () => {
  it('stores and reads games, attempts, settings', async () => {
    resetDbHandle();
    await wipeAll();
    const p = parseGame(splitPgn(PGN)[0], ['myname']);
    await games.put(p.rec);
    await attempts.add({ id: 'a1', exerciseId: 'x', date: 1, success: true, timeMs: 1, theme: 'fork', kind: 'tactic', rating: 1200, hints: 0, mode: 't' });
    await saveSettings({ playerName: 'Tester', aliases: ['MyName'] });
    clearSettingsCache();
    expect((await getSettings()).playerName).toBe('Tester');
    expect((await games.all()).length).toBe(1);
    expect((await attempts.all())[0].theme).toBe('fork');
  });
  it('backup round trip excludes the API key', async () => {
    await apiKey.set('sk-ant-secret');
    await srs.put({ exerciseId: 'x', due: 5, interval: 1, ease: 2.5, reps: 1, lapses: 0 });
    const dump = await exportAll();
    expect(dump).not.toContain('sk-ant-secret');
    await wipeAll();
    expect((await games.all()).length).toBe(0);
    await importAll(dump, 'replace');
    expect((await games.all()).length).toBe(1);
    expect((await srs.all()).length).toBe(1);
    expect(await kv.get('apiKey')).toBeUndefined();
    await expect(importAll('{"app":"other"}')).rejects.toThrow();
  });
});

describe('PGN import', () => {
  it('splits, finds the user colour, ratings, opening, clock times', () => {
    const parts = splitPgn(PGN);
    expect(parts.length).toBe(2);
    const a = parseGame(parts[0], ['MYNAME']);
    expect(a.colorKnown).toBe(true);
    expect(a.rec.userColor).toBe('b');
    expect(a.rec.opponent.elo).toBe(1302);
    expect(a.rec.userElo).toBe(1248);
    expect(a.rec.result).toBe('0-1');
    expect(a.rec.opening?.name).toBeTruthy();
    expect(a.rec.times?.length).toBe(8);
    expect(a.rec.times?.[2]).toBe(8000);
    const b = parseGame(parts[1], ['MyName']);
    expect(b.rec.userColor).toBe('w');
    expect(b.rec.moves).toEqual(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(sameGame(a.rec, { ...a.rec, id: 'other' })).toBe(true);
    expect(clockTimes('', '600+0')).toBeUndefined();
  });
});

import { getLessons, recordLesson, mergeLessons } from '../src/store/lessons';
describe('lesson progress', () => {
  it('is saved in the database and survives a backup round trip', async () => {
    resetDbHandle();
    await wipeAll();
    await recordLesson('cct', 1, 1);
    await recordLesson('cct', 0, 1);
    const l = await getLessons();
    expect(l.cct.times).toBe(2);
    expect(l.cct.right).toBe(0);
    const backup = await exportAll();
    expect(JSON.parse(backup).kv.lessons.cct).toBeTruthy();
    await wipeAll();
    expect(Object.keys(await getLessons())).toHaveLength(0);
    await importAll(backup, 'replace');
    expect((await getLessons()).cct.times).toBe(2);
  });
  it('importing merges with lessons done on this device', async () => {
    resetDbHandle();
    await wipeAll();
    await recordLesson('iqp', 2, 2);
    const backup = JSON.stringify({ app: 'ChessMind', version: 1, kv: { lessons: { cct: { completedAt: 1, right: 1, total: 1, times: 1 } } } });
    await importAll(backup, 'merge');
    const l = await getLessons();
    expect(Object.keys(l).sort()).toEqual(['cct', 'iqp']);
  });
  it('merge keeps the latest result and the most runs', () => {
    const m = mergeLessons({ a: { completedAt: 5, right: 1, total: 2, times: 3 } }, { a: { completedAt: 9, right: 2, total: 2, times: 1 } });
    expect(m.a).toEqual({ completedAt: 9, right: 2, total: 2, times: 3 });
  });
});
