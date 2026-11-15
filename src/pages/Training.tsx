import { Explained } from '../ui/Explained';
// TRAINING: daily challenge, weakness training, tactics, endgames, your own
// mistakes and spaced-repetition reviews.
import { useEffect, useMemo, useState } from 'react';
import { Page, Card, Empty, Spinner, Bar } from '../ui/common';
import { Solver, type SolveResult } from '../ui/Solver';
import { useAppData, type AppData } from '../services/data';
import { daily as DAILY } from '../store/db';
import { buildDaily, todayKey, streak } from '../training/daily';
import { pick } from '../training/select';
import { themeRatings } from '../training/srs';
import { WEAKNESS, THEME_LABEL } from '../training/themes';
import { isEndgameTactic } from '../training/bank';
import { STATUS_LABEL } from '../analysis/profile';
import { go } from '../services/router';
import type { Exercise } from '../training/types';
import type { DailySession } from '../store/db';

const TACTIC_THEMES = ['fork', 'pin', 'skewer', 'discovered', 'capture_hanging', 'winning_capture', 'mate_in_1', 'mate_in_2', 'mate_in_3', 'back_rank', 'defense', 'mating_threat', 'advantage', 'promotion'];

export function TrainingPage({ route }: { route: string[] }) {
  const [data] = useAppData();
  if (!data) return <Page title="Training"><Spinner /></Page>;
  const [sub, a, b] = route;
  if (sub === 'solve' && a) return <SingleExercise data={data} id={a} />;
  if (sub === 'session' && a) return <Session data={data} mode={a} theme={b} />;
  return <Hub data={data} />;
}

function poolOf(d: AppData) { return { exercises: d.exercises, cards: d.cards, attempts: d.attempts, base: d.strength.rating }; }

function Hub({ data }: { data: AppData }) {
  const [days, setDays] = useState<DailySession[]>([]);
  useEffect(() => { DAILY.all().then(setDays); }, [data]);
  const today = days.find((x) => x.date === todayKey());
  const now = Date.now();
  const due = data.exercises.filter((e) => { const c = data.cards.get(e.id); return c && c.due <= now; }).length;
  const ownOpen = data.ownExercises.filter((e) => !data.attempts.some((x) => x.exerciseId === e.id)).length;
  const ratings = themeRatings(data.attempts, data.strength.rating);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of data.exercises) m[e.theme] = (m[e.theme] ?? 0) + 1;
    return m;
  }, [data.exercises]);
  const st = streak(days);
  const endgames = data.exercises.filter((e) => e.kind === 'endgame');
  return (
    <Page title="Training" subtitle="Exercises are chosen from your own mistakes first, then from engine-verified positions at the edge of your level. Difficulty adapts as you succeed or struggle.">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-hi" title={<span className="flex items-center gap-2">Daily challenge {st > 0 && <span className="chip text-brass-300 border-brass-600">🔥 {st}-day streak</span>}</span>}>
          <p className="text-sm text-ink-300">About 10 minutes: due reviews, one of your own mistakes, exercises for your top weaknesses and an endgame.</p>
          {today && <div className="mt-3"><Bar value={Object.values(today.done).filter(Boolean).length} max={today.items.length} /><div className="mt-1 text-xs text-ink-400">{Object.values(today.done).filter(Boolean).length}/{today.items.length} done{today.completedAt ? ' · completed today ✓' : ''}</div></div>}
          <button className="btn btn-primary mt-4" onClick={() => go('training/session/daily')}>{today && !today.completedAt && Object.keys(today.done).length ? 'Continue daily challenge' : today?.completedAt ? 'Replay daily challenge' : 'Start daily challenge'}</button>
        </Card>
        <Card title="Reviews & your mistakes">
          <div className="space-y-3">
            <div className="flex items-center justify-between"><div><div className="font-semibold">{due} due review{due === 1 ? '' : 's'}</div><div className="text-xs text-ink-400">Spaced repetition: missed positions come back</div></div>
              <button className="btn btn-sm" disabled={!due} onClick={() => go('training/session/review')}>Review</button></div>
            <div className="flex items-center justify-between"><div><div className="font-semibold">{ownOpen} position{ownOpen === 1 ? '' : 's'} from your games</div><div className="text-xs text-ink-400">Where you went wrong; find the better move</div></div>
              <button className="btn btn-sm" disabled={!data.ownExercises.length} onClick={() => go('training/session/mistakes')}>Practise</button></div>
          </div>
        </Card>
      </div>

      <h2 className="h-display text-xl mt-8 mb-3">Weakness training</h2>
      {data.profile.top.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {data.profile.top.map((w, i) => (
            <Card key={w.key} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div><div className="label">Priority {i + 1}</div><div className="mt-1 font-semibold text-lg">{w.label}</div></div>
                <span className="chip">{STATUS_LABEL[w.status]}</span>
              </div>
              <p className="mt-2 text-sm text-ink-300 flex-1"><Explained text={WEAKNESS[w.key]?.lesson ?? ''} /></p>
              <div className="mt-2 text-xs text-ink-400">{w.incidents} incident{w.incidents === 1 ? '' : 's'} in {w.gamesAffected} game{w.gamesAffected === 1 ? '' : 's'}{w.training ? ` · training success ${(w.training.success * 100).toFixed(0)}%` : ''}</div>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => go(`training/session/weakness/${w.key}`)}>Train this</button>
            </Card>
          ))}
        </div>
      ) : <Empty>Play or import a few games: once they are analysed, your three most costly weaknesses appear here with matching exercises. Meanwhile, tactics and endgames below adapt to your results.</Empty>}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card title="Tactics" right={<button className="btn btn-sm btn-primary" onClick={() => go('training/session/tactics')}>Mixed session</button>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TACTIC_THEMES.filter((t) => counts[t]).map((t) => (
              <button key={t} onClick={() => go(`training/session/tactics/${t}`)} className="rounded-lg border border-ink-700 bg-ink-900/40 px-3 py-2 text-left hover:border-brass-500">
                <div className="text-sm font-semibold">{THEME_LABEL[t]}</div>
                <div className="text-[11px] text-ink-400 tabular-nums">{counts[t]} positions · your level {ratings[t] ?? data.strength.rating}</div>
              </button>
            ))}
          </div>
          {!TACTIC_THEMES.some((t) => counts[t]) && <Empty>The exercise bank is empty in this build.</Empty>}
        </Card>
        <Card title="Endgames" right={<button className="btn btn-sm btn-primary" disabled={!endgames.length} onClick={() => go('training/session/endgame')}>Practise</button>}>
          <p className="text-sm text-ink-300 mb-3">Play these out against full-strength Stockfish. Theory first, then practical positions from real games.</p>
          <button onClick={() => go('training/session/egtactics')} className="mb-3 w-full rounded-xl border border-brass-600/60 bg-brass-500/5 px-3 py-2.5 text-left hover:border-brass-400">
            <div className="text-sm font-semibold">Endgame tactics ({data.exercises.filter(isEndgameTactic).length})</div>
            <div className="text-[11px] text-ink-400">Breakthroughs, promotion tricks, forks and pins with few pieces left: find the winning idea.</div>
          </button>
          <div className="space-y-1.5 max-h-80 overflow-y-auto scroll-thin pr-1">
            {endgames.filter((e) => e.source === 'theory').map((e) => {
              const tries = data.attempts.filter((x) => x.exerciseId === e.id);
              const solved = tries.some((x) => x.success);
              return (
                <button key={e.id} onClick={() => go(`training/solve/${e.id}`)} className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-ink-800 text-left">
                  <div><div className="text-sm font-semibold">{e.title}</div><div className="text-[11px] text-ink-400">{THEME_LABEL[e.theme]} · {e.goal === 'win' ? 'win it' : 'hold the draw'}</div></div>
                  <span className={`text-xs ${solved ? 'text-good' : 'text-ink-500'}`}>{solved ? '✓ done' : tries.length ? 'retry' : 'new'}</span>
                </button>
              );
            })}
            {endgames.some((e) => e.source === 'bank') && <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-brass-300 hover:bg-ink-800" onClick={() => go('training/session/endgame/practical')}>Practical endgames from real games ({endgames.filter((e) => e.source === 'bank').length}) →</button>}
          </div>
        </Card>
      </div>
    </Page>
  );
}

function buildSession(d: AppData, mode: string, theme?: string, dailyItems?: DailySession): Exercise[] {
  const pool = poolOf(d);
  const byId = new Map(d.exercises.map((e) => [e.id, e]));
  switch (mode) {
    case 'daily': return (dailyItems?.items ?? []).map((i) => byId.get(i.exerciseId)).filter(Boolean) as Exercise[];
    case 'weakness': {
      const keys = theme ? [theme] : d.profile.top.map((w) => w.key);
      const out: Exercise[] = [];
      const ex = new Set<string>();
      for (const k of keys) for (const e of pick(pool, { themes: WEAKNESS[k]?.train ?? [], count: theme ? 8 : 3, exclude: ex, seed: k.length * 7 + Date.now() % 1000 })) { ex.add(e.id); out.push(e); }
      // Your own positions tagged with that weakness come first.
      const own = d.ownExercises.filter((e) => keys.includes(e.weakness ?? '') && !ex.has(e.id)).slice(0, 3);
      return [...own, ...out].slice(0, theme ? 10 : 9);
    }
    case 'tactics': return pick(pool, { themes: theme ? [theme] : TACTIC_THEMES, kinds: ['tactic', 'own_mistake'], count: 10 });
    case 'endgame': return pick(pool, { kinds: ['endgame'], count: 5, ...(theme === 'practical' ? { themes: ['eg_rook', 'eg_pawn', 'eg_minor', 'eg_queen'] } : {}) }).filter((e) => theme !== 'practical' || e.source === 'bank');
    case 'egtactics': return pick({ ...pool, exercises: d.exercises.filter(isEndgameTactic) }, { count: 8 });
    case 'mistakes': return pick({ ...pool, exercises: d.ownExercises }, { count: 10 });
    case 'review': { const now = Date.now(); return d.exercises.filter((e) => { const c = d.cards.get(e.id); return c && c.due <= now; }).slice(0, 15); }
    default: return [];
  }
}

function Session({ data, mode, theme }: { data: AppData; mode: string; theme?: string }) {
  const [list, setList] = useState<Exercise[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<(SolveResult | undefined)[]>([]);
  const [dailyRec, setDailyRec] = useState<DailySession | null>(null);
  useEffect(() => {
    (async () => {
      let d: DailySession | undefined;
      if (mode === 'daily') {
        d = await DAILY.get(todayKey());
        if (!d) { d = buildDaily(data); await DAILY.put(d); }
        setDailyRec(d);
        const firstOpen = d.items.findIndex((i) => !d!.done[i.exerciseId]);
        setIdx(firstOpen < 0 ? 0 : firstOpen);
      }
      setList(buildSession(data, mode, theme, d));
    })();
    // A session is fixed once built, even as attempts update the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, theme]);
  if (!list) return <Page title="Training"><Spinner /></Page>;
  const title = mode === 'daily' ? 'Daily challenge' : mode === 'weakness' ? `Weakness: ${theme ? WEAKNESS[theme]?.label : 'top priorities'}` : mode === 'tactics' ? `Tactics${theme ? ': ' + THEME_LABEL[theme] : ''}` : mode === 'endgame' ? 'Endgames' : mode === 'egtactics' ? 'Endgame tactics' : mode === 'mistakes' ? 'Your mistakes' : 'Reviews';
  if (!list.length) return <Page title={title}><Empty>Nothing to practise here yet. {mode === 'mistakes' ? 'Play or import games: your mistakes will appear here after analysis.' : mode === 'review' ? 'No reviews are due. Come back tomorrow.' : ''} <a href="#/training" className="underline text-brass-300">Back to training</a></Empty></Page>;
  const finished = idx >= list.length;
  const ex = list[Math.min(idx, list.length - 1)];
  const doneCount = results.filter(Boolean).length;
  const succ = results.filter((r) => r?.success).length;

  async function onDone(r: SolveResult) {
    setResults((rs) => { const n = rs.slice(); n[idx] = r; return n; });
    if (mode === 'daily' && dailyRec) {
      const done = { ...dailyRec.done, [ex.id]: true };
      const all = dailyRec.items.every((i) => done[i.exerciseId]);
      const next = { ...dailyRec, done, completedAt: all ? (dailyRec.completedAt ?? Date.now()) : dailyRec.completedAt };
      setDailyRec(next); await DAILY.put(next);
    }
  }
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 sm:px-0">
        <div><a href="#/training" className="text-xs text-ink-400 hover:text-ink-200">← Training</a><h1 className="h-display text-xl sm:text-2xl">{title}</h1></div>
        <div className="flex items-center gap-1.5">
          {list.map((e, i) => <button key={e.id} onClick={() => setIdx(i)} aria-label={`Exercise ${i + 1}`} className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ${results[i] ? (results[i]!.success ? 'bg-good' : 'bg-blunder') : dailyRec?.done[e.id] ? 'bg-ink-400' : i === idx ? 'bg-brass-400' : 'bg-ink-600'}`} />)}
        </div>
      </div>
      {finished ? (
        <Card className="max-w-lg mx-auto text-center">
          <div className="h-display text-3xl">{succ}/{doneCount}</div>
          <p className="mt-1 text-ink-300">solved this session{mode === 'daily' && dailyRec?.completedAt ? ' · daily challenge complete' : ''}</p>
          <p className="mt-3 text-sm text-ink-400">Missed positions return in your reviews tomorrow; solved ones come back later at growing intervals.</p>
          <div className="mt-5 flex justify-center gap-2"><a className="btn" href="#/training">Back to training</a><button className="btn btn-primary" onClick={() => { setList(buildSession(data, mode, theme, dailyRec ?? undefined)); setIdx(0); setResults([]); }}>New session</button></div>
        </Card>
      ) : (
        <Solver key={ex.id + idx} ex={ex} mode={mode} onDone={onDone} onNext={() => setIdx(idx + 1)} />
      )}
      {!finished && <div className="mt-3 flex justify-center"><button className="btn btn-ghost btn-sm" onClick={() => setIdx(list.length)}>End session</button></div>}
    </div>
  );
}

function SingleExercise({ data, id }: { data: AppData; id: string }) {
  const ex = data.exercises.find((e) => e.id === id);
  if (!ex) return <Page title="Exercise"><Empty>Exercise not found.</Empty></Page>;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 px-2 sm:px-0"><a href="#/training" className="text-xs text-ink-400 hover:text-ink-200">← Training</a><h1 className="h-display text-xl sm:text-2xl">{ex.title ?? THEME_LABEL[ex.theme] ?? 'Exercise'}</h1></div>
      <Solver ex={ex} mode="single" />
    </div>
  );
}
