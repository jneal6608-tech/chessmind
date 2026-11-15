// Weekly report: this week against the four weeks before it. Only measured
// numbers; when there is too little data the report says so.
import type { GameRecord } from './types';
import type { Attempt } from '../store/db';
import { WEAKNESS } from '../training/themes';
import type { Profile } from './profile';

const DAY = 86400000;
export interface WeeklyReport {
  from: number; to: number;
  games: number; baselineGames: number;
  attempts: number; baselineAttempts: number;
  metrics: { label: string; now: number | null; before: number | null; better: 'up' | 'down'; fmt: (v: number) => string }[];
  improved: string[]; needsWork: string[]; decreased: string[]; increased: string[]; priorities: string[];
  enoughData: boolean;
}

function perGame(gs: GameRecord[], f: (g: GameRecord) => number) { return gs.length ? gs.reduce((a, g) => a + f(g), 0) / gs.length : null; }

export function weeklyReport(games: GameRecord[], attempts: Attempt[], profile: Profile, now = Date.now()): WeeklyReport {
  const from = now - 7 * DAY, base0 = now - 35 * DAY;
  const an = games.filter((g) => g.analysis);
  const week = an.filter((g) => g.date >= from), base = an.filter((g) => g.date >= base0 && g.date < from);
  const aw = attempts.filter((a) => a.date >= from), ab = attempts.filter((a) => a.date >= base0 && a.date < from);
  const acc = (g: GameRecord) => g.analysis!.accuracy[g.userColor];
  const cnt = (g: GameRecord, k: 'blunder' | 'mistake') => g.analysis!.counts[g.userColor][k] + (k === 'mistake' ? g.analysis!.counts[g.userColor].miss : 0);
  const succ = (as: Attempt[]) => (as.length ? as.filter((a) => a.success).length / as.length : null);
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const metrics: WeeklyReport['metrics'] = [
    { label: 'Accuracy', now: perGame(week, acc), before: perGame(base, acc), better: 'up', fmt: (v) => `${v.toFixed(1)}%` },
    { label: 'Blunders per game', now: perGame(week, (g) => cnt(g, 'blunder')), before: perGame(base, (g) => cnt(g, 'blunder')), better: 'down', fmt: (v) => v.toFixed(2) },
    { label: 'Mistakes per game', now: perGame(week, (g) => cnt(g, 'mistake')), before: perGame(base, (g) => cnt(g, 'mistake')), better: 'down', fmt: (v) => v.toFixed(2) },
    { label: 'Exercise success', now: succ(aw), before: succ(ab), better: 'up', fmt: pct },
  ];
  const improved: string[] = [], needsWork: string[] = [];
  for (const m of metrics) {
    if (m.now === null || m.before === null) continue;
    const d = m.now - m.before;
    const rel = m.before === 0 ? (m.now === 0 ? 0 : 1) : Math.abs(d) / Math.abs(m.before);
    if (rel < 0.08) continue;
    const good = m.better === 'up' ? d > 0 : d < 0;
    (good ? improved : needsWork).push(`${m.label}: ${m.fmt(m.before)} → ${m.fmt(m.now)}`);
  }
  // Weakness incidents per game, this week vs baseline
  const rate = (gs: GameRecord[], key: string) => gs.length ? gs.reduce((a, g) => a + g.analysis!.moves.filter((m) => m.color === g.userColor && m.tags.some((t) => t.key === key && t.confidence >= 0.4) && m.cls !== 'inaccuracy').length, 0) / gs.length : 0;
  const decreased: string[] = [], increased: string[] = [];
  if (week.length && base.length) {
    for (const s of profile.stats) {
      const a = rate(base, s.key), b = rate(week, s.key);
      if (a === 0 && b === 0) continue;
      if (b < a * 0.6 && a >= 0.3) decreased.push(`${WEAKNESS[s.key]?.label ?? s.key}: ${a.toFixed(1)} → ${b.toFixed(1)} per game`);
      else if (b > a * 1.5 && b >= 0.3) increased.push(`${WEAKNESS[s.key]?.label ?? s.key}: ${a.toFixed(1)} → ${b.toFixed(1)} per game`);
    }
  }
  const priorities = profile.top.map((w) => `${w.label}: ${WEAKNESS[w.key]?.lesson ?? ''}`);
  if (!aw.length) priorities.push('Train on at least four days this week: short daily challenges beat one long session.');
  return {
    from, to: now, games: week.length, baselineGames: base.length, attempts: aw.length, baselineAttempts: ab.length,
    metrics, improved, needsWork, decreased, increased, priorities, enoughData: week.length + aw.length > 0 && base.length + ab.length > 0,
  };
}
