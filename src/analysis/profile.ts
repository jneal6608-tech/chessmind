// The weakness profile: aggregates classified mistakes across all analysed
// games (and training results) into recurring / developing / improving /
// one-time weaknesses, and ranks what costs the most games.
import type { GameRecord, MoveAnalysis } from './types';
import type { Attempt } from '../store/db';
import { WEAKNESS, WEAKNESSES, type Category } from '../training/themes';

export type Status = 'recurring' | 'developing' | 'improving' | 'one_time' | 'none';

export interface WeaknessStat {
  key: string;
  label: string;
  category: Category;
  /** Number of distinct incidents across all games (confidence >= 0.4). */
  incidents: number;
  gamesAffected: number;
  /** Severity-weighted cost per analysed game, recent window and earlier window. */
  rateRecent: number;
  rateEarlier: number;
  rateAll: number;
  /** Incidents inside games you lost or drew from a better position. */
  inLosses: number;
  /** Mean classifier confidence. */
  confidence: number;
  status: Status;
  /** Training success rate on the themes that train it (null = not trained yet). */
  training: { attempts: number; success: number } | null;
  priority: number;
  examples: { gameId: string; ply: number; why: string }[];
  /** Per-game severity series for trend charts (chronological). */
  series: number[];
}
export interface Profile {
  games: number;
  stats: WeaknessStat[];
  top: WeaknessStat[];
  byCategory: Record<Category, number>;
  updated: number;
}

const SEV: Record<string, number> = { blunder: 3, miss: 2.2, mistake: 2, inaccuracy: 0.6 };
const RECENT = 6;

export function incidentWeight(m: MoveAnalysis, confidence: number) {
  return (SEV[m.cls] ?? 0) * confidence;
}
const userLost = (g: GameRecord) => (g.result === '1-0' && g.userColor === 'b') || (g.result === '0-1' && g.userColor === 'w');

export function buildProfile(gamesIn: GameRecord[], attempts: Attempt[] = []): Profile {
  const games = gamesIn.filter((g) => g.analysis).sort((a, b) => a.date - b.date);
  const n = games.length;
  const recentStart = Math.max(0, n - RECENT);
  const map = new Map<string, WeaknessStat & { _conf: number[]; _games: Set<string> }>();
  for (const w of WEAKNESSES) {
    map.set(w.key, {
      key: w.key, label: w.label, category: w.category, incidents: 0, gamesAffected: 0, rateRecent: 0, rateEarlier: 0, rateAll: 0,
      inLosses: 0, confidence: 0, status: 'none', training: null, priority: 0, examples: [], series: new Array(n).fill(0), _conf: [], _games: new Set(),
    });
  }
  games.forEach((g, gi) => {
    const lost = userLost(g);
    for (const m of g.analysis!.moves) {
      if (m.color !== g.userColor) continue;
      // Count each move once per key, the primary tag at full weight and secondary ones at half.
      m.tags.forEach((t, ti) => {
        if (t.confidence < 0.4) return;
        const s = map.get(t.key);
        if (!s) return;
        const wgt = incidentWeight(m, t.confidence) * (ti === 0 ? 1 : 0.5);
        s.incidents++;
        s._conf.push(t.confidence);
        s._games.add(g.id);
        s.series[gi] += wgt;
        if (lost && (m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss')) s.inLosses++;
        if (s.examples.length < 40) s.examples.push({ gameId: g.id, ply: m.ply, why: t.why });
      });
    }
  });
  const trainThemes = (key: string) => new Set(WEAKNESS[key]?.train ?? []);
  for (const s of map.values()) {
    s.gamesAffected = s._games.size;
    s.confidence = s._conf.length ? s._conf.reduce((a, b) => a + b, 0) / s._conf.length : 0;
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    s.rateAll = n ? sum(s.series) / n : 0;
    s.rateRecent = n ? sum(s.series.slice(recentStart)) / Math.max(1, n - recentStart) : 0;
    s.rateEarlier = recentStart ? sum(s.series.slice(0, recentStart)) / recentStart : s.rateRecent;
    const th = trainThemes(s.key);
    const at = attempts.filter((a) => th.has(a.theme) || (a.theme === 'own' && false)).slice(-30);
    s.training = at.length ? { attempts: at.length, success: at.filter((a) => a.success).length / at.length } : null;
    s.status = statusOf(s, n);
    const lossShare = s.incidents ? s.inLosses / s.incidents : 0;
    const confFactor = 0.5 + s.confidence / 2;
    const trend = s.status === 'developing' ? 1.25 : s.status === 'improving' ? 0.75 : s.status === 'one_time' ? 0.4 : 1;
    const trained = s.training && s.training.attempts >= 8 && s.training.success > 0.85 ? 0.85 : 1;
    s.priority = Math.round((0.6 * s.rateRecent + 0.4 * s.rateAll) * (1 + lossShare) * confFactor * trend * trained * 100) / 100;
  }
  const stats = [...map.values()].map(({ _conf, _games, ...s }) => { void _conf; void _games; return s; })
    .filter((s) => s.incidents > 0).sort((a, b) => b.priority - a.priority);
  const byCategory = { tactical: 0, positional: 0, opening: 0, endgame: 0, calculation: 0 } as Record<Category, number>;
  for (const s of stats) byCategory[s.category] += s.priority;
  return { games: n, stats, top: stats.filter((s) => s.status !== 'one_time').slice(0, 3).concat(stats.filter((s) => s.status === 'one_time')).slice(0, 3), byCategory, updated: Date.now() };
}

function statusOf(s: WeaknessStat, n: number): Status {
  if (!s.incidents) return 'none';
  if (s.incidents === 1 || s.gamesAffected === 1 && s.incidents <= 2) return 'one_time';
  if (n >= RECENT + 2) {
    if (s.rateRecent < s.rateEarlier * 0.6 && s.rateEarlier > 0.3) return 'improving';
    if (s.rateRecent > s.rateEarlier * 1.5 && s.rateRecent > 0.4) return 'developing';
  } else if (s.training && s.training.attempts >= 10 && s.training.success >= 0.8) return 'improving';
  if (s.gamesAffected >= 2) return 'recurring';
  return 'developing';
}

export const STATUS_LABEL: Record<Status, string> = {
  recurring: 'Recurring', developing: 'Developing', improving: 'Improving', one_time: 'One-time', none: '—',
};
