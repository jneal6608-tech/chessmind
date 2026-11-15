import { Explained } from '../ui/Explained';
// OPENINGS: idea-first courses, line practice with spaced repetition, a
// personal repertoire builder, and how you actually score in each opening.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../ui/Board';
import { Page, Card, Empty, Spinner, Segmented, Modal, ResultBadge } from '../ui/common';
import { useAppData, type AppData } from '../services/data';
import { COURSES, type Course } from '../data/repertoire';
import { repertoire as REP, attempts, srs, type RepertoireLine } from '../store/db';
import { nextCard } from '../training/srs';
import { tryMove, uid, formatLine } from '../chess/util';
import { lookupOpening, openingFamily } from '../openings/identify';
import { resultFor } from '../ui/common';
import { playSound } from '../services/sound';
import { go } from '../services/router';

interface PLine { id: string; name: string; color: 'w' | 'b'; uci: string[]; san: string[]; notes: Record<number, string>; trap?: { badPly: number; text: string }; courseId?: string; custom?: boolean }

function toPLine(c: Course, l: Course['lines'][number]): PLine {
  const ch = new Chess();
  const uci: string[] = [], san: string[] = [];
  for (const s of l.san.split(' ')) { const m = ch.move(s); uci.push(m.lan); san.push(m.san); }
  return { id: l.id, name: l.name, color: c.color, uci, san, notes: l.notes ?? {}, trap: l.trap, courseId: c.id };
}
function customToPLine(r: RepertoireLine): PLine {
  const ch = new Chess();
  const san = r.moves.map((u) => tryMove(ch, u)?.san ?? u);
  return { id: r.id, name: r.name, color: r.color, uci: r.moves, san, notes: r.notes ? { [r.moves.length - 1]: r.notes } : {}, custom: true };
}

export function recommendCourses(d: AppData): { id: string; why: string }[] {
  const keys = new Set(d.profile.stats.slice(0, 6).map((s) => s.key));
  const out: { id: string; why: string }[] = [];
  if (keys.has('opening_development') || keys.has('early_queen') || keys.has('center_control'))
    out.push({ id: 'italian', why: 'Your games show slow development or early queen moves; the Italian is built on quick, natural development and castling.' });
  if (keys.has('king_safety') || keys.has('hanging_pieces') || keys.has('missed_threat'))
    out.push({ id: 'caro', why: 'You often face threats against loose pieces or your king; the Caro-Kann gives a solid structure with fewer early tactics.' });
  if (keys.has('missed_fork') || keys.has('missed_tactic') || keys.has('missed_pin'))
    out.push({ id: 'e5-black', why: 'Open games after 1...e5 create many tactical patterns: good practice for the tactics you miss.' });
  if (keys.has('passive_play') || keys.has('piece_placement') || keys.has('opening_unfamiliar'))
    out.push({ id: 'london', why: 'A system opening with the same plan against everything: fewer lines to learn, more time to understand middlegame plans.' });
  if (!out.length) out.push({ id: 'italian', why: 'A principled first repertoire as White.' }, { id: 'caro', why: 'A solid, idea-driven reply to 1.e4.' }, { id: 'qgd', why: 'A classical, sound reply to 1.d4.' });
  return out;
}

export function OpeningsPage({ route }: { route: string[] }) {
  const [data] = useAppData();
  if (!data) return <Page title="Openings"><Spinner /></Page>;
  if (route[0] === 'course' && route[1]) return <CourseView data={data} id={route[1]} />;
  if (route[0] === 'practice' && route[1]) return <PracticeView data={data} lineId={route[1]} />;
  return <OpeningsHome data={data} />;
}

function OpeningsHome({ data }: { data: AppData }) {
  const [tab, setTab] = useState<'courses' | 'mine' | 'stats'>('courses');
  const [builder, setBuilder] = useState(false);
  const recs = recommendCourses(data);
  const perf = useMemo(() => openingPerformance(data), [data]);
  return (
    <Page title="Openings" subtitle="Learn a small repertoire by its ideas, practise it until it is automatic, and see how each opening actually works out in your games."
      actions={<button className="btn" onClick={() => setBuilder(true)}>+ Add a line</button>}>
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'courses', label: 'Courses' }, { value: 'mine', label: 'My repertoire' }, { value: 'stats', label: 'Performance' }]} /></div>
      {tab === 'courses' && (
        <>
          <Card className="mb-5 card-hi" title="Recommended for you">
            <div className="grid gap-3 md:grid-cols-3">
              {recs.map((r) => { const c = COURSES.find((x) => x.id === r.id)!; return (
                <a key={r.id} href={`#/openings/course/${c.id}`} className="rounded-xl border border-brass-600/50 bg-brass-500/5 p-3 hover:border-brass-400">
                  <div className="font-semibold">{c.name} <span className="text-xs text-ink-400">as {c.color === 'w' ? 'White' : 'Black'}</span></div>
                  <p className="mt-1 text-xs text-ink-300">{r.why}</p>
                </a>); })}
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {COURSES.map((c) => {
              const lines = c.lines.map((l) => l.id);
              const practised = lines.filter((id) => data.cards.get(`line:${id}`)?.lastSuccess).length;
              return (
                <a key={c.id} href={`#/openings/course/${c.id}`} className="card p-4 hover:border-ink-500 transition-colors">
                  <div className="flex items-center justify-between"><div className="font-semibold text-lg h-display">{c.name}</div><span className="chip">{c.color === 'w' ? 'White' : 'Black'} · vs {c.vs}</span></div>
                  <p className="mt-2 text-sm text-ink-300">{c.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1">{c.style.map((s) => <span key={s} className="chip !text-[10px]">{s}</span>)}</div>
                  <div className="mt-3 text-xs text-ink-400">{practised}/{lines.length} lines mastered</div>
                </a>
              );
            })}
          </div>
        </>
      )}
      {tab === 'mine' && <MyRepertoire data={data} onAdd={() => setBuilder(true)} />}
      {tab === 'stats' && <PerformanceTable perf={perf} data={data} />}
      <Builder open={builder} onClose={() => setBuilder(false)} />
    </Page>
  );
}

function MyRepertoire({ data, onAdd }: { data: AppData; onAdd: () => void }) {
  const lines = data.repertoire;
  if (!lines.length) return <Empty>Your personal repertoire is empty. Add lines from a course ("Add to my repertoire") or record your own with <button className="underline text-brass-300" onClick={onAdd}>+ Add a line</button>.</Empty>;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(['w', 'b'] as const).map((col) => (
        <Card key={col} title={`As ${col === 'w' ? 'White' : 'Black'}`}>
          <div className="space-y-2">
            {lines.filter((l) => l.color === col).map((l) => { const p = customToPLine(l); const card = data.cards.get(`line:${l.id}`); return (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-900 px-3 py-2">
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{l.name}</div><div className="text-xs text-ink-400 font-mono truncate">{formatLine(new Chess().fen(), p.san)}</div>
                  <div className="text-[11px] text-ink-500">{card ? (card.lastSuccess ? `next review ${new Date(card.due).toLocaleDateString()}` : 'needs practice') : 'not practised yet'}</div></div>
                <div className="flex gap-1 shrink-0"><button className="btn btn-sm btn-primary" onClick={() => go(`openings/practice/${l.id}`)}>Practise</button><button className="btn btn-sm" onClick={() => REP.del(l.id)} aria-label="Remove">✕</button></div>
              </div>); })}
            {!lines.some((l) => l.color === col) && <p className="text-sm text-ink-400">No lines yet.</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CourseView({ data, id }: { data: AppData; id: string }) {
  const c = COURSES.find((x) => x.id === id);
  const [lineIdx, setLineIdx] = useState(0);
  const [ply, setPly] = useState(-1);
  if (!c) return <Page title="Course"><Empty>Not found.</Empty></Page>;
  const lines = c.lines.map((l) => toPLine(c, l));
  const line = lines[lineIdx];
  const ch = new Chess();
  for (const u of line.uci.slice(0, ply + 1)) tryMove(ch, u);
  const note = ply >= 0 ? line.notes[ply] : undefined;
  const lastU = ply >= 0 ? line.uci[ply] : undefined;
  const inRep = data.repertoire.some((r) => r.moves.join(' ') === line.uci.join(' '));
  const nameHere = lookupOpening(ch.fen())?.name;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 px-2 sm:px-0"><a href="#/openings" className="text-xs text-ink-400 hover:text-ink-200">← Openings</a><h1 className="h-display text-2xl">{c.name} <span className="text-base text-ink-400">as {c.color === 'w' ? 'White' : 'Black'}</span></h1></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-180px))]">
          <Board fen={ch.fen()} orientation={c.color === 'w' ? 'white' : 'black'} movable="none" lastMove={lastU ? [lastU.slice(0, 2), lastU.slice(2, 4)] : undefined}
            highlights={line.trap && ply === line.trap.badPly && lastU ? { [lastU.slice(2, 4)]: 'hl-info' } : undefined} theme={data.settings.boardTheme} />
          <div className="mt-2 flex justify-center gap-2">
            <button className="btn btn-sm" onClick={() => setPly(-1)}>⏮</button><button className="btn btn-sm" onClick={() => setPly(Math.max(-1, ply - 1))}>◀</button>
            <button className="btn btn-sm" onClick={() => setPly(Math.min(line.uci.length - 1, ply + 1))}>▶</button><button className="btn btn-sm" onClick={() => setPly(line.uci.length - 1)}>⏭</button>
          </div>
        </div>
        <div className="space-y-3">
          <Card title="Key ideas"><ul className="list-disc pl-5 space-y-1 text-sm text-ink-200">{c.ideas.map((x) => <li key={x}><Explained text={x} /></li>)}</ul>
            <div className="label mt-3 mb-1">Typical plans</div><ul className="list-disc pl-5 space-y-1 text-sm text-ink-300">{c.plans.map((x) => <li key={x}><Explained text={x} /></li>)}</ul></Card>
          <Card title="Lines">
            <div className="space-y-1">
              {lines.map((l, i) => (
                <button key={l.id} onClick={() => { setLineIdx(i); setPly(-1); }} className={`w-full rounded-lg px-3 py-2 text-left ${i === lineIdx ? 'bg-brass-500/15 ring-1 ring-brass-600' : 'hover:bg-ink-800'}`}>
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">{l.name}</span>{l.trap && <span className="chip !text-[10px] text-miss">trap</span>}</div>
                  <div className="text-[11px] text-ink-400">{data.cards.get(`line:${l.id}`)?.lastSuccess ? 'mastered for now ✓' : 'not mastered'}</div>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <div className="text-xs font-mono text-ink-300 leading-relaxed">
              {line.san.map((s, i) => <button key={i} onClick={() => setPly(i)} className={`mr-1 rounded px-0.5 ${i === ply ? 'bg-brass-500/30 text-brass-300' : 'hover:text-ink-100'} ${line.trap?.badPly === i ? 'underline decoration-miss' : ''}`}>{i % 2 === 0 ? `${i / 2 + 1}.` : ''}{s}</button>)}
            </div>
            <div className="mt-3 min-h-[3rem] text-sm text-ink-200">{note ? <Explained text={note} /> : (ply < 0 ? 'Step through the line with ▶. Each key move has a short note.' : nameHere ? <span className="text-ink-400">{nameHere}</span> : '')}</div>
            {line.trap && ply >= line.trap.badPly && <p className="mt-2 text-sm text-miss"><Explained text={line.trap.text} /></p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => go(`openings/practice/${line.id}`)}>Practise this line</button>
              <button className="btn btn-sm" disabled={inRep} onClick={() => REP.put({ id: uid(), color: c.color, name: `${c.name}: ${line.name}`, moves: line.uci, source: 'builtin', courseId: c.id, created: Date.now() })}>{inRep ? 'In my repertoire ✓' : 'Add to my repertoire'}</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function findLine(data: AppData, id: string): PLine | undefined {
  for (const c of COURSES) { const l = c.lines.find((x) => x.id === id); if (l) return toPLine(c, l); }
  const r = data.repertoire.find((x) => x.id === id);
  return r ? customToPLine(r) : undefined;
}

function PracticeView({ data, lineId }: { data: AppData; lineId: string }) {
  const line = findLine(data, lineId);
  const [ply, setPly] = useState(0); // moves played so far
  const [errors, setErrors] = useState(0);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [t0] = useState(Date.now());
  const [wrongSq, setWrongSq] = useState<string | null>(null);
  const userIdx = (i: number) => (line!.color === 'w' ? i % 2 === 0 : i % 2 === 1);
  // The app plays the other side automatically, and records the result at the end.
  useEffect(() => {
    if (!line || done) return;
    if (ply >= line.uci.length) {
      setDone(true);
      const success = errors === 0;
      void attempts.add({ id: uid(), exerciseId: `line:${line.id}`, date: Date.now(), success, timeMs: Date.now() - t0, theme: 'opening', kind: 'opening', rating: 1000 + line.uci.length * 25, hints: 0, mode: 'opening' });
      void srs.get(`line:${line.id}`).then((c) => srs.put(nextCard(c, `line:${line.id}`, success, Date.now() - t0)));
      playSound(success ? 'good' : 'move');
      return;
    }
    if (!userIdx(ply)) { const t = setTimeout(() => setPly(ply + 1), 450); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply, done, line?.id]);
  if (!line) return <Page title="Practice"><Empty>Line not found.</Empty></Page>;
  const ch = new Chess();
  for (const u of line.uci.slice(0, ply)) tryMove(ch, u);
  function onMove(uci: string) {
    if (done || !userIdx(ply)) return;
    const expected = line!.uci[ply];
    if (uci === expected) { setPly(ply + 1); setMsg(line!.notes[ply] ?? 'Correct.'); setWrongSq(null); playSound('move'); }
    else {
      setErrors((e) => e + 1);
      const san = new Chess(ch.fen()).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | undefined })?.san;
      setMsg(`${san} is not the repertoire move. ${line!.notes[ply] ? 'Hint: ' + line!.notes[ply] : 'Think about the main idea of this opening.'}`);
      setWrongSq(expected.slice(0, 2));
      playSound('bad');
    }
  }
  const lastU = ply > 0 ? line.uci[ply - 1] : undefined;
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 px-2 sm:px-0"><button onClick={() => history.back()} className="text-xs text-ink-400 hover:text-ink-200">← Back</button><h1 className="h-display text-2xl">Practise: {line.name}</h1></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-180px))]">
          <Board fen={ch.fen()} orientation={line.color === 'w' ? 'white' : 'black'} movable={!done && userIdx(ply) ? (line.color === 'w' ? 'white' : 'black') : 'none'} onMove={onMove}
            lastMove={lastU ? [lastU.slice(0, 2), lastU.slice(2, 4)] : undefined} highlights={wrongSq && errors > 1 ? { [wrongSq]: 'hl-info' } : undefined} theme={data.settings.boardTheme} />
        </div>
        <Card>
          <div className="text-sm text-ink-300">Play the {line.color === 'w' ? 'White' : 'Black'} moves of this line from memory. The other side moves automatically.</div>
          <div className="mt-3 text-xs font-mono text-ink-400">{formatLine(new Chess().fen(), line.san.slice(0, ply)) || '—'}</div>
          {msg && <p className="mt-3 text-sm text-ink-200"><Explained text={msg} /></p>}
          {line.trap && ply > line.trap.badPly && <p className="mt-3 text-sm text-miss">{line.trap.text}</p>}
          {done && <div className="mt-4">
            <div className={`font-semibold ${errors ? 'text-mistake' : 'text-good'}`}>{errors ? `Completed with ${errors} error${errors === 1 ? '' : 's'}: it comes back for review tomorrow.` : 'Perfect! This line comes back at a longer interval.'}</div>
            <div className="mt-3 flex gap-2"><button className="btn" onClick={() => { setPly(0); setErrors(0); setDone(false); setMsg(''); }}>Again</button><button className="btn btn-primary" onClick={() => history.back()}>Done</button></div>
          </div>}
        </Card>
      </div>
    </div>
  );
}

function Builder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [moves, setMoves] = useState<string[]>([]);
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [name, setName] = useState('');
  const ch = new Chess();
  for (const u of moves) tryMove(ch, u);
  const auto = lookupOpening(ch.fen())?.name;
  return (
    <Modal open={open} onClose={onClose} title="Add a repertoire line">
      <p className="text-xs text-ink-400 mb-2">Play the moves for both sides on the board.</p>
      <div className="max-w-[340px] mx-auto"><Board fen={ch.fen()} orientation={color === 'w' ? 'white' : 'black'} movable="both" onMove={(u) => setMoves([...moves, u])} lastMove={moves.length ? [moves[moves.length - 1].slice(0, 2), moves[moves.length - 1].slice(2, 4)] : undefined} /></div>
      <div className="mt-2 text-xs font-mono text-ink-300 min-h-4">{formatLine(new Chess().fen(), ch.history())}</div>
      <div className="mt-3 flex items-center gap-2"><Segmented value={color} onChange={setColor} options={[{ value: 'w', label: 'I play White' }, { value: 'b', label: 'I play Black' }]} />
        <button className="btn btn-sm" onClick={() => setMoves(moves.slice(0, -1))} disabled={!moves.length}>Undo</button></div>
      <input className="input mt-3" placeholder={auto ?? 'Name (e.g. "My Sicilian sideline")'} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={moves.length < 2} onClick={async () => { await REP.put({ id: uid(), color, name: name || auto || 'My line', moves, source: 'custom', created: Date.now() }); setMoves([]); setName(''); onClose(); }}>Save line</button></div>
    </Modal>
  );
}

interface PerfRow { family: string; color: 'w' | 'b'; games: number; w: number; d: number; l: number; acc: number; errors: number; ids: string[] }
export function openingPerformance(d: AppData): PerfRow[] {
  const map = new Map<string, PerfRow>();
  for (const g of d.games) {
    const fam = g.opening ? openingFamily(g.opening.name) : 'Unidentified';
    const k = `${fam}|${g.userColor}`;
    const row = map.get(k) ?? { family: fam, color: g.userColor, games: 0, w: 0, d: 0, l: 0, acc: 0, errors: 0, ids: [] };
    row.games++; row.ids.push(g.id);
    const r = resultFor(g.result, g.userColor);
    if (r === 'win') row.w++; else if (r === 'loss') row.l++; else if (r === 'draw') row.d++;
    if (g.analysis) { row.acc += g.analysis.phases.opening.accuracy; row.errors += g.analysis.phases.opening.mistakes + g.analysis.phases.opening.blunders; }
    map.set(k, row);
  }
  return [...map.values()].map((r) => {
    const analysed = d.games.filter((g) => r.ids.includes(g.id) && g.analysis && g.analysis.phases.opening.moves).length;
    return { ...r, acc: analysed ? r.acc / analysed : NaN, errors: analysed ? r.errors / analysed : NaN };
  }).sort((a, b) => b.games - a.games);
}

function PerformanceTable({ perf, data }: { perf: PerfRow[]; data: AppData }) {
  if (!perf.length) return <Empty>No games yet. Your results per opening appear here as you play.</Empty>;
  const openingMistakes = data.ownExercises.filter((e) => e.phase === 'opening');
  return (
    <div className="space-y-5">
      {(['w', 'b'] as const).map((col) => (
        <Card key={col} title={`As ${col === 'w' ? 'White' : 'Black'}`}>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left label"><th className="py-2 pr-2">Opening</th><th className="px-2">Games</th><th className="px-2">W / D / L</th><th className="px-2">Score</th><th className="px-2">Opening accuracy</th><th className="px-2">Errors / game</th></tr></thead>
            <tbody>{perf.filter((r) => r.color === col).map((r) => (
              <tr key={r.family} className="border-t border-ink-700">
                <td className="py-2 pr-2 font-medium">{r.family}</td><td className="px-2 tabular-nums">{r.games}</td>
                <td className="px-2 tabular-nums"><span className="text-good">{r.w}</span> / {r.d} / <span className="text-blunder">{r.l}</span></td>
                <td className="px-2 tabular-nums">{(((r.w + r.d / 2) / r.games) * 100).toFixed(0)}%</td>
                <td className="px-2 tabular-nums">{Number.isNaN(r.acc) ? '—' : `${r.acc.toFixed(0)}%`}</td>
                <td className="px-2 tabular-nums">{Number.isNaN(r.errors) ? '—' : r.errors.toFixed(1)}</td>
              </tr>))}</tbody>
          </table></div>
          {!perf.some((r) => r.color === col) && <p className="text-sm text-ink-400">No games with this colour yet.</p>}
        </Card>
      ))}
      <Card title="Opening mistakes from your games" right={openingMistakes.length ? <button className="btn btn-sm" onClick={() => go('training/session/mistakes')}>Practise</button> : null}>
        {openingMistakes.length ? <div className="space-y-1">{openingMistakes.slice(0, 8).map((e) => { const g = data.games.find((x) => x.id === e.gameId); return (
          <button key={e.id} onClick={() => go(`training/solve/${e.id}`)} className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-ink-800 text-left text-sm">
            <span>{e.title}</span>{g && <ResultBadge result={g.result} color={g.userColor} />}
          </button>); })}</div> : <p className="text-sm text-ink-400">No serious opening mistakes found yet.</p>}
      </Card>
    </div>
  );
}
