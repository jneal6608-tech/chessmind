import { Explained } from '../ui/Explained';
// GAME REVIEW: list of games, PGN import, and the interactive review of one
// game with critical moments taught step by step.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { Board, type Arrow } from '../ui/Board';
import { EvalBar } from '../ui/EvalBar';
import { MoveList } from '../ui/MoveList';
import { Page, Card, Empty, Spinner, Stat, ResultBadge, fmtDate, Modal, Segmented } from '../ui/common';
import { useAppData } from '../services/data';
import { subscribeQueue, analyzeSoon, type QueueStatus } from '../services/analysisQueue';
import { games as G, ratings } from '../store/db';
import { saveSettings } from '../store/settings';
import { splitPgn, parseGame, fetchLichess, fetchChessCom, exportPgn, download, sameGame } from '../services/importer';
import { explainMove, levelFor, summaryLine } from '../coach/explain';
import { storyFor, describeMove, type Step } from '../coach/teach';
import { IdeaLab } from '../ui/IdeaLab';
import { AnalysisBoard } from '../ui/AnalysisBoard';
import { CLASS_LABEL, CLASS_MEANING, CLASS_ORDER } from '../ui/classes';
import { compareMoves, alternativeCaptures, type Comparison } from '../coach/compare';
import { WEAKNESS, THEME_LABEL } from '../training/themes';
import { go } from '../services/router';
import { tryMove, uid, formatLine, START_FEN } from '../chess/util';
import type { GameRecord, MoveAnalysis } from '../analysis/types';
import { pick } from '../training/select';
import { formatScore } from '../engine/uci';

export function ReviewPage({ id }: { id?: string }) {
  return id ? <GameReview id={id} /> : <GameList />;
}

function useQueue() {
  const [q, setQ] = useState<QueueStatus | null>(null);
  useEffect(() => subscribeQueue(setQ), []);
  return q;
}

function GameList() {
  const [data] = useAppData();
  const q = useQueue();
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'play' | 'import'>('all');
  useEffect(() => { analyzeSoon(); }, []);
  if (!data) return <Page title="Game Analysis"><Spinner /></Page>;
  const list = data.games.slice().reverse().filter((g) => filter === 'all' || g.source === filter);
  return (
    <Page title="Game Analysis" subtitle="Every game is analysed by Stockfish. Open one to see the critical moments and what to learn from them."
      actions={<>
        <button className="btn" onClick={() => setImportOpen(true)}>Import games</button>
        <button className="btn" disabled={!data.games.length} onClick={() => download(`chessmind-games-${new Date().toISOString().slice(0, 10)}.pgn`, exportPgn(data.games))}>Export PGN</button>
      </>}>
      {q?.gameId && (
        <div className="mb-4 card p-3 flex items-center gap-3 text-sm">
          <Spinner /> Analysing game ({q.done}/{q.total} positions){q.pending > 1 ? ` · ${q.pending - 1} more queued` : ''}
        </div>
      )}
      {q?.error && <div className="mb-4 card p-3 text-sm text-blunder">{q.error} <button className="btn btn-sm ml-2" onClick={() => analyzeSoon()}>Retry</button></div>}
      <div className="mb-3"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'play', label: 'Played here' }, { value: 'import', label: 'Imported' }]} /></div>
      {!list.length ? (
        <Empty>No games yet. <a className="text-brass-300 underline" href="#/play">Play a game</a> or import your games from Lichess, Chess.com or a PGN file.</Empty>
      ) : (
        <div className="card divide-y divide-ink-700 overflow-hidden">
          {list.map((g) => {
            const a = g.analysis;
            const c = a?.counts[g.userColor];
            return (
              <a key={g.id} href={`#/review/${g.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-ink-800/70 transition-colors">
                <ResultBadge result={g.result} color={g.userColor} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.userColor === 'w' ? 'White' : 'Black'} vs {g.opponent.name}{g.opponent.elo ? <span className="text-ink-400"> ({g.opponent.elo})</span> : null}</div>
                  <div className="truncate text-xs text-ink-400">{fmtDate(g.date)} · {g.opening?.name ?? 'Unknown opening'} · {Math.ceil(g.moves.length / 2)} moves{g.source === 'import' ? ' · imported' : ''}</div>
                </div>
                {a && c ? (
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="text-ink-200 font-semibold text-sm">{a.accuracy[g.userColor].toFixed(0)}%</span>
                    <span className="cls-blunder">{c.blunder}??</span><span className="cls-mistake">{c.mistake + c.miss}?</span><span className="cls-inaccuracy">{c.inaccuracy}?!</span>
                  </div>
                ) : <span className="text-xs text-ink-400 flex items-center gap-2">{q?.gameId === g.id ? <><Spinner /> analysing</> : 'queued'}</span>}
              </a>
            );
          })}
        </div>
      )}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </Page>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data] = useAppData();
  const [tab, setTab] = useState<'pgn' | 'lichess' | 'chesscom'>('pgn');
  const [text, setText] = useState('');
  const [user, setUser] = useState('');
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function importText(pgnText: string, extraNames: string[] = []) {
    const names = [data!.settings.playerName, ...data!.settings.aliases, ...extraNames];
    const parts = splitPgn(pgnText);
    if (!parts.length) { setMsg('No games found in that text.'); return; }
    let added = 0, skipped = 0, failed = 0, unknownColor = 0;
    for (const p of parts) {
      try {
        const pg = parseGame(p, names, color);
        if (pg.rec.moves.length < 2) { failed++; continue; }
        if (!pg.colorKnown) unknownColor++;
        if (data!.games.some((g) => sameGame(g, pg.rec))) { skipped++; continue; }
        await G.put(pg.rec);
        added++;
      } catch { failed++; }
    }
    if (extraNames.length) await saveSettings({ aliases: [...new Set([...data!.settings.aliases, ...extraNames])] });
    setMsg(`Imported ${added} game${added === 1 ? '' : 's'}${skipped ? `, ${skipped} already present` : ''}${failed ? `, ${failed} could not be read` : ''}.${unknownColor ? ` For ${unknownColor} game(s) your name was not found in the headers, so you were assumed to be ${color === 'w' ? 'White' : 'Black'}. Add your usernames in Settings to fix this.` : ''} Analysis has started.`);
    analyzeSoon();
  }
  async function fetchOnline() {
    if (!user.trim()) return;
    setBusy(true); setMsg('');
    try {
      if (tab === 'lichess') await importText(await fetchLichess(user.trim()), [user.trim()]);
      else {
        const r = await fetchChessCom(user.trim());
        await importText(r.pgn, [user.trim()]);
        if (r.rapid) await ratings.put({ id: uid(), date: Date.now(), platform: 'Chess.com', timeControl: 'rapid', rating: r.rapid });
      }
    } catch (e) {
      setMsg(e instanceof TypeError ? 'Could not reach the site (offline, or blocked by your network). You can still paste a PGN export.' : (e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Import games">
      <div className="space-y-3">
        <Segmented value={tab} onChange={(v) => { setTab(v); setMsg(''); }} options={[{ value: 'pgn', label: 'PGN' }, { value: 'lichess', label: 'Lichess' }, { value: 'chesscom', label: 'Chess.com' }]} />
        {tab === 'pgn' ? (
          <>
            <textarea className="input h-40 font-mono text-xs" placeholder="Paste one or more games in PGN format…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center justify-between gap-2">
              <label className="btn btn-sm cursor-pointer">Choose file…<input type="file" accept=".pgn,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label>
              <div className="flex items-center gap-2 text-xs text-ink-300">If your name isn't in the headers, I played
                <select className="input !w-auto !py-1" value={color} onChange={(e) => setColor(e.target.value as 'w' | 'b')}><option value="w">White</option><option value="b">Black</option></select></div>
            </div>
            <button className="btn btn-primary w-full" disabled={!text.trim() || busy} onClick={async () => { setBusy(true); await importText(text); setBusy(false); }}>Import</button>
          </>
        ) : (
          <>
            <input className="input" placeholder={`${tab === 'lichess' ? 'Lichess' : 'Chess.com'} username`} value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchOnline()} />
            <p className="text-xs text-ink-400">Fetches your 20 most recent games{tab === 'chesscom' ? ' and your current rapid rating' : ''} directly from {tab === 'lichess' ? 'lichess.org' : 'chess.com'} (public data, no login).</p>
            <button className="btn btn-primary w-full" disabled={busy || !user.trim()} onClick={fetchOnline}>{busy ? <Spinner /> : 'Fetch games'}</button>
          </>
        )}
        {msg && <p className="text-sm text-ink-200">{msg}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function GameReview({ id }: { id: string }) {
  const [data] = useAppData();
  const q = useQueue();
  const game = data?.games.find((g) => g.id === id);
  const [ply, setPly] = useState(-1); // -1 = start position
  const [focus, setFocus] = useState<number | null>(null); // a critical move being studied
  const [step, setStep] = useState(0);
  const [lineStep, setLineStep] = useState(0);
  const [flip, setFlip] = useState<boolean | null>(null);
  const [del, setDel] = useState(false);
  const [lab, setLab] = useState(false);
  const [explore, setExplore] = useState<{ fen: string; gameMove?: string; initialLine?: string[]; title?: string } | null>(null);
  useEffect(() => { if (game && !game.analysis) analyzeSoon(game.id); }, [game?.id, !!game?.analysis]);

  const fens = useMemo(() => {
    if (!game) return [];
    const c = new Chess(game.startFen ?? START_FEN);
    const out = [c.fen()];
    for (const m of game.moves) { tryMove(c, m); out.push(c.fen()); }
    return out;
  }, [game?.id]);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (!game || (e.target as HTMLElement).tagName === 'INPUT' || document.querySelector('[data-explorer]')) return;
      if (e.key === 'ArrowLeft') { setFocus(null); setPly((p) => Math.max(-1, p - 1)); }
      if (e.key === 'ArrowRight') { setFocus(null); setPly((p) => Math.min(game.moves.length - 1, p + 1)); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [game?.id]);

  if (!data) return <Page title="Review"><Spinner /></Page>;
  if (!game) return <Page title="Game not found"><Empty>This game does not exist (it may have been deleted). <a href="#/review" className="underline text-brass-300">Back to games</a></Empty></Page>;

  const a = game.analysis;
  const level = levelFor(data.strength.rating, data.settings.coachLevel);
  const orientation = (flip ?? game.userColor === 'b') ? 'black' : 'white';
  const ma: MoveAnalysis | undefined = a && ply >= 0 ? a.moves[ply] : undefined;
  const focusMove = a && focus !== null ? a.moves[focus] : undefined;

  // Board state for the guided critical-move walkthrough
  let boardFen = fens[ply + 1] ?? fens[0];
  let arrows: Arrow[] = [];
  let last: [string, string] | undefined = ply >= 0 ? [game.moves[ply].slice(0, 2), game.moves[ply].slice(2, 4)] : undefined;
  let highlights: Record<string, 'hl-good' | 'hl-bad' | 'hl-info'> = {};
  let evalShown: number | null = ma ? ma.evalAfter : a ? a.moves[0]?.evalBefore ?? 0 : null;
  const mineStory = focusMove ? storyFor(focusMove.fenBefore, [focusMove.uci, ...focusMove.replyLineUci], focusMove.color, level) : null;
  const bestStory = focusMove ? storyFor(focusMove.fenBefore, focusMove.bestLineUci, focusMove.color, level) : null;
  if (focusMove) {
    const story = step === 2 ? mineStory : step === 3 ? bestStory : null;
    if (step === 0) { boardFen = focusMove.fenBefore; last = undefined; evalShown = focusMove.evalBefore; if (focusMove.threatUci) arrows = [{ from: focusMove.threatUci.slice(0, 2), to: focusMove.threatUci.slice(2, 4), color: 'yellow' }]; }
    else if (step === 1) {
      boardFen = focusMove.fenAfter; last = [focusMove.uci.slice(0, 2), focusMove.uci.slice(2, 4)]; evalShown = focusMove.evalAfter;
      highlights = { [focusMove.uci.slice(2, 4)]: 'hl-bad' };
      if (focusMove.replyLineUci[0]) arrows = [{ from: focusMove.replyLineUci[0].slice(0, 2), to: focusMove.replyLineUci[0].slice(2, 4), color: 'red' }];
    } else if (story && story.steps.length) {
      const i = Math.min(lineStep, story.steps.length) - 1;
      const st = story.steps[Math.max(0, i)];
      boardFen = i < 0 ? focusMove.fenBefore : st.fenAfter;
      last = i < 0 ? undefined : [st.uci.slice(0, 2), st.uci.slice(2, 4)];
      const nx = story.steps[i + 1];
      if (nx) arrows = [{ from: nx.uci.slice(0, 2), to: nx.uci.slice(2, 4), color: step === 2 ? 'red' : 'green' }];
      evalShown = null;
    } else { boardFen = focusMove.fenBefore; last = undefined; }
  } else if (ma && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(ma.cls)) {
    arrows = [{ from: ma.bestUci.slice(0, 2), to: ma.bestUci.slice(2, 4), color: 'green' }];
  }

  const ex = focusMove ? explainMove(focusMove, level) : null;
  const ownExercise = focusMove ? data.exercises.find((e) => e.id === `game-${game.id}-${focusMove.ply}`) : undefined;
  const similarTheme = ownExercise?.theme ?? (focusMove?.tags[0] ? WEAKNESS[focusMove.tags[0].key]?.train[0] : undefined);
  const similar = similarTheme ? pick({ exercises: data.exercises.filter((e) => e.source !== 'game'), cards: data.cards, attempts: data.attempts, base: data.strength.rating }, { themes: [similarTheme], count: 1, includeDue: false, seed: focusMove!.ply + 1 })[0] : undefined;

  const chart = a ? [{ ply: 0, v: clamp(a.moves[0]?.evalBefore ?? 0) }, ...a.moves.map((m) => ({ ply: m.ply + 1, v: clamp(m.evalAfter) }))] : [];
  const mine = a?.moves.filter((m) => m.color === game.userColor) ?? [];
  const STEPS = ['Position', 'Your move', 'Why it fails', 'Better move', 'The lesson', 'Try it'];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 sm:px-0">
        <div className="min-w-0">
          <a href="#/review" className="text-xs text-ink-400 hover:text-ink-200">← All games</a>
          <h1 className="h-display text-xl sm:text-2xl truncate">You ({game.userColor === 'w' ? 'White' : 'Black'}) vs {game.opponent.name} <ResultBadge result={game.result} color={game.userColor} /></h1>
          <div className="text-xs text-ink-400">{fmtDate(game.date)} · {game.opening ? `${game.opening.eco} ${game.opening.name}` : 'Opening not identified'} · {game.termination || game.result}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setExplore({ fen: boardFen, gameMove: !focusMove ? game.moves[ply + 1] : undefined })}>Analyse from here</button>
          <button className="btn btn-sm" onClick={() => go(`coach/${encodeURIComponent(boardFen)}`)}>Ask the coach</button>
          <button className="btn btn-sm" onClick={() => download(`game-${game.id}.pgn`, game.pgn)}>PGN</button>
          <button className="btn btn-sm" onClick={() => setDel(true)}>Delete</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div>
          <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-180px))] gap-2">
            <EvalBar cp={evalShown} flipped={orientation === 'black'} />
            <div className="flex-1 min-w-0"><Board fen={boardFen} orientation={orientation} movable="none" lastMove={last} arrows={arrows} highlights={highlights} theme={data.settings.boardTheme} coords={data.settings.showCoords} /></div>
          </div>
          {a && (
            <div className="mt-3 card p-2 h-28">
              <ResponsiveContainer>
                <AreaChart data={chart} onClick={(e) => { const p = (e as { activeLabel?: number })?.activeLabel; if (typeof p === 'number') { setFocus(null); setPly(p - 1); } }}>
                  <defs><linearGradient id="evg" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stopColor="#ecebe6" stopOpacity={0.85} /><stop offset="50%" stopColor="#ecebe6" stopOpacity={0.05} /></linearGradient></defs>
                  <XAxis dataKey="ply" hide /><YAxis domain={[-6, 6]} hide />
                  <ReferenceLine y={0} stroke="#4a5060" />
                  {ply >= 0 && <ReferenceLine x={ply + 1} stroke="#d4b06a" />}
                  <Tooltip contentStyle={{ background: '#16181d', border: '1px solid #333845', borderRadius: 8, fontSize: 12 }} formatter={(v) => [(Number(v) > 0 ? '+' : '') + Number(v).toFixed(1), 'Eval']} labelFormatter={(l) => `Move ${Math.ceil(Number(l) / 2)}`} />
                  <Area type="monotone" dataKey="v" stroke="#d4b06a" strokeWidth={1.5} fill="url(#evg)" baseValue={0} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {!a ? (
            <Card><div className="flex items-center gap-3 text-sm"><Spinner /> {q?.gameId === game.id ? `Analysing… ${q.done}/${q.total} positions` : 'Waiting for analysis…'}</div></Card>
          ) : focusMove && ex ? (
            <Card className="border-brass-600/50" title={<span>Critical moment · move {Math.floor(focusMove.ply / 2) + 1}</span>} right={<button className="btn btn-ghost btn-sm" onClick={() => setFocus(null)}>✕</button>}>
              <div className="mb-3 grid grid-cols-3 sm:grid-cols-6 gap-1">{STEPS.map((s, i) => <button key={s} onClick={() => { if (i === 5) { setLab(true); return; } setStep(i); setLineStep(1); }} className={`rounded-md px-1 py-1 text-[11px] font-semibold ${i === step ? 'bg-brass-500/25 text-brass-300' : 'bg-ink-800 text-ink-400 hover:text-ink-200'}`}>{i + 1}. {s}</button>)}</div>
              <div className="text-sm leading-relaxed text-ink-200 min-h-[120px]">
                {step === 0 && <>
                  <p>It's your move as {focusMove.color === 'w' ? 'White' : 'Black'}.{focusMove.threatUci ? <> Careful: your opponent is threatening something (yellow arrow: <b>{focusMove.threatSan}</b>).</> : null}</p>
                  <p className="mt-2 text-ink-300">Before looking at the answer, ask yourself: what are all the checks, captures and attacks, for you and for them?</p>
                  <button className="btn btn-sm mt-3" onClick={() => setLab(true)}>Try a move here first</button>
                </>}
                {step === 1 && <>
                  <p><span className={`font-bold cls-${focusMove.cls}`}>{ex.headline}</span> {focusMove.timeMs !== undefined ? <span className="text-ink-400">(you spent {(focusMove.timeMs / 1000).toFixed(0)}s on it)</span> : null}</p>
                  <p className="mt-2"><Explained text={describeMove(focusMove.fenBefore, focusMove.uci, focusMove.color)} /></p>
                  <p className="mt-2 text-ink-300">{ex.problemShort}</p>
                </>}
                {step === 2 && mineStory && <>
                  <p className="font-semibold text-ink-100"><Explained text={focusMove.tags[0]?.why ?? 'Here is what your move allows.'} /></p>
                  <StoryList steps={mineStory.steps} at={lineStep} onPick={setLineStep} tone="bad" />
                  <p className="mt-2">So in the end <b className="text-blunder">{mineStory.result}</b>{mineStory.result.includes('checkmat') ? '' : <> and {ex.feelAfter}</>}.</p>
                  {focusMove.tags.length > 1 && <div className="mt-2 flex flex-wrap gap-1">{focusMove.tags.map((t) => <span key={t.key} className="chip" title={t.why}>{WEAKNESS[t.key]?.label ?? t.key} · {Math.round(t.confidence * 100)}% sure</span>)}</div>}
                </>}
                {step === 3 && bestStory && <>
                  <p className="font-semibold text-ink-100"><Explained text={`The better move was ${focusMove.bestSan}.${ex.bestIdea ? ` ${ex.bestIdea}` : ''}`} /></p>
                  <StoryList steps={bestStory.steps} at={lineStep} onPick={setLineStep} tone="good" />
                  <p className="mt-2">That way <b className="text-good">{bestStory.result}</b>.</p>
                  {(() => { const c = storedComparison(focusMove); return c && !c.equal ? <CompareBox c={c} /> : null; })()}
                  <button className="btn btn-sm mt-2" onClick={() => setExplore({ fen: focusMove.fenBefore, gameMove: focusMove.uci, title: `Move ${Math.floor(focusMove.ply / 2) + 1}: explore it yourself` })}>Explore both lines on the board</button>
                </>}
                {step === 4 && <><p className="font-semibold text-ink-100"><Explained text={ex.concept} /></p><p className="mt-2 text-ink-300">How to spot it next time: <Explained text={ex.recognize} /></p></>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {step < 4 ? <button className="btn btn-primary btn-sm" onClick={() => { setStep(step + 1); setLineStep(1); }}>Next →</button> : <button className="btn btn-primary btn-sm" onClick={() => setLab(true)}>Try your own ideas</button>}
                {(step === 2 || step === 3) && <button className="btn btn-sm" onClick={() => setLab(true)}>What if I play something else?</button>}
                {ownExercise && <button className="btn btn-sm" onClick={() => go(`training/solve/${ownExercise.id}`)}>Practise this position</button>}
                {similar && <button className="btn btn-sm" onClick={() => go(`training/solve/${similar.id}`)}>Similar exercise ({THEME_LABEL[similar.theme] ?? similar.theme})</button>}
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Your accuracy" value={`${a.accuracy[game.userColor].toFixed(0)}%`} sub={`Opponent ${a.accuracy[game.userColor === 'w' ? 'b' : 'w'].toFixed(0)}%`} />
                  <Stat label="Blunders" value={a.counts[game.userColor].blunder} tone="text-blunder" sub={`${a.counts[game.userColor].mistake} mistakes`} />
                  <Stat label="Missed wins" value={a.missedWins} tone="text-miss" sub={`${a.counts[game.userColor].inaccuracy} inaccuracies`} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  {(['opening', 'middlegame', 'endgame'] as const).map((ph) => (
                    <div key={ph} className="rounded-lg bg-ink-900 p-2">
                      <div className="label !text-[10px]">{ph}</div>
                      {a.phases[ph].moves ? <>
                        <div className="text-base font-semibold tabular-nums">{a.phases[ph].accuracy.toFixed(0)}%</div>
                        <div className="text-ink-400">{a.phases[ph].blunders}?? {a.phases[ph].mistakes}? {a.phases[ph].inaccuracies}?!</div>
                      </> : <div className="text-ink-500 mt-1">not reached</div>}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-ink-300">Best or excellent moves: <b className="text-best">{a.counts[game.userColor].best}</b> of {mine.filter((m) => m.cls !== 'forced').length}{game.opening ? ` · left the book after move ${Math.ceil(game.opening.ply / 2)}` : ''}</p>
                <p className="mt-2 text-[11px] text-ink-500">Stockfish depth {a.depth}. Accuracy measures how close your moves were to the engine's; it is not a rating.</p>
              </Card>
              {a.lessons.length > 0 && (
                <Card title="Three lessons from this game">
                  <ol className="space-y-2.5 text-sm">
                    {a.lessons.map((l, i) => (
                      <li key={l.key} className="flex gap-3">
                        <span className="h-display text-brass-400 text-lg leading-none">{i + 1}</span>
                        <div><div className="font-semibold">{WEAKNESS[l.key]?.label ?? l.key}</div>
                          {(() => { const m = a.moves[l.plies[0]]; const t = m?.tags.find((x) => x.key === l.key); return m && t ? <div className="mt-0.5 text-ink-200">In this game (move {Math.floor(m.ply / 2) + 1}, {m.san}): <Explained text={t.why} /></div> : null; })()}
                          <div className="mt-1 text-ink-400"><span className="text-brass-300">Rule of thumb:</span> <Explained text={l.text} /></div>
                          <div className="mt-1 flex gap-1 flex-wrap">{l.plies.slice(0, 4).map((p) => <button key={p} className="chip hover:border-brass-500" onClick={() => { setFocus(p); setStep(0); setPly(p); }}>move {Math.floor(p / 2) + 1}</button>)}</div></div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
              <Card title="Critical moments" right={<span className="text-xs text-ink-400">click to study</span>}>
                {a.critical.length ? (
                  <div className="space-y-1.5">
                    {a.critical.map((p) => { const m = a.moves[p]; return (
                      <button key={p} onClick={() => { setFocus(p); setStep(0); setLineStep(1); setPly(p); }} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink-800">
                        <span className={`h-2.5 w-2.5 rounded-full bg-cls-${m.cls}`} />
                        <span className="font-mono text-sm w-20">{Math.floor(p / 2) + 1}{m.color === 'w' ? '.' : '...'}{m.san}</span>
                        <span className="text-xs text-ink-300 truncate flex-1">{m.tags[0] ? WEAKNESS[m.tags[0].key]?.label : m.cls} · best {m.bestSan}</span>
                        <span className="text-xs text-ink-500 tabular-nums">-{m.winLoss.toFixed(0)}%</span>
                      </button>); })}
                  </div>
                ) : <p className="text-sm text-ink-300">No serious mistakes in this game. {mine.length ? 'Well played!' : ''}</p>}
              </Card>
            </>
          )}
          <Card className="!p-2">
            <div className="h-[200px]">
              <MoveList sans={game.sans} current={ply} classes={a?.moves.map((m) => m.cls)} onSelect={(i) => { setFocus(null); setPly(i); }} />
            </div>
            <div className="mt-2 flex justify-between gap-1 border-t border-ink-700 pt-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setFocus(null); setPly(-1); }} aria-label="Start">⏮</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setFocus(null); setPly((p) => Math.max(-1, p - 1)); }} aria-label="Back">◀</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setFocus(null); setPly((p) => Math.min(game.moves.length - 1, p + 1)); }} aria-label="Forward">▶</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setFocus(null); setPly(game.moves.length - 1); }} aria-label="End">⏭</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setFlip(orientation === 'white')} aria-label="Flip">⇅</button>
            </div>
          </Card>
          {ma && !focusMove && <MoveCard m={ma} mine={ma.color === game.userColor}
            onStudy={() => { setFocus(ma.ply); setStep(0); }}
            onExplore={(line) => setExplore({ fen: ma.fenBefore, gameMove: ma.uci, initialLine: line, title: `Move ${Math.floor(ma.ply / 2) + 1}${ma.color === 'w' ? '.' : '...'}${ma.san}: try it yourself` })} />}
          {a && <ClassTable a={a} userColor={game.userColor} onPick={(p) => { setFocus(null); setPly(p); }} />}
          {a && <p className="px-2 text-[11px] text-ink-500">{summaryLine('w', a.accuracy.w, a.counts.w)} {summaryLine('b', a.accuracy.b, a.counts.b)}</p>}
        </div>
      </div>
      {lab && focusMove && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-950/95 backdrop-blur p-2 sm:p-6">
          <div className="mx-auto max-w-[1280px]"><IdeaLab fen={focusMove.fenBefore} level={level} theme={data.settings.boardTheme} coords={data.settings.showCoords} onClose={() => setLab(false)}
            intro={`Move ${Math.floor(focusMove.ply / 2) + 1}: in the game you played ${focusMove.san}. Try any move here, and I'll show you what happens and why.`} /></div>
        </div>
      )}
      {explore && (
        <div data-explorer className="fixed inset-0 z-40 overflow-y-auto bg-ink-950/95 backdrop-blur p-2 sm:p-6">
          <div className="mx-auto max-w-[1320px]"><AnalysisBoard fen={explore.fen} gameMove={explore.gameMove} initialLine={explore.initialLine} orientation={orientation} theme={data.settings.boardTheme} coords={data.settings.showCoords}
            title={explore.title ?? 'Analyse from here'} onClose={() => setExplore(null)} /></div>
        </div>
      )}
      <Modal open={del} onClose={() => setDel(false)} title="Delete this game?">
        <p className="text-sm text-ink-300">The game and its analysis are removed from your history and weakness profile.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setDel(false)}>Cancel</button><button className="btn btn-primary" onClick={async () => { await G.del(game.id); go('review'); }}>Delete</button></div>
      </Modal>
    </div>
  );
}
/** "Why the best move was better than yours", from the stored review (no engine call). */
function storedComparison(m: MoveAnalysis): Comparison | null {
  if (!m.bestUci || m.bestUci === m.uci) return null;
  const sign = m.color === 'w' ? 1 : -1;
  const best = { uci: m.bestUci, san: m.bestSan, cp: m.bestCp ?? m.evalBefore * sign, pv: m.bestLineUci.length ? m.bestLineUci : [m.bestUci] };
  const mine = { uci: m.uci, san: m.san, cp: m.evalAfter * sign, pv: [m.uci, ...m.replyLineUci] };
  try { return compareMoves(m.fenBefore, best, mine); } catch { return null; }
}

function CompareBox({ c }: { c: Comparison }) {
  return (
    <div className="mt-2 rounded-lg bg-ink-900 p-2.5 text-sm">
      <div className="font-semibold text-ink-100"><Explained text={c.summary} /></div>
      <ul className="mt-1 list-disc pl-5 space-y-0.5 text-ink-300">{c.reasons.map((r, i) => <li key={i}><Explained text={r} /></li>)}</ul>
    </div>
  );
}

/** Details of one move: its label, what it does, and why the best move was better. */
function MoveCard({ m, mine, onStudy, onExplore }: { m: MoveAnalysis; mine: boolean; onStudy: () => void; onExplore: (line?: string[]) => void }) {
  const cmp = useMemo(() => storedComparison(m), [m.fenBefore, m.uci]);
  const bad = ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.cls);
  const altCaps = useMemo(() => alternativeCaptures(m.fenBefore).find((x) => x.ucis.includes(m.uci)), [m.fenBefore, m.uci]);
  const others = altCaps?.sans.filter((s) => s !== m.san) ?? [];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm"><span className="font-semibold">{Math.floor(m.ply / 2) + 1}{m.color === 'w' ? '.' : '...'}{m.san}</span>
          <span className={`ml-2 font-bold cls-${m.cls}`}>{CLASS_LABEL[m.cls]}</span>
          <span className="ml-1 text-xs text-ink-400">({mine ? 'you' : 'opponent'})</span></span>
        <span className="text-[11px] text-ink-400 tabular-nums">{m.cls !== 'book' && m.cls !== 'forced' ? `-${m.winLoss.toFixed(0)}% win chance` : ''}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-ink-400">{CLASS_MEANING[m.cls]}</p>
      <p className="mt-2 text-sm text-ink-200"><Explained text={describeMove(m.fenBefore, m.uci, m.color)} /></p>
      {m.tags[0] && bad && <p className="mt-1 text-xs text-ink-300"><Explained text={m.tags[0].why} /></p>}
      {cmp && m.cls !== 'best' && m.cls !== 'book' && m.cls !== 'forced' && !cmp.equal && <CompareBox c={cmp} />}
      {cmp && cmp.equal && m.cls !== 'best' && <p className="mt-2 text-xs text-ink-300">Stockfish slightly preferred <b>{m.bestSan}</b>, but the difference is tiny.</p>}
      {(m.cls === 'best' || m.cls === 'great' || m.cls === 'brilliant') && m.secondSan && m.secondSan !== m.san && m.bestCp !== undefined && m.secondCp !== undefined && (
        <p className="mt-2 text-xs text-ink-300">Next best was <b>{m.secondSan}</b> ({formatScore((m.color === 'w' ? 1 : -1) * m.secondCp)} instead of {formatScore((m.color === 'w' ? 1 : -1) * m.bestCp)}).</p>
      )}
      {others.length > 0 && <p className="mt-2 text-xs text-ink-300">You could also take on {altCaps!.square} with <b>{others.join(' or ')}</b>. Open the analysis board to see which capture is better and why.</p>}
      {m.bestLine.length > 0 && m.cls !== 'best' && m.cls !== 'book' && <div className="mt-2 text-xs text-ink-400"><span className="text-good">Best line:</span> <span className="font-mono">{formatLine(m.fenBefore, m.bestLine.slice(0, 6))}</span></div>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={() => onExplore()}>Try your own moves here</button>
        {m.bestUci !== m.uci && <button className="btn btn-sm" onClick={() => onExplore([m.bestUci])}>Explore {m.bestSan}</button>}
        {mine && bad && <button className="btn btn-sm" onClick={onStudy}>Study this move</button>}
      </div>
    </Card>
  );
}

/** How many moves of each kind, like the summary after a game. */
function ClassTable({ a, userColor, onPick }: { a: NonNullable<GameRecord['analysis']>; userColor: 'w' | 'b'; onPick: (ply: number) => void }) {
  const count = (c: 'w' | 'b', k: string) => a.moves.filter((m) => m.color === c && m.cls === k);
  const opp = userColor === 'w' ? 'b' : 'w';
  return (
    <Card title="Every move rated">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
        <span /><span className="label !text-[10px] text-right">You</span><span className="label !text-[10px] text-right">Opponent</span>
        {CLASS_ORDER.map((k) => {
          const mine = count(userColor, k), theirs = count(opp, k);
          if (!mine.length && !theirs.length) return null;
          return (
            <div key={k} className="contents">
              <span className={`cls-${k} font-semibold`} title={CLASS_MEANING[k]}>{CLASS_LABEL[k]}</span>
              <button className="text-right tabular-nums hover:underline disabled:no-underline" disabled={!mine.length} onClick={() => onPick(mine[0].ply)}>{mine.length}</button>
              <button className="text-right tabular-nums text-ink-300 hover:underline disabled:no-underline" disabled={!theirs.length} onClick={() => onPick(theirs[0].ply)}>{theirs.length}</button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-500">Click a move in the list to see why it got its label. Click a number to jump to the first such move.</p>
    </Card>
  );
}

function StoryList({ steps, at, onPick, tone }: { steps: Step[]; at: number; onPick: (n: number) => void; tone: 'good' | 'bad' }) {
  return (
    <ol className="mt-2 space-y-1">
      {steps.map((st, j) => (
        <li key={j} role="button" tabIndex={0} onClick={() => onPick(j + 1)} onKeyDown={(e) => e.key === 'Enter' && onPick(j + 1)} className={`cursor-pointer w-full text-left rounded-md px-2 py-1 ${j + 1 === at ? (tone === 'bad' ? 'bg-blunder/15 text-ink-100' : 'bg-good/15 text-ink-100') : 'text-ink-300 hover:bg-ink-800'}`}>
          <span className="font-mono text-xs text-ink-500 mr-1.5">{j + 1}.</span><Explained text={st.text} /></li>
      ))}
      <li className="text-[11px] text-ink-500 px-2">Click a step to see it on the board.</li>
    </ol>
  );
}
const clamp = (cp: number) => Math.max(-6, Math.min(6, cp / 100));
export type { GameRecord };
