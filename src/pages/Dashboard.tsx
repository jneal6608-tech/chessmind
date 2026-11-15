import { Explained } from '../ui/Explained';
// DASHBOARD: the five questions, answered from your data.
import { useEffect, useState } from 'react';
import { Page, Card, Empty, Spinner, Stat, ResultBadge, fmtDate } from '../ui/common';
import { useAppData } from '../services/data';
import { subscribeQueue, type QueueStatus } from '../services/analysisQueue';
import { daily as DAILY, type DailySession } from '../store/db';
import { todayKey, streak } from '../training/daily';
import { WEAKNESS } from '../training/themes';
import { STATUS_LABEL } from '../analysis/profile';
import { weeklyReport } from '../analysis/weekly';
import { recommendLevel, levelById } from '../engine/opponent';
import { scoreFor } from '../analysis/strength';
import { go } from '../services/router';

export function DashboardPage() {
  const [data] = useAppData();
  const [q, setQ] = useState<QueueStatus | null>(null);
  const [days, setDays] = useState<DailySession[]>([]);
  useEffect(() => subscribeQueue(setQ), []);
  useEffect(() => { DAILY.all().then(setDays); }, [data]);
  if (!data) return <Page title="Dashboard"><Spinner /></Page>;
  const today = days.find((d) => d.date === todayKey());
  const st = streak(days);
  const an = data.games.filter((g) => g.analysis);
  const recent = an.slice(-10);
  const avg = (f: (g: (typeof an)[number]) => number) => (recent.length ? recent.reduce((a, g) => a + f(g), 0) / recent.length : null);
  const acc = avg((g) => g.analysis!.accuracy[g.userColor]);
  const bl = avg((g) => g.analysis!.counts[g.userColor].blunder);
  const week = weeklyReport(data.games, data.attempts, data.profile);
  const aiGames = data.games.filter((g) => g.opponent.kind === 'ai').slice(-8);
  const sc = aiGames.length ? aiGames.reduce((a, g) => a + (scoreFor(g) ?? 0), 0) / aiGames.length : null;
  const rec = recommendLevel(data.strength.rating, sc);
  const ext = data.ratings[data.ratings.length - 1];
  const newUser = !data.games.length && !data.attempts.length;
  const goals = [1500, 1600, 1800, 2000];
  const nextGoal = goals.find((g) => g > (ext?.rating ?? data.strength.rating)) ?? 2200;
  const lostGames = an.filter((g) => scoreFor(g) === 0);
  // What costs games: the primary cause of the worst error in each lost game
  const costs: Record<string, number> = {};
  for (const g of lostGames) {
    const worst = g.analysis!.moves.filter((m) => m.color === g.userColor && m.tags.length).sort((a, b) => b.winLoss - a.winLoss)[0];
    if (worst) costs[worst.tags[0].key] = (costs[worst.tags[0].key] ?? 0) + 1;
  }
  const costList = Object.entries(costs).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <Page title={newUser ? 'Welcome to ChessMind' : `Good to see you${data.settings.playerName !== 'You' ? ', ' + data.settings.playerName : ''}`}
      subtitle={newUser ? 'A coach that learns how you play. Play or import a few games: ChessMind analyses each one, finds the mistakes that keep costing you, and builds your training around them.' : `Goal: ${nextGoal}. ${ext ? `Real rating ${ext.rating} (${ext.platform})` : `Estimate ${data.strength.rating}`}.`}>
      {newUser && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[['1', 'Play a game', 'Pick an opponent near your level.', 'play'], ['2', 'Or import your games', 'Lichess, Chess.com or a PGN file.', 'review'], ['3', 'Start training', 'Tactics and endgames adapt from the first exercise.', 'training']].map(([n, t, s, r]) => (
            <button key={n} onClick={() => go(r)} className="card-hi p-5 text-left hover:border-brass-600 transition-colors">
              <div className="h-display text-3xl text-brass-400">{n}</div><div className="mt-2 font-semibold">{t}</div><div className="text-sm text-ink-300">{s}</div>
            </button>
          ))}
        </div>
      )}
      {q?.gameId && <div className="mb-4 card p-3 text-sm flex items-center gap-2"><Spinner /> Analysing your latest game ({q.done}/{q.total})…</div>}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Estimated strength" value={data.strength.rating} sub={data.strength.games ? `${data.strength.provisional ? 'provisional, ' : ''}from ${data.strength.games} games` : 'starting value from Settings'} /></Card>
        <Card><Stat label="Accuracy (last 10)" value={acc === null ? '—' : `${acc.toFixed(0)}%`} sub={week.metrics[0].before !== null && week.metrics[0].now !== null ? `this week ${week.metrics[0].now.toFixed(0)}% vs ${week.metrics[0].before.toFixed(0)}%` : 'engine accuracy, not a rating'} /></Card>
        <Card><Stat label="Blunders / game" value={bl === null ? '—' : bl.toFixed(1)} sub="last 10 analysed games" tone={bl !== null && bl >= 1.5 ? 'text-blunder' : undefined} /></Card>
        <Card><Stat label="Training streak" value={`${st} day${st === 1 ? '' : 's'}`} sub={today?.completedAt ? 'today done ✓' : 'daily challenge open'} /></Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="What to work on" right={<a href="#/stats" className="text-xs text-brass-300">full profile →</a>}>
          {data.profile.top.length ? (
            <div className="space-y-3">
              {data.profile.top.map((w, i) => (
                <div key={w.key} className="flex gap-4 rounded-xl bg-ink-900/60 p-3">
                  <div className="h-display text-2xl text-brass-400 w-6">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{w.label}</span><span className="chip">{STATUS_LABEL[w.status]}</span><span className="text-xs text-ink-400">{w.incidents}× in {w.gamesAffected} game{w.gamesAffected === 1 ? '' : 's'}{w.inLosses ? ` · ${w.inLosses} in losses` : ''} · confidence {Math.round(w.confidence * 100)}%</span></div>
                    <p className="mt-1 text-sm text-ink-300"><Explained text={WEAKNESS[w.key]?.lesson ?? ''} /></p>
                    {w.examples[0] && <p className="mt-1 text-xs text-ink-500 italic truncate">e.g. {w.examples[w.examples.length - 1].why}</p>}
                  </div>
                  <button className="btn btn-sm self-center" onClick={() => go(`training/session/weakness/${w.key}`)}>Train</button>
                </div>
              ))}
            </div>
          ) : <Empty>{an.length ? 'No recurring weaknesses found in your analysed games yet: keep playing.' : 'Your top three weaknesses appear here after your first analysed games.'}</Empty>}
        </Card>
        <div className="space-y-5">
          <Card className="card-hi" title="Today">
            <p className="text-sm text-ink-300">{today ? `${Object.values(today.done).filter(Boolean).length}/${today.items.length} exercises done.` : 'A 10-minute session built around your weaknesses.'}</p>
            <button className="btn btn-primary w-full mt-3" onClick={() => go('training/session/daily')}>{today?.completedAt ? 'Daily challenge done ✓ (replay)' : 'Daily challenge'}</button>
            <button className="btn w-full mt-2" onClick={() => go('play')}>Play {rec.name} (~{rec.elo}) <span className="text-ink-400 text-xs">recommended</span></button>
          </Card>
          <Card title="Why you lose">
            {costList.length ? <ul className="space-y-1.5 text-sm">{costList.map(([k, n]) => <li key={k} className="flex justify-between"><span>{WEAKNESS[k]?.label ?? k}</span><span className="text-ink-400 tabular-nums">{n} of {lostGames.length} losses</span></li>)}</ul>
              : <p className="text-sm text-ink-400">Based on the biggest mistake in each lost game. No analysed losses yet.</p>}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Recent games" right={<a href="#/review" className="text-xs text-brass-300">all →</a>}>
          {data.games.length ? <div className="divide-y divide-ink-700">{data.games.slice(-6).reverse().map((g) => (
            <a key={g.id} href={`#/review/${g.id}`} className="flex items-center gap-3 py-2 hover:bg-ink-800/50 -mx-2 px-2 rounded-lg">
              <ResultBadge result={g.result} color={g.userColor} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm">vs {g.opponent.name}</div><div className="text-xs text-ink-400 truncate">{fmtDate(g.date)} · {g.opening?.name ?? '—'}</div></div>
              <span className="text-sm tabular-nums text-ink-300">{g.analysis ? `${g.analysis.accuracy[g.userColor].toFixed(0)}%` : '…'}</span>
            </a>))}</div> : <Empty>No games yet.</Empty>}
        </Card>
        <Card title="Is it working?" right={<a href="#/stats" className="text-xs text-brass-300">weekly report →</a>}>
          {week.enoughData ? (
            <div className="space-y-2 text-sm">
              {week.improved.slice(0, 3).map((x) => <div key={x} className="text-good">▲ {x}</div>)}
              {week.needsWork.slice(0, 3).map((x) => <div key={x} className="text-mistake">▼ {x}</div>)}
              {!week.improved.length && !week.needsWork.length && <p className="text-ink-300">No significant change this week compared with the four weeks before.</p>}
            </div>
          ) : <p className="text-sm text-ink-400">Progress is measured week over week. After about two weeks of games and training, this card shows what improved and what didn't.</p>}
          {aiGames.length > 0 && <p className="mt-3 text-xs text-ink-500">Recent score vs ChessMind opponents: {Math.round((sc ?? 0) * 100)}% over {aiGames.length} games (last: {levelById(aiGames[aiGames.length - 1].opponent.levelId ?? 'l4').name}).</p>}
        </Card>
      </div>
    </Page>
  );
}
