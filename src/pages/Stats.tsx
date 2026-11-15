// STATISTICS: is the player actually improving? Strength estimate vs real
// ratings, accuracy and error trends, results by opponent, training results,
// weakness trends, consistency, and the weekly report.
import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from 'recharts';
import { Page, Card, Empty, Spinner, Stat, Bar, fmtDate, resultFor } from '../ui/common';
import { useAppData, type AppData } from '../services/data';
import { ratings as RATINGS } from '../store/db';
import { weeklyReport } from '../analysis/weekly';
import { LEVELS } from '../engine/opponent';
import { THEME_LABEL } from '../training/themes';
import { STATUS_LABEL } from '../analysis/profile';
import { themeRatings, overallTrainingRating } from '../training/srs';
import { uid } from '../chess/util';
import { openingPerformance } from './Openings';

// Validated (dataviz skill script) on the #16181d surface: all checks pass.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const AXIS = { stroke: '#6b7385', fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#252932" vertical={false} />;
const TT = { contentStyle: { background: '#16181d', border: '1px solid #333845', borderRadius: 8, fontSize: 12, color: '#e7e4dc' }, cursor: { stroke: '#4a5060' } };

export function StatsPage() {
  const [data] = useAppData();
  if (!data) return <Page title="Statistics"><Spinner /></Page>;
  return <Stats data={data} />;
}

function Stats({ data }: { data: AppData }) {
  const an = data.games.filter((g) => g.analysis).sort((a, b) => a.date - b.date);
  const week = useMemo(() => weeklyReport(data.games, data.attempts, data.profile), [data]);
  const series = an.map((g, i) => {
    const c = g.analysis!.counts[g.userColor];
    return { i: i + 1, date: fmtDate(g.date), acc: Math.round(g.analysis!.accuracy[g.userColor]), blunders: c.blunder, mistakes: c.mistake + c.miss, eg: g.analysis!.phases.endgame.moves ? Math.round(g.analysis!.phases.endgame.accuracy) : null };
  });
  const rolling = series.map((s, i) => { const w = series.slice(Math.max(0, i - 4), i + 1); return { ...s, accAvg: Math.round(w.reduce((a, x) => a + x.acc, 0) / w.length) }; });
  const strength = data.strength.history.map((h) => ({ t: h.date, label: fmtDate(h.date), estimate: h.rating }));
  const ext = data.ratings;
  const strengthChart = [...strength.map((s) => ({ t: s.t, label: s.label, estimate: s.estimate } as Record<string, number | string>)), ...ext.map((r) => ({ t: r.date, label: fmtDate(r.date), [r.platform]: r.rating } as Record<string, number | string>))].sort((a, b) => Number(a.t) - Number(b.t));
  const platforms = [...new Set(ext.map((r) => r.platform))].slice(0, 3);
  const wdl = data.games.reduce((a, g) => { const r = resultFor(g.result, g.userColor); if (r !== 'none') a[r]++; return a; }, { win: 0, draw: 0, loss: 0 });
  const total = wdl.win + wdl.draw + wdl.loss;
  const byLevel = LEVELS.map((l) => {
    const gs = data.games.filter((g) => g.opponent.levelId === l.id);
    const r = gs.map((g) => resultFor(g.result, g.userColor));
    return { name: l.name, elo: l.elo, games: gs.length, win: r.filter((x) => x === 'win').length, draw: r.filter((x) => x === 'draw').length, loss: r.filter((x) => x === 'loss').length };
  }).filter((x) => x.games);
  const tr = themeRatings(data.attempts, data.strength.rating);
  const byTheme = Object.entries(data.attempts.reduce((m, a) => { (m[a.theme] ??= { n: 0, s: 0 }).n++; if (a.success) m[a.theme].s++; return m; }, {} as Record<string, { n: number; s: number }>))
    .map(([theme, v]) => ({ theme, label: THEME_LABEL[theme] ?? theme, n: v.n, rate: Math.round((v.s / v.n) * 100), rating: tr[theme] })).sort((a, b) => b.n - a.n);
  const days = useMemo(() => {
    const out: { d: string; n: number }[] = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const n = data.attempts.filter((a) => a.date >= d.getTime() && a.date < d.getTime() + 86400000).length + data.games.filter((g) => g.date >= d.getTime() && g.date < d.getTime() + 86400000).length;
      out.push({ d: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), n });
    }
    return out;
  }, [data]);
  const activeDays = days.slice(-28).filter((d) => d.n > 0).length;
  const topW = data.profile.stats.slice(0, 4);
  const wTrend = an.map((_, gi) => {
    const row: Record<string, number> = { i: gi + 1 };
    for (const w of topW) { const s = w.series.slice(Math.max(0, gi - 4), gi + 1); row[w.label] = Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100; }
    return row;
  });
  const egAttempts = data.attempts.filter((a) => a.kind === 'endgame');
  const perf = openingPerformance(data);

  return (
    <Page title="Statistics" subtitle="Measured progress only. Accuracy and estimated strength are ChessMind's own measures; they are kept separate from your real ratings on other sites.">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card><Stat label="Estimated strength" value={data.strength.rating} sub={data.strength.games ? `${data.strength.provisional ? 'provisional · ' : ''}±${data.strength.deviation}, ${data.strength.games} games` : 'play rated games'} /></Card>
        <Card><Stat label="Latest real rating" value={ext.length ? ext[ext.length - 1].rating : '—'} sub={ext.length ? `${ext[ext.length - 1].platform} ${ext[ext.length - 1].timeControl}` : 'add below'} /></Card>
        <Card><Stat label="Results" value={total ? `${Math.round(((wdl.win + wdl.draw / 2) / total) * 100)}%` : '—'} sub={`${wdl.win}W ${wdl.draw}D ${wdl.loss}L`} /></Card>
        <Card><Stat label="Training rating" value={data.attempts.length ? overallTrainingRating(data.attempts, data.strength.rating) : '—'} sub={`${data.attempts.length} exercises`} /></Card>
        <Card><Stat label="Active days (28)" value={activeDays} sub="days with games or training" /></Card>
      </div>

      <WeeklyCard week={week} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Strength over time">
          {strengthChart.length ? (
            <div className="h-56"><ResponsiveContainer><LineChart data={strengthChart} margin={{ left: -10, right: 8, top: 8 }}>
              {GRID}<XAxis dataKey="label" {...AXIS} minTickGap={24} /><YAxis {...AXIS} domain={['dataMin - 50', 'dataMax + 50']} />
              <Tooltip {...TT} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="estimate" name="ChessMind estimate" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              {platforms.map((p, i) => <Line key={p} type="monotone" dataKey={p} name={`${p} (real)`} stroke={SERIES[i + 1]} strokeWidth={2} dot={{ r: 4 }} connectNulls />)}
            </LineChart></ResponsiveContainer></div>
          ) : <Empty>Play games against ChessMind opponents (or import rated games) to see your estimate develop.</Empty>}
          <RatingForm />
        </Card>
        <Card title="Accuracy per game" right={<span className="text-xs text-ink-400">line: 5-game average</span>}>
          {series.length ? <div className="h-56"><ResponsiveContainer><ComposedChart data={rolling} margin={{ left: -20, right: 8, top: 8 }}>
            {GRID}<XAxis dataKey="i" {...AXIS} /><YAxis {...AXIS} domain={[0, 100]} />
            <Tooltip {...TT} labelFormatter={(l) => `Game ${l}`} />
            <Area type="monotone" dataKey="acc" name="Accuracy" stroke="none" fill={SERIES[0]} fillOpacity={0.15} />
            <Line type="monotone" dataKey="accAvg" name="5-game average" stroke={SERIES[0]} strokeWidth={2} dot={false} />
          </ComposedChart></ResponsiveContainer></div> : <Empty>No analysed games yet.</Empty>}
        </Card>
        <Card title="Blunders and mistakes per game">
          {series.length ? <div className="h-56"><ResponsiveContainer><BarChart data={series} margin={{ left: -20, right: 8, top: 8 }} barGap={2}>
            {GRID}<XAxis dataKey="i" {...AXIS} /><YAxis {...AXIS} allowDecimals={false} />
            <Tooltip {...TT} cursor={{ fill: '#252932' }} labelFormatter={(l) => `Game ${l}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <RBar dataKey="blunders" name="Blunders" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <RBar dataKey="mistakes" name="Mistakes" fill={SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart></ResponsiveContainer></div> : <Empty>No analysed games yet.</Empty>}
        </Card>
        <Card title="Weakness trends" right={<span className="text-xs text-ink-400">weighted cost per game, 5-game window</span>}>
          {wTrend.length > 1 && topW.length ? <div className="h-56"><ResponsiveContainer><LineChart data={wTrend} margin={{ left: -20, right: 8, top: 8 }}>
            {GRID}<XAxis dataKey="i" {...AXIS} /><YAxis {...AXIS} />
            <Tooltip {...TT} labelFormatter={(l) => `Game ${l}`} /><Legend wrapperStyle={{ fontSize: 12 }} />
            {topW.map((w, i) => <Line key={w.key} type="monotone" dataKey={w.label} stroke={SERIES[i]} strokeWidth={2} dot={false} />)}
          </LineChart></ResponsiveContainer></div> : <Empty>Needs at least two analysed games.</Empty>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Weakness profile" className="lg:col-span-2">
          {data.profile.stats.length ? (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="label text-left"><th className="py-2">Weakness</th><th>Status</th><th>Incidents</th><th>In losses</th><th>Confidence</th><th>Training</th><th className="w-28">Priority</th></tr></thead>
              <tbody>{data.profile.stats.map((s) => (
                <tr key={s.key} className="border-t border-ink-700">
                  <td className="py-2 font-medium">{s.label}</td><td><span className="chip">{STATUS_LABEL[s.status]}</span></td>
                  <td className="tabular-nums">{s.incidents} <span className="text-ink-500">/ {s.gamesAffected}g</span></td><td className="tabular-nums">{s.inLosses}</td>
                  <td className="tabular-nums">{Math.round(s.confidence * 100)}%</td>
                  <td className="tabular-nums">{s.training ? `${Math.round(s.training.success * 100)}% of ${s.training.attempts}` : '—'}</td>
                  <td><Bar value={s.priority} max={data.profile.stats[0].priority || 1} /></td>
                </tr>))}</tbody>
            </table></div>
          ) : <Empty>No weaknesses detected yet.</Empty>}
          <p className="mt-3 text-xs text-ink-500">Recurring: seen in several games. Developing: more frequent lately. Improving: much less frequent lately or trained successfully. One-time: seen once; not a pattern yet. Confidence is how sure the classifier was about the cause.</p>
        </Card>
        <Card title="Results by opponent">
          {byLevel.length ? <div className="space-y-2">{byLevel.map((l) => (
            <div key={l.name}><div className="flex justify-between text-sm"><span>{l.name} <span className="text-ink-500 text-xs">~{l.elo}</span></span><span className="tabular-nums text-ink-300">{l.win}W {l.draw}D {l.loss}L</span></div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full gap-[2px]">
                {l.win > 0 && <div style={{ flex: l.win, background: SERIES[2] }} />}{l.draw > 0 && <div style={{ flex: l.draw, background: '#6b7385' }} />}{l.loss > 0 && <div style={{ flex: l.loss, background: SERIES[1] }} />}
              </div></div>))}
            <div className="flex gap-3 pt-1 text-[11px] text-ink-400"><span><i className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: SERIES[2] }} />win</span><span><i className="inline-block h-2 w-2 rounded-full mr-1 bg-ink-400" />draw</span><span><i className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: SERIES[1] }} />loss</span></div>
          </div> : <Empty>No games against ChessMind opponents yet.</Empty>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Exercise success by theme" className="lg:col-span-2">
          {byTheme.length ? <div className="h-64"><ResponsiveContainer><BarChart data={byTheme.slice(0, 12)} layout="vertical" margin={{ left: 30, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} {...AXIS} unit="%" /><YAxis type="category" dataKey="label" {...AXIS} width={110} />
            <Tooltip {...TT} cursor={{ fill: '#252932' }} formatter={(v, _n, p) => [`${v}% (${(p.payload as { n: number }).n} tries, level ${(p.payload as { rating?: number }).rating ?? '—'})`, 'Success']} />
            <RBar dataKey="rate" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={14} />
          </BarChart></ResponsiveContainer></div> : <Empty>No exercises done yet.</Empty>}
        </Card>
        <Card title="Endgames">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Play-outs" value={egAttempts.length ? `${Math.round((egAttempts.filter((a) => a.success).length / egAttempts.length) * 100)}%` : '—'} sub={`${egAttempts.length} attempts`} />
            <Stat label="Endgame accuracy" value={series.filter((s) => s.eg !== null).length ? `${Math.round(series.filter((s) => s.eg !== null).reduce((a, s) => a + (s.eg ?? 0), 0) / series.filter((s) => s.eg !== null).length)}%` : '—'} sub="in your games" />
          </div>
          <div className="mt-4 label mb-2">Openings (most played)</div>
          {perf.slice(0, 4).map((r) => <div key={r.family + r.color} className="flex justify-between text-sm py-0.5"><span className="truncate">{r.family} <span className="text-ink-500 text-xs">{r.color === 'w' ? 'W' : 'B'}</span></span><span className="tabular-nums text-ink-300">{(((r.w + r.d / 2) / r.games) * 100).toFixed(0)}% of {r.games}</span></div>)}
          {!perf.length && <p className="text-sm text-ink-400">No games yet.</p>}
        </Card>
      </div>

      <Card title="Training consistency (last 8 weeks)" className="mt-5">
        <div className="h-32"><ResponsiveContainer><BarChart data={days} margin={{ left: -24, right: 4 }}>
          <XAxis dataKey="d" {...AXIS} interval={6} /><YAxis {...AXIS} allowDecimals={false} />
          <Tooltip {...TT} cursor={{ fill: '#252932' }} formatter={(v) => [v, 'games + exercises']} />
          <RBar dataKey="n" fill={SERIES[2]} radius={[3, 3, 0, 0]} />
        </BarChart></ResponsiveContainer></div>
      </Card>
    </Page>
  );
}

function WeeklyCard({ week }: { week: ReturnType<typeof weeklyReport> }) {
  const List = ({ title, items, tone }: { title: string; items: string[]; tone: string }) => (
    <div><div className={`label mb-1 ${tone}`}>{title}</div>{items.length ? <ul className="space-y-1 text-sm text-ink-200">{items.map((x) => <li key={x}>• {x}</li>)}</ul> : <p className="text-sm text-ink-500">Nothing notable.</p>}</div>
  );
  return (
    <Card className="mt-5 card-hi" title={`Weekly report · ${fmtDate(week.from)} – ${fmtDate(week.to)}`} right={<span className="text-xs text-ink-400">{week.games} games, {week.attempts} exercises this week · compared with the 4 weeks before ({week.baselineGames} games, {week.baselineAttempts} exercises)</span>}>
      {!week.enoughData && <p className="mb-3 text-sm text-ink-300">Not enough data for a week-over-week comparison yet: it needs activity both this week and in the four weeks before. Numbers below are what was measured.</p>}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        {week.metrics.map((m) => <div key={m.label} className="rounded-lg bg-ink-900 p-3"><div className="label">{m.label}</div><div className="text-lg font-semibold tabular-nums">{m.now === null ? '—' : m.fmt(m.now)}</div><div className="text-xs text-ink-500">before: {m.before === null ? '—' : m.fmt(m.before)}</div></div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <List title="Improved" items={week.improved} tone="!text-good" />
        <List title="Needs work" items={week.needsWork} tone="!text-mistake" />
        <List title="Mistakes that decreased" items={week.decreased} tone="!text-good" />
        <List title="Mistakes that increased" items={week.increased} tone="!text-mistake" />
      </div>
      <div className="mt-4 rounded-xl bg-ink-900/70 p-4"><List title="Priorities next week" items={week.priorities} tone="!text-brass-300" /></div>
    </Card>
  );
}

function RatingForm() {
  const [data] = useAppData();
  const [platform, setPlatform] = useState('Chess.com');
  const [tc, setTc] = useState('rapid');
  const [rating, setRating] = useState('');
  return (
    <div className="mt-3 border-t border-ink-700 pt-3">
      <div className="label mb-2">Add a real rating</div>
      <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); const r = Number(rating); if (r > 100 && r < 3500) { await RATINGS.put({ id: uid(), date: Date.now(), platform, timeControl: tc, rating: r }); setRating(''); } }}>
        <select className="input !w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}>{['Chess.com', 'Lichess', 'FIDE', 'National', 'Other'].map((p) => <option key={p}>{p}</option>)}</select>
        <select className="input !w-auto" value={tc} onChange={(e) => setTc(e.target.value)}>{['rapid', 'blitz', 'classical', 'bullet'].map((p) => <option key={p}>{p}</option>)}</select>
        <input className="input !w-24" inputMode="numeric" placeholder="1250" value={rating} onChange={(e) => setRating(e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn-sm">Add</button>
      </form>
      {data && data.ratings.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{data.ratings.slice(-6).map((r) => <span key={r.id} className="chip">{r.platform} {r.rating} · {fmtDate(r.date)} <button onClick={() => RATINGS.del(r.id)} aria-label="Remove">✕</button></span>)}</div>}
    </div>
  );
}
