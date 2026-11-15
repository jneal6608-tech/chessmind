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

export interface SolveResult { success: boolean; timeMs: number; hints: number }

export function Solver({ ex, mode, theme, onDone, onNext }: { ex: Exercise; mode: string; theme?: string; onDone?: (r: SolveResult) => void; onNext?: () => void }) {
  const [fen, setFen] = useState(ex.fen);
  const [step, setStep] = useState(0); // index into solution (solver moves are even)
  const [state, setState] = useState<'solving' | 'checking' | 'wrong' | 'solved' | 'failed' | 'replying'>('solving');
  const [msg, setMsg] = useState('');
  const [hints, setHints] = useState(0);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [highlights, setHighlights] = useState<Record<string, 'hl-good' | 'hl-bad' | 'hl-info'>>({});
  const [last, setLast] = useState<[string, string] | undefined>();
  const [recorded, setRecorded] = useState(false);
  const [userPlies, setUserPlies] = useState(0);
  const [promoted, setPromoted] = useState(false);
  const t0 = useRef(Date.now());
  const token = useRef(0);
  const side = new Chess(ex.fen).turn();
  const orientation = side === 'w' ? 'white' : 'black';
  const playout = ex.goal === 'win' || ex.goal === 'draw';

  useEffect(() => {
    setFen(ex.fen); setStep(0); setState('solving'); setMsg(''); setHints(0); setArrows([]); setHighlights({}); setLast(undefined);
    setRecorded(false); setUserPlies(0); setPromoted(false); t0.current = Date.now(); token.current++;
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
        setMsg(`${mv.san} is not it.${recorded ? '' : ' Try again, or show the solution.'}`);
        void record(false);
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
      setStep(step + 2); setState('solving'); setMsg('Correct. Keep going: what now?');
    }, 550);
  }

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
    if (hints === 0) { setHighlights({ [exp.slice(0, 2)]: 'hl-info' }); setMsg('Hint: this piece moves.'); }
    else show(exp, 'blue');
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
  function retry() { token.current++; setFen(ex.fen); setStep(0); setState('solving'); setMsg('Try again (your first result is already recorded).'); setArrows([]); setHighlights({}); setLast(undefined); setUserPlies(0); setPromoted(false); }

  const goalText = ex.goal === 'win' ? 'Win this position against Stockfish' : ex.goal === 'draw' ? 'Hold the draw against Stockfish' : ex.goal === 'hold' ? 'Find the move that holds' : 'Find the best move';
  const done = state === 'solved' || state === 'failed';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-190px))]">
        <Board fen={fen} orientation={orientation} movable={state === 'solving' || state === 'wrong' ? orientation : 'none'} onMove={onMove} lastMove={last} arrows={arrows} highlights={highlights} />
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
          {ex.prompt && <p className="mt-2 text-sm text-ink-300">{ex.prompt}</p>}
          {ex.played && <p className="mt-1 text-xs text-ink-400">In the game you played {sanOf(ex.fen, ex.played)}.</p>}
          {msg && <p className={`mt-3 text-sm ${state === 'solved' ? 'text-good' : state === 'failed' || state === 'wrong' ? 'text-mistake' : 'text-ink-200'}`}>{msg}</p>}
          {state === 'checking' && <p className="mt-3 text-sm text-ink-300 flex items-center gap-2"><Spinner /> Checking your move with Stockfish…</p>}
          {state === 'replying' && playout && <p className="mt-3 text-sm text-ink-300 flex items-center gap-2"><Spinner /> Engine is thinking…</p>}
          {playout && ex.explanation && <p className="mt-3 text-xs text-ink-400">{ex.explanation}</p>}
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
const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/[.!]+$/, '');
