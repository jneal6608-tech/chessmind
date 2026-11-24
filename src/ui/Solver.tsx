import { Explained } from './Explained';
// Solves one exercise. Tactics: find the move(s); engine-checked alternatives
// that are just as good are accepted. Endgames: play the position out against
// Stockfish until the goal is reached or missed.
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type Arrow } from './Board';
import { Spinner } from './common';
import type { Exercise } from '../training/types';
import { coachEngine, playEngine } from '../engine/browser';
import { scoreOf, winPct, EngineCancelled } from '../engine/uci';
import { tryMove, sanOf, formatLine, pvToSan, material, uid } from '../chess/util';
import { THEME_LABEL } from '../training/themes';
import { attempts, srs } from '../store/db';
import { nextCard } from '../training/srs';
import { playSound } from '../services/sound';
import { tryIdea, storyFor, explainThreat, type Verdict, type Step, type ThreatInfo } from '../coach/teach';
import { CoachSays, type Mood } from './Coach';
import { THEME_GUIDE, coachIntro, guideFor } from '../data/themeGuides';
import { WhyBetter } from './WhyBetter';
import { buildHints } from '../coach/hints';
import { describeMove } from '../coach/teach';
import { useAppData } from '../services/data';
import { levelFor } from '../coach/explain';

export interface SolveResult { success: boolean; timeMs: number; hints: number }

export function Solver({ ex, mode, theme, onDone, onNext }: { ex: Exercise; mode: string; theme?: string; onDone?: (r: SolveResult) => void; onNext?: () => void }) {
  const [fen, setFen] = useState(ex.fen);
  const [step, setStep] = useState(0); // index into solution (solver moves are even)
  const [state, setState] = useState<'solving' | 'checking' | 'wrong' | 'solved' | 'failed' | 'replying'>('solving');
  const [msg, setMsg] = useState('');
  const [hints, setHints] = useState(0);
  const [hintLv, setHintLv] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [highlights, setHighlights] = useState<Record<string, 'hl-good' | 'hl-bad' | 'hl-info'>>({});
  const [last, setLast] = useState<[string, string] | undefined>();
  const [recorded, setRecorded] = useState(false);
  const [userPlies, setUserPlies] = useState(0);
  const [promoted, setPromoted] = useState(false);
  const [why, setWhy] = useState<Verdict | null>(null);
  const [showStep, setShowStep] = useState<{ steps: Step[]; i: number } | null>(null);
  const [threat, setThreat] = useState<ThreatInfo | null>(null);
  const [threatShown, setThreatShown] = useState(false);
  const [appData] = useAppData();
  const level = appData ? levelFor(appData.strength.rating, appData.settings.coachLevel) : 'beginner';
  const t0 = useRef(Date.now());
  const token = useRef(0);
  const side = new Chess(ex.fen).turn();
  const orientation = side === 'w' ? 'white' : 'black';
  const playout = ex.goal === 'win' || ex.goal === 'draw';
  const lastInfo = (() => {
    if (ex.prevFen && ex.lastMove) return { prevFen: ex.prevFen, uci: ex.lastMove };
    if (ex.gameId && ex.ply !== undefined && appData) {
      const m = appData.games.find((g) => g.id === ex.gameId)?.analysis?.moves.find((x) => x.ply === ex.ply! - 1);
      if (m && m.fenAfter.split(' ')[0] === ex.fen.split(' ')[0]) return { prevFen: m.fenBefore, uci: m.uci };
    }
    return null;
  })();
  const lastSq = (): [string, string] | undefined => (lastInfo ? [lastInfo.uci.slice(0, 2), lastInfo.uci.slice(2, 4)] : undefined);
  const lastText = lastInfo ? (() => { const san = sanOf(lastInfo.prevFen, lastInfo.uci); return { san, words: describeMove(lastInfo.prevFen, lastInfo.uci, side) }; })() : null;
  function replayLast() {
    if (!lastInfo || replaying) return;
    const mine = token.current;
    setReplaying(true); setArrows([]); setHighlights({});
    setFen(lastInfo.prevFen); setLast(undefined);
    setTimeout(() => {
      if (mine !== token.current) return;
      setFen(ex.fen); setLast(lastSq()); playSound('move'); setReplaying(false);
    }, 1100);
  }
  const defending = ex.goal === 'hold' || ex.theme === 'defense' || ex.theme === 'mating_threat';
  async function loadThreat(): Promise<ThreatInfo | null> {
    if (threat) return threat;
    const mine = token.current;
    try {
      const t = await explainThreat(coachEngine, ex.fen, level, ex.threat);
      if (mine === token.current || t) setThreat(t);
      return t;
    } catch { return null; }
  }
  async function revealThreat() {
    const t = await loadThreat();
    setThreatShown(true);
    if (t) setArrows([{ from: t.uci.slice(0, 2), to: t.uci.slice(2, 4), color: 'red' }]);
  }

  useEffect(() => {
    setFen(ex.fen); setStep(0); setState('solving'); setMsg(''); setHints(0); setHintLv(0); setReplaying(false); setArrows([]); setHighlights({}); setLast(lastSq());
    setRecorded(false); setUserPlies(0); setPromoted(false); setWhy(null); setShowStep(null); setThreat(null); setThreatShown(false); t0.current = Date.now(); token.current++;
    // A defence exercise: show where the threat comes from only on request (hint).
  }, [ex.id]);

  async function record(success: boolean) {
    if (recorded) return;
    setRecorded(true);
    const timeMs = Date.now() - t0.current;
    await attempts.add({ id: uid(), exerciseId: ex.id, date: Date.now(), success, timeMs, theme: theme ?? ex.theme, kind: ex.kind, rating: ex.rating, hints, mode });
    await srs.put(nextCard(await srs.get(ex.id), ex.id, success && hints === 0, timeMs));
    playSound(success ? 'good' : 'bad');
    onDone?.({ success, timeMs, hints });
  }

  function show(uci: string, color: Arrow['color'] = 'green') { setArrows([{ from: uci.slice(0, 2), to: uci.slice(2, 4), color }]); }

  async function onMove(uci: string) {
    if (state !== 'solving' && state !== 'wrong') return;
    setWhy(null); setShowStep(null);
    const c = new Chess(fen);
    const mv = tryMove(c, uci);
    if (!mv) return;
    setArrows([]); setHighlights({});
    if (playout) return playoutMove(uci, c);
    const expected = ex.solution[step];
    const mine = token.current;
    let ok = uci === expected || (expected && uci.slice(0, 4) === expected.slice(0, 4) && !expected[4] && !uci[4]);
    if (!ok && c.isCheckmate()) ok = true;
    if (!ok) {
      // Accept an alternative only if Stockfish says it is just as good.
      setState('checking');
      setFen(c.fen()); setLast([uci.slice(0, 2), uci.slice(2, 4)]);
      try {
        const best = (await coachEngine.analyze(fen, { depth: 14, multipv: 1 })).lines[0];
        const after = (await coachEngine.analyze(c.fen(), { depth: 13 })).lines[0];
        if (mine !== token.current) return;
        const wBest = winPct(scoreOf(best)), wMine = winPct(-scoreOf(after));
        const tol = ex.tolerance ?? (ex.goal === 'hold' ? 4 : 2.5);
        ok = wBest - wMine <= tol && (ex.goal === 'hold' ? true : wMine >= 60);
        if (ok) {
          // An equally good alternative ends the exercise: the scripted replies no longer apply.
          setMsg(`${mv.san} works too (engine agrees). The main line was ${sanOf(fen, ex.solution[step])}.`);
          setState('solved'); setHighlights({ [uci.slice(2, 4)]: 'hl-good' }); void record(true);
          return;
        }
      } catch (e) { if (e instanceof EngineCancelled) return; }
      if (!ok) {
        setState('wrong'); setHighlights({ [uci.slice(2, 4)]: 'hl-bad' });
        setMsg(`${mv.san} is not it. Here's why:`);
        void record(false);
        // Explain the failure in plain words, then put the position back for another try.
        tryIdea(coachEngine, fen, uci, level).then((v) => { if (mine === token.current) { setWhy({ ...v, better: undefined }); } }).catch(() => undefined);
        setTimeout(() => { if (mine === token.current) { setFen(fen); setLast(undefined); setHighlights({}); setState('wrong'); } }, 900);
        return;
      }
    }
    // Correct
    playSound(mv.captured ? 'capture' : 'move');
    setFen(c.fen()); setLast([uci.slice(0, 2), uci.slice(2, 4)]); setHighlights({ [uci.slice(2, 4)]: 'hl-good' });
    const reply = ex.solution[step + 1];
    if (!reply || c.isGameOver()) {
      setState('solved'); setMsg(successText()); void record(true); return;
    }
    setState('replying');
    setTimeout(() => {
      if (mine !== token.current) return;
      tryMove(c, reply);
      setFen(c.fen()); setLast([reply.slice(0, 2), reply.slice(2, 4)]); setHighlights({});
      playSound('move');
      if (step + 2 >= ex.solution.length) { setState('solved'); setMsg(successText()); void record(true); return; }
      setStep(step + 2); setHintLv(0); setState('solving'); setMsg('Correct. Keep going: what now?');
    }, 550);
  }

  useEffect(() => {
    if ((state === 'solved' || state === 'failed') && defending) { void loadThreat().then(() => setThreatShown(true)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  function successText() {
    return ex.explanation ? `Solved! ${cap(ex.explanation)}.` : 'Solved!';
  }

  // ----- endgame play-out against the engine -----
  async function playoutMove(uci: string, c: Chess) {
    const mine = token.current;
    const wasPromo = uci.length === 5;
    const nowPromoted = promoted || wasPromo;
    setPromoted(nowPromoted);
    setFen(c.fen()); setLast([uci.slice(0, 2), uci.slice(2, 4)]);
    const plies = userPlies + 1;
    setUserPlies(plies);
    playSound(c.isCheck() ? 'check' : 'move');
    if (c.isCheckmate()) { finishPlayout(ex.goal === 'win', 'Checkmate!'); return; }
    if (c.isDraw() || c.isStalemate()) { finishPlayout(ex.goal === 'draw', c.isStalemate() ? 'Stalemate.' : 'The game is drawn.'); return; }
    setState('replying');
    try {
      const r = await playEngine.analyze(c.fen(), { depth: 16, movetime: 900 });
      if (mine !== token.current) return;
      const oppScore = scoreOf(r.lines[0]); // opponent's view
      const my = -oppScore;
      const reply = r.bestmove!;
      tryMove(c, reply);
      setFen(c.fen()); setLast([reply.slice(0, 2), reply.slice(2, 4)]);
      if (c.isCheckmate()) { finishPlayout(false, 'You were checkmated.'); return; }
      if (c.isDraw() || c.isStalemate()) { finishPlayout(ex.goal === 'draw', 'The game is drawn.'); return; }
      if (ex.goal === 'win') {
        const m = material(c);
        const m0 = material(new Chess(ex.fen));
        // "Bare king" only counts as converted if the opponent started with material to lose.
        const oppBare = (side === 'w' ? m.b : m.w) === 0 && (side === 'w' ? m0.b : m0.w) > 0;
        if (my < 120) { finishPlayout(false, 'The win slipped away: the engine now thinks the position is no longer winning.'); return; }
        if ((nowPromoted || (oppBare && ex.theme !== 'eg_mate')) && my >= 500 && ex.theme !== 'eg_mate') { finishPlayout(true, nowPromoted ? 'Promoted with a winning position. Converted!' : 'Converted!'); return; }
      } else {
        if (my <= -300) { finishPlayout(false, 'The position is now lost. The draw slipped away.'); return; }
        if (plies >= 20) { finishPlayout(true, 'Held! Twenty moves of accurate defence and the engine cannot make progress.'); return; }
      }
      setState('solving');
      setMsg(ex.goal === 'win' ? (ex.theme === 'eg_mate' ? 'Keep going until checkmate.' : 'Keep converting: promote or mate.') : `Hold on: ${20 - plies} more moves.`);
    } catch (e) { if (!(e instanceof EngineCancelled)) setMsg('Engine error: ' + (e as Error).message); }
  }
  function finishPlayout(success: boolean, text: string) {
    setState(success ? 'solved' : 'failed'); setMsg(text); void record(success);
  }

  async function hint() {
    if (playout) {
      setHints((h) => h + 1);
      const r = await coachEngine.analyze(fen, { depth: 16 });
      if (r.bestmove) show(r.bestmove, 'blue');
      return;
    }
    const exp = ex.solution[step];
    if (!exp) return;
    setHints((h) => h + 1);
    if (defending && !threatShown && step === 0) { setMsg('Hint: here is what they are threatening. Now find the move that stops it.'); await revealThreat(); return; }
    // Teaching hints: the idea first, then the piece, then the move.
    const hs = buildHints(fen, exp);
    const h = hs[Math.min(hintLv, hs.length - 1)];
    if (!h) { show(exp, 'blue'); return; }
    setHintLv((n) => n + 1);
    setMsg(`Hint ${Math.min(hintLv + 1, 3)}/3: ${h.text}`);
    setHighlights(h.highlights);
    setArrows(h.arrow ? [{ from: h.arrow.from, to: h.arrow.to, color: 'blue' }] : []);
  }
  function reveal() {
    token.current++;
    if (!recorded) void record(false);
    if (playout) { setState('failed'); return; }
    // Animate the full solution from the start
    const c = new Chess(ex.fen);
    const sans = pvToSan(ex.fen, ex.solution);
    setFen(ex.fen); setLast(undefined); setHighlights({});
    show(ex.solution[0], 'green');
    setState('failed');
    setMsg(`Solution: ${formatLine(ex.fen, sans)}.${ex.explanation ? ' ' + cap(ex.explanation) + '.' : ''}`);
    let i = 0;
    const my = token.current;
    const tick = () => {
      if (my !== token.current || i >= ex.solution.length) return;
      tryMove(c, ex.solution[i]);
      setFen(c.fen()); setLast([ex.solution[i].slice(0, 2), ex.solution[i].slice(2, 4)]); setArrows([]);
      i++;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 1100);
  }
  function retry() { token.current++; setFen(ex.fen); setStep(0); setState('solving'); setMsg('Try again (your first result is already recorded).'); setHintLv(0); setArrows([]); setHighlights({}); setLast(lastSq()); setUserPlies(0); setPromoted(false); }

  const goalText = ex.goal === 'win' ? 'Win this position against Stockfish' : ex.goal === 'draw' ? 'Hold the draw against Stockfish' : ex.goal === 'hold' ? 'Find the move that holds' : 'Find the best move';
  const done = state === 'solved' || state === 'failed';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-190px))]">
        <Board fen={fen} orientation={orientation} movable={(state === 'solving' || state === 'wrong') && !showStep && !replaying ? orientation : 'none'} onMove={onMove} lastMove={last} arrows={arrows} highlights={highlights} />
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="chip text-brass-300 border-brass-600">{ex.title ?? THEME_LABEL[ex.theme] ?? ex.theme}</span>
            <span className="text-xs text-ink-400 tabular-nums">{ex.source === 'game' ? 'from your game' : `difficulty ~${ex.rating}`}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`h-4 w-4 rounded-full ring-1 ${side === 'w' ? 'bg-ink-100 ring-black/40' : 'bg-ink-950 ring-ink-400'}`} />
            <span className="font-semibold">{side === 'w' ? 'White' : 'Black'} to move · {goalText}</span>
          </div>
          {ex.played && <p className="mt-1 text-xs text-ink-400">In the game you played {sanOf(ex.fen, ex.played)}.</p>}
          {lastText && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-ink-900 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1"><span className="label !text-[10px] block">Their last move</span><span className="font-semibold text-ink-100">{lastText.san}</span> <span className="text-ink-300"><Explained text={lastText.words.replace(/^They /, 'they ')} /></span></div>
              <button className="btn btn-sm shrink-0" disabled={replaying || step > 0 || fen !== ex.fen} onClick={replayLast}>↺ Replay it</button>
            </div>
          )}
          <CoachSays className="mt-3" mood={coachMood(state, hints)}>
            {msg ? <span className={state === 'solved' ? 'text-good' : state === 'failed' || state === 'wrong' ? 'text-mistake' : ''}><Explained text={msg} /></span>
              : <><Explained text={ex.prompt || ''} />{!playout && <span className="block mt-1 text-ink-300"><Explained text={coachIntro(ex.theme, ex.goal, level, !!lastInfo)} /></span>}</>}
          </CoachSays>
          {defending && !done && !threatShown && <button className="btn btn-sm mt-2" onClick={() => { setHints((h) => h + 1); void revealThreat(); }}>What are they threatening?</button>}
          {defending && threatShown && threat && (
            <div className="mt-2 rounded-lg bg-blunder/10 ring-1 ring-blunder/30 p-3 text-sm">
              <div className="label !text-[10px]">Their threat</div>
              <p className="mt-1 text-ink-100"><Explained text={threat.summary} /></p>
              <ol className="mt-1 space-y-0.5">{threat.steps.slice(0, 4).map((st, j) => <li key={j} className="text-ink-300"><span className="font-mono text-xs text-ink-500 mr-1">{j + 1}.</span><Explained text={st.text} /></li>)}</ol>
              {!done && <p className="mt-1 text-xs text-ink-400">Ways to deal with a threat: move the target, defend it, block the line, capture the attacker, or make a bigger threat of your own.</p>}
            </div>
          )}
          {why && !why.ok && (
            <div className="mt-2 rounded-lg bg-blunder/10 ring-1 ring-blunder/30 p-3 text-sm">
              <p className="text-ink-100"><Explained text={why.reason} /></p>
              <ol className="mt-2 space-y-1">{why.story.map((st, j) => <li key={j}><button className="text-left text-ink-300 hover:text-ink-100" onClick={() => { setShowStep({ steps: why.story, i: j }); setFen(st.fenAfter); setLast([st.uci.slice(0, 2), st.uci.slice(2, 4)]); }}><span className="font-mono text-xs text-ink-500 mr-1">{j + 1}.</span></button><Explained text={st.text} /></li>)}</ol>
              <p className="mt-2 text-ink-300">Result: <b className="text-ink-100">{why.result}</b>.</p>
              {state === 'failed' && why.compare && <WhyBetter c={why.compare} className="mt-2" />}
              {showStep && <button className="btn btn-sm mt-2" onClick={() => { setShowStep(null); setFen(ex.fen); setLast(undefined); }}>Back to the puzzle</button>}
            </div>
          )}
          {state === 'solved' && !playout && (() => { const st = storyFor(ex.fen, ex.solution.length > 1 ? ex.solution : ex.solution, side, level); return st.steps.length ? (
            <div className="mt-2 rounded-lg bg-good/10 ring-1 ring-good/30 p-3 text-sm">
              <div className="label !text-[10px]">Why the solution works</div>
              <ol className="mt-1 space-y-1">{st.steps.map((x, j) => <li key={j} className="text-ink-200"><span className="font-mono text-xs text-ink-500 mr-1">{j + 1}.</span><Explained text={x.text} /></li>)}</ol>
              <p className="mt-1 text-ink-300">Result: <b className="text-ink-100">{st.result}</b>.</p>
            </div>) : null; })()}
          {done && !playout && THEME_GUIDE[ex.theme] && <LessonBox theme={ex.theme} level={level} hasLast={!!lastInfo} />}
          {state === 'checking' && <p className="mt-3 text-sm text-ink-300 flex items-center gap-2"><Spinner /> Checking your move with Stockfish…</p>}
          {state === 'replying' && playout && <p className="mt-3 text-sm text-ink-300 flex items-center gap-2"><Spinner /> Engine is thinking…</p>}
          {playout && ex.explanation && <p className="mt-3 text-xs text-ink-400"><Explained text={ex.explanation} /></p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!done ? <>
            <button className="btn" onClick={hint} disabled={state === 'checking' || state === 'replying'}>💡 Hint{hints ? ` (${hints})` : ''}</button>
            <button className="btn" onClick={reveal}>{playout ? 'Give up' : 'Show solution'}</button>
          </> : <>
            <button className="btn" onClick={retry}>↻ Try again</button>
            {onNext ? <button className="btn btn-primary" onClick={onNext}>Next →</button> : <button className="btn btn-primary" onClick={() => history.back()}>Done</button>}
          </>}
        </div>
        {hints > 0 && !done && <p className="text-xs text-ink-500">Hints count as half a success for your training rating.</p>}
      </div>
    </div>
  );
}
function coachMood(state: string, hints: number): Mood {
  if (state === 'solved') return hints ? 'happy' : 'cool';
  if (state === 'failed') return 'concerned';
  if (state === 'wrong') return 'concerned';
  if (state === 'checking' || state === 'replying') return 'thinking';
  return 'neutral';
}

function LessonBox({ theme, level, hasLast }: { theme: string; level: string; hasLast: boolean }) {
  const g = guideFor(theme, hasLast)!;
  return (
    <div className="mt-2 rounded-lg bg-brass-500/10 ring-1 ring-brass-500/30 p-3 text-sm">
      <div className="label !text-[10px]">The lesson: {THEME_LABEL[theme] ?? theme}</div>
      <p className="mt-1 text-ink-100"><Explained text={g.what} /></p>
      <p className="mt-1 text-ink-300"><b className="text-ink-200">Spot it:</b> <Explained text={g.spot} /></p>
      <div className="mt-1 text-ink-300"><b className="text-ink-200">Ask yourself:</b><ul className="list-disc pl-5">{g.ask.map((a) => <li key={a}><Explained text={a} /></li>)}</ul></div>
      <p className="mt-1 text-ink-300"><b className="text-ink-200">Classic mistake:</b> <Explained text={g.trap} /></p>
      {level !== 'beginner' && g.deeper && <p className="mt-1 text-ink-300"><b className="text-ink-200">Deeper:</b> <Explained text={g.deeper} /></p>}
    </div>
  );
}
const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/[.!]+$/, '');
