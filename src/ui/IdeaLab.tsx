import { Explained } from './Explained';
// "What if I play this?" The player tries a move, Stockfish answers, and the
// coach explains in plain words why it works or fails. Repeat as often as you like.
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type Arrow } from './Board';
import { Spinner } from './common';
import { coachEngine } from '../engine/browser';
import { EngineCancelled } from '../engine/uci';
import { tryIdea, type Verdict, type Step } from '../coach/teach';
import { answer } from '../coach/assistant';
import type { CoachLevel } from '../coach/explain';
import { sanOf } from '../chess/util';

interface Entry { kind: 'try'; verdict: Verdict; san: string }
interface QA { kind: 'qa'; q: string; a: string }

export function IdeaLab({ fen, level, intro, theme, coords = true, onClose }: { fen: string; level: CoachLevel; intro?: string; theme?: string; coords?: boolean; onClose?: () => void }) {
  const me = new Chess(fen).turn();
  const [boardFen, setBoardFen] = useState(fen);
  const [last, setLast] = useState<[string, string] | undefined>();
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<(Entry | QA)[]>([]);
  const [show, setShow] = useState<{ steps: Step[]; i: number } | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { setBoardFen(fen); setLog([]); setShow(null); setArrows([]); setLast(undefined); }, [fen]);

  async function onMove(uci: string) {
    if (busy) return;
    setBusy(true);
    const c = new Chess(fen); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | undefined });
    setBoardFen(c.fen()); setLast([uci.slice(0, 2), uci.slice(2, 4)]); setArrows([]); setShow(null);
    try {
      const v = await tryIdea(coachEngine, fen, uci, level);
      setLog((l) => [...l, { kind: 'try', verdict: v, san: sanOf(fen, uci) }]);
      // Show their answer straight away
      const reply = v.story[1];
      if (reply) setArrows([{ from: reply.uci.slice(0, 2), to: reply.uci.slice(2, 4), color: v.ok ? 'blue' : 'red' }]);
    } catch (e) {
      if (!(e instanceof EngineCancelled)) setLog((l) => [...l, { kind: 'qa', q: 'Error', a: (e as Error).message }]);
    } finally { setBusy(false); }
  }
  function play(steps: Step[], i: number) {
    setShow({ steps, i });
    const s = steps[i];
    setBoardFen(s.fenAfter); setLast([s.uci.slice(0, 2), s.uci.slice(2, 4)]);
    const next = steps[i + 1];
    setArrows(next ? [{ from: next.uci.slice(0, 2), to: next.uci.slice(2, 4), color: 'yellow' }] : []);
  }
  function reset() { setBoardFen(fen); setLast(undefined); setArrows([]); setShow(null); }
  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true); setQ('');
    try { const r = await answer(coachEngine, show ? show.steps[show.i].fenAfter : fen, text, level); setLog((l) => [...l, { kind: 'qa', q: text, a: r.text }]); }
    finally { setBusy(false); }
  }
  const atStart = boardFen === fen;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-200px))]">
        <Board fen={boardFen} orientation={me === 'w' ? 'white' : 'black'} movable={atStart && !busy ? (me === 'w' ? 'white' : 'black') : 'none'} onMove={onMove} lastMove={last} arrows={arrows} theme={theme} coords={coords} />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button className="btn btn-sm" onClick={reset} disabled={atStart}>↺ Back to the position</button>
          {show && <>
            <button className="btn btn-sm" disabled={show.i === 0} onClick={() => play(show.steps, show.i - 1)}>◀ Previous</button>
            <button className="btn btn-sm" disabled={show.i >= show.steps.length - 1} onClick={() => play(show.steps, show.i + 1)}>Next ▶</button>
          </>}
        </div>
      </div>
      <div className="card p-4 flex flex-col max-h-[80vh]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="h-display text-lg">Try your own idea</div>
            <p className="text-sm text-ink-300">{intro ?? 'Play any move on the board. I\'ll show you what happens next and explain, in plain words, whether it works.'}</p>
          </div>
          {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="mt-3 flex-1 overflow-y-auto scroll-thin space-y-3 pr-1">
          {!log.length && !busy && <p className="text-sm text-ink-400">{atStart ? `You are ${me === 'w' ? 'White' : 'Black'}. Make a move.` : ''}</p>}
          {log.map((e, i) => e.kind === 'qa' ? (
            <div key={i} className="text-sm"><div className="text-brass-300 font-semibold">You asked: {e.q}</div><p className="mt-1 text-ink-200 leading-relaxed whitespace-pre-wrap"><Explained text={e.a} /></p></div>
          ) : (
            <div key={i} className={`rounded-xl p-3 text-sm ${e.verdict.ok ? 'bg-good/10 ring-1 ring-good/30' : 'bg-blunder/10 ring-1 ring-blunder/30'}`}>
              <div className={`font-semibold ${e.verdict.ok ? 'text-good' : 'text-blunder'}`}>{e.verdict.headline}</div>
              <p className="mt-1 text-ink-100"><Explained text={e.verdict.reason} /></p>
              <div className="mt-2 label !text-[10px]">What happens</div>
              <ol className="mt-1 space-y-1">
                {e.verdict.story.map((s, j) => (
                  <li key={j} role="button" tabIndex={0} className={`cursor-pointer text-left hover:text-brass-300 ${show?.steps === e.verdict.story && show.i === j ? 'text-brass-300' : 'text-ink-200'}`} onClick={() => play(e.verdict.story, j)}>
                    <span className="font-mono text-xs text-ink-400 mr-1">{j + 1}.</span><Explained text={s.text} /></li>
                ))}
              </ol>
              <p className="mt-2 text-ink-300">Result: <b className="text-ink-100">{e.verdict.result}</b>.</p>
              {e.verdict.better && (
                <div className="mt-3 border-t border-ink-700 pt-2">
                  <div className="label !text-[10px]">Better: {e.verdict.better.san}</div>
                  <ol className="mt-1 space-y-1">
                    {e.verdict.better.story.map((s, j) => (
                      <li key={j} role="button" tabIndex={0} className={`cursor-pointer text-left hover:text-brass-300 ${show?.steps === e.verdict.better!.story && show.i === j ? 'text-brass-300' : 'text-ink-300'}`} onClick={() => play(e.verdict.better!.story, j)}>
                        <span className="font-mono text-xs text-ink-500 mr-1">{j + 1}.</span><Explained text={s.text} /></li>
                    ))}
                  </ol>
                  <p className="mt-1 text-ink-300">Result: <b className="text-ink-100">{e.verdict.better.result}</b>.</p>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button className="btn btn-sm" onClick={() => play(e.verdict.story, 0)}>Show me on the board</button>
                <button className="btn btn-sm" onClick={reset}>Try another move</button>
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-ink-400"><Spinner /> Checking with Stockfish…</div>}
        </div>
        <form className="mt-3 flex gap-2 border-t border-ink-700 pt-3" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          <input className="input" placeholder={show ? 'Ask about the position on the board…' : 'Ask a question, e.g. "what is the threat?"'} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" disabled={busy || !q.trim()}>Ask</button>
        </form>
      </div>
    </div>
  );
}
