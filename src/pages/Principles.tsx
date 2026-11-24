// PRINCIPLES: chess principles taught as guided lessons. The coach explains
// on a real position step by step, then "your move" challenges make you apply
// the idea (checked against the answer, then Stockfish, and explained when wrong).
// Lessons that fix your own weaknesses come first.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Page, Card, Spinner, Empty, Bar } from '../ui/common';
import { Board, type Arrow } from '../ui/Board';
import { CoachSays, CoachAvatar, type Mood } from '../ui/Coach';
import { Explained } from '../ui/Explained';
import { useAppData, type AppData } from '../services/data';
import { PRINCIPLES, PRINCIPLE_BY_ID, CATEGORIES, LEVEL_LABEL, principlesFor, type Principle, type LessonStep } from '../data/principles';
import { WEAKNESS } from '../training/themes';
import { coachEngine } from '../engine/browser';
import { scoreOf, winPct, EngineCancelled } from '../engine/uci';
import { tryMove } from '../chess/util';
import { tryIdea, type Verdict } from '../coach/teach';
import { levelFor } from '../coach/explain';
import { go } from '../services/router';
import { playSound } from '../services/sound';

const DONE_KEY = 'chessmind-lessons-done';
function loadDone(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
function markDone(id: string) {
  try { const s = loadDone(); s.add(id); localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch { /* storage unavailable */ }
}

export function PrinciplesPage({ route }: { route: string[] }) {
  const [data] = useAppData();
  if (!data) return <Page title="Principles"><Spinner /></Page>;
  if (route[0] === 'lesson' && route[1]) {
    const p = PRINCIPLE_BY_ID.get(route[1]);
    return p ? <Lesson key={p.id} p={p} data={data} /> : <Page title="Principles"><Empty>Lesson not found.</Empty></Page>;
  }
  return <Home data={data} />;
}

function Home({ data }: { data: AppData }) {
  const done = useMemo(loadDone, []);
  const top = data.profile.top.map((w) => w.key);
  const recs = principlesFor([...top, ...data.profile.stats.slice(0, 6).map((s) => s.key)]).slice(0, 4);
  const level = levelFor(data.strength.rating, data.settings.coachLevel);
  const [cat, setCat] = useState<string>('all');
  const list = PRINCIPLES.filter((p) => cat === 'all' || p.category === cat);
  return (
    <Page title="Principles" subtitle="The ideas strong players use without thinking, taught on real positions. Each lesson ends with challenges on the board.">
      <Card className="card-hi mb-5">
        <CoachSays mood="happy" size={64}>
          {recs.length
            ? <>From your games, these lessons hit your biggest leaks first: <b>{top.map((k) => WEAKNESS[k]?.label).filter(Boolean).join(', ') || 'your recent mistakes'}</b>. Do one a day, then train the matching exercises right after.</>
            : <>Play or import a few games and I'll put the lessons that fix your mistakes at the top. Meanwhile start with <b>Checks, captures, threats</b>: it is the habit that separates 1500 from 2000.</>}
          <span className="block mt-1 text-xs text-ink-400">{done.size}/{PRINCIPLES.length} lessons done · explanations at {level === 'beginner' ? 'simple' : level === 'intermediate' ? 'club' : 'advanced'} level</span>
        </CoachSays>
        <div className="mt-3"><Bar value={done.size} max={PRINCIPLES.length} /></div>
        {recs.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{recs.map((p) => <LessonCard key={p.id} p={p} done={done.has(p.id)} why={p.fixes.filter((k) => top.includes(k)).map((k) => WEAKNESS[k]?.label).join(', ')} />)}</div>}
      </Card>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {['all', ...CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} className={`chip !py-1 ${cat === c ? 'text-brass-300 border-brass-600' : ''}`}>{c === 'all' ? 'All' : c}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => <LessonCard key={p.id} p={p} done={done.has(p.id)} />)}</div>
    </Page>
  );
}

function LessonCard({ p, done, why }: { p: Principle; done: boolean; why?: string }) {
  const tasks = p.steps.filter((s) => s.task).length;
  return (
    <a href={`#/principles/lesson/${p.id}`} className="card p-4 hover:border-ink-500 transition-colors flex flex-col">
      <div className="flex items-center justify-between gap-2"><span className="label">{p.category}</span><span className="chip !text-[10px]">{LEVEL_LABEL[p.level]}</span></div>
      <div className="mt-1 font-semibold h-display text-lg leading-snug">{p.title}{done && <span className="ml-1 text-good text-sm">✓</span>}</div>
      <p className="mt-1 text-sm text-ink-300 flex-1">{p.rule}</p>
      <div className="mt-2 text-[11px] text-ink-500">{p.steps.length} steps{tasks ? ` · ${tasks} challenge${tasks > 1 ? 's' : ''}` : ''}{why ? ` · fixes: ${why}` : ''}</div>
    </a>
  );
}

/** The position (FEN) for each step: a step without a position keeps the previous one. */
function positions(steps: LessonStep[]): string[] {
  let fen = new Chess().fen();
  return steps.map((s) => {
    if (s.fen) fen = new Chess(s.fen).fen();
    if (s.moves) { const c = new Chess(); for (const m of s.moves.split(' ')) c.move(m); fen = c.fen(); }
    return fen;
  });
}
function lastMoveOf(s: LessonStep): [string, string] | undefined {
  if (!s.moves) return undefined;
  const c = new Chess(); let last;
  for (const m of s.moves.split(' ')) last = c.move(m);
  return last ? [last.from, last.to] : undefined;
}

function Lesson({ p, data }: { p: Principle; data: AppData }) {
  const level = levelFor(data.strength.rating, data.settings.coachLevel);
  const fens = useMemo(() => positions(p.steps), [p.id]);
  const [i, setI] = useState(0);
  const [fen, setFen] = useState(fens[0]);
  const [state, setState] = useState<'idle' | 'checking' | 'right' | 'wrong' | 'shown'>('idle');
  const [msg, setMsg] = useState('');
  const [why, setWhy] = useState<Verdict | null>(null);
  const [last, setLast] = useState<[string, string] | undefined>();
  const [finished, setFinished] = useState(false);
  const step = p.steps[i];
  const task = step.task;
  const base = fens[i];
  const side = new Chess(base).turn();
  useEffect(() => { setFen(base); setState('idle'); setMsg(''); setWhy(null); setLast(lastMoveOf(step)); }, [i]);

  const arrows: Arrow[] = state === 'right' || state === 'wrong' ? [] : (step.arrows ?? []).map((a) => {
    const [mv, color] = a.split(':');
    return { from: mv.slice(0, 2), to: mv.slice(2, 4), color: (color as Arrow['color']) ?? 'green' };
  });
  const highlights = Object.fromEntries((step.marks ?? []).map((m) => [m, 'hl-info' as const]));

  async function onMove(uci: string) {
    if (!task || state === 'checking' || state === 'right') return;
    const c = new Chess(base);
    const mv = tryMove(c, uci);
    if (!mv) return;
    setFen(c.fen()); setLast([mv.from, mv.to]); setWhy(null);
    if (task.answers.includes(mv.san)) { win(mv.san, mv.san === task.answers[0]); return; }
    // Not in the list: ask Stockfish whether it is just as good.
    setState('checking'); setMsg('Checking your move with Stockfish…');
    try {
      const best = (await coachEngine.analyze(base, { depth: 14 })).lines[0];
      const after = c.isGameOver() ? null : (await coachEngine.analyze(c.fen(), { depth: 13 })).lines[0];
      const wB = winPct(scoreOf(best)), wM = after ? winPct(-scoreOf(after)) : (c.isCheckmate() ? 100 : 50);
      if (wB - wM <= 3) { win(mv.san, false, true); return; }
      setState('wrong'); playSound('bad');
      setMsg(`${mv.san} is not it. ${task.wrong ?? ''}`.trim());
      const v = await tryIdea(coachEngine, base, uci, level);
      setWhy(v);
    } catch (e) {
      if (!(e instanceof EngineCancelled)) { setState('wrong'); setMsg(`${mv.san} is not the move I was looking for. ${task.hint}`); }
    }
  }
  function win(san: string, main: boolean, engine = false) {
    setState('right'); playSound('good');
    setMsg(main ? task!.success : engine ? `${san} works too: Stockfish rates it as good as the main idea. The lesson move was ${task!.answers[0]}. ${task!.success}` : `${san} is good too. ${task!.success}`);
  }
  function show() {
    const c = new Chess(base);
    const mv = c.move(task!.answers[0]);
    setFen(c.fen()); setLast([mv.from, mv.to]); setState('shown'); setWhy(null);
    setMsg(`The answer: ${mv.san}. ${task!.success}`);
  }
  function next() {
    if (i < p.steps.length - 1) setI(i + 1);
    else { markDone(p.id); setFinished(true); playSound('good'); }
  }
  const mood: Mood = state === 'right' ? 'cool' : state === 'wrong' ? 'concerned' : state === 'checking' ? 'thinking' : task ? 'thinking' : 'neutral';
  const canGoOn = !task || state === 'right' || state === 'shown';

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 px-2 sm:px-0"><a href="#/principles" className="text-xs text-ink-400 hover:text-ink-200">← Principles</a>
        <h1 className="h-display text-2xl">{p.title}</h1><p className="text-sm text-ink-300">{p.rule}</p></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-200px))]">
          <Board fen={fen} orientation={side === 'w' ? 'white' : 'black'} movable={task && (state === 'idle' || state === 'wrong') && !finished ? (side === 'w' ? 'white' : 'black') : 'none'}
            onMove={onMove} lastMove={last} arrows={arrows} highlights={highlights} theme={data.settings.boardTheme} coords={data.settings.showCoords} />
        </div>
        <div className="space-y-3">
          {!finished ? (
            <Card>
              <div className="mb-3 flex gap-1">{p.steps.map((s, j) => <span key={j} className={`h-1.5 flex-1 rounded-full ${j < i ? 'bg-brass-500' : j === i ? 'bg-brass-300' : 'bg-ink-700'} ${s.task ? 'ring-1 ring-brass-600/60' : ''}`} />)}</div>
              <CoachSays mood={mood} size={60}>
                <Explained text={step.say} />
                {task && <span className="mt-2 block font-semibold text-brass-300">Your move: {task.prompt}</span>}
              </CoachSays>
              {msg && <p className={`mt-3 text-sm ${state === 'right' || state === 'shown' ? 'text-good' : state === 'wrong' ? 'text-mistake' : 'text-ink-300'}`}><Explained text={msg} /></p>}
              {why && !why.ok && (
                <div className="mt-2 rounded-lg bg-blunder/10 ring-1 ring-blunder/30 p-3 text-sm">
                  <p className="text-ink-100"><Explained text={why.reason} /></p>
                  <ol className="mt-1 space-y-0.5">{why.story.slice(0, 5).map((st, j) => <li key={j} className="text-ink-300"><span className="font-mono text-xs text-ink-500 mr-1">{j + 1}.</span><Explained text={st.text} /></li>)}</ol>
                  <p className="mt-1 text-ink-300">Result: <b className="text-ink-100">{why.result}</b>.</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {i > 0 && <button className="btn btn-sm" onClick={() => setI(i - 1)}>← Back</button>}
                {task && state === 'wrong' && <button className="btn btn-sm" onClick={() => { setFen(base); setState('idle'); setMsg(`Hint: ${task.hint}`); setWhy(null); setLast(undefined); }}>Try again (hint)</button>}
                {task && !canGoOn && <button className="btn btn-sm" onClick={show}>Show me</button>}
                <button className="btn btn-primary btn-sm" disabled={!canGoOn} onClick={next}>{i < p.steps.length - 1 ? 'Next →' : 'Finish lesson'}</button>
              </div>
            </Card>
          ) : (
            <Card className="card-hi">
              <div className="flex items-center gap-3"><CoachAvatar mood="cool" size={64} /><div className="h-display text-xl">Lesson complete</div></div>
              <div className="label mt-4 mb-1">Remember</div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-ink-200">{p.takeaways.map((t) => <li key={t}><Explained text={t} /></li>)}</ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.fixes[0] && <button className="btn btn-primary btn-sm" onClick={() => go(`training/session/weakness/${p.fixes[0]}`)}>Train it now: {WEAKNESS[p.fixes[0]]?.label}</button>}
                {p.endgame && <button className="btn btn-sm" onClick={() => go(`training/solve/theory-${p.endgame}`)}>Play the endgame vs Stockfish</button>}
                <button className="btn btn-sm" onClick={() => { setFinished(false); setI(0); }}>Replay</button>
                <button className="btn btn-sm" onClick={() => go('principles')}>All lessons</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
