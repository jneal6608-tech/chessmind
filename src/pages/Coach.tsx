import { Explained } from '../ui/Explained';
// AI COACH: explore any position on the board and ask questions about it.
// The built-in coach works offline from Stockfish analysis; with an Anthropic
// API key (Settings) answers come from Claude, grounded in the same engine tools.
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../ui/Board';
import { EvalBar } from '../ui/EvalBar';
import { Page, Spinner } from '../ui/common';
import { useAppData } from '../services/data';
import { coachEngine } from '../engine/browser';
import { scoreOf, formatScore, type EvalLine } from '../engine/uci';
import { answer } from '../coach/assistant';
import { tryIdea } from '../coach/teach';
import { levelFor } from '../coach/explain';
import { apiKey } from '../store/settings';
import { chats } from '../store/db';
import { tryMove, pvToSan, formatLine, START_FEN, uid, isSanePosition } from '../chess/util';
import { WEAKNESS } from '../training/themes';
import type { Arrow } from '../ui/Board';

interface Msg { role: 'user' | 'assistant'; text: string; fen?: string; source?: string }

export function CoachPage({ fenParam }: { fenParam?: string }) {
  const [data] = useAppData();
  const [root, setRoot] = useState(() => (fenParam && isSanePosition(fenParam) ? new Chess(fenParam).fen() : START_FEN));
  const [moves, setMoves] = useState<string[]>([]);
  const [flip, setFlip] = useState(false);
  const [live, setLive] = useState(true);
  const [talk, setTalk] = useState(true);
  const [lines, setLines] = useState<EvalLine[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | undefined>();
  const [fenInput, setFenInput] = useState('');
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [threadId] = useState(() => uid());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { apiKey.get().then(setKey); }, []);
  const c = new Chess(root);
  for (const m of moves) tryMove(c, m);
  const fen = c.fen();
  const side = c.turn();

  // Live engine lines for the current position
  useEffect(() => {
    if (!live || c.isGameOver()) { setLines([]); return; }
    let cancelled = false;
    coachEngine.stop();
    const t = setTimeout(() => {
      coachEngine.analyze(fen, { depth: 18, multipv: 3, onInfo: (ls) => { if (!cancelled) setLines([...ls]); } })
        .then((r) => { if (!cancelled) setLines(r.lines); }).catch(() => undefined);
    }, 150);
    return () => { cancelled = true; clearTimeout(t); coachEngine.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, live]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs.length, busy]);

  if (!data) return <Page title="AI Coach"><Spinner /></Page>;
  const level = levelFor(data.strength.rating, data.settings.coachLevel);
  const useClaude = !!key && data.settings.aiEnabled;
  const sign = side === 'w' ? 1 : -1;
  const evalW = lines[0] ? scoreOf(lines[0]) * sign : null;

  // Talk me through it: every move played on the board gets a plain-words verdict.
  async function commentOn(before: string, u: string) {
    setBusy(true);
    try {
      const v = await tryIdea(coachEngine, before, u, level);
      const lines = [v.headline, v.reason, '', 'What happens next:', ...v.story.map((st, i) => `${i + 1}. ${st.text}`), `Result: ${v.result}.`];
      if (v.compare && !v.compare.equal) lines.push('', `Why ${v.compare.better.san} is better:`, ...v.compare.reasons.map((r) => `• ${r}`));
      if (v.better) lines.push('', `Better was ${v.better.san}:`, ...v.better.story.slice(0, 4).map((st, i) => `${i + 1}. ${st.text}`), `Result: ${v.better.result}.`);
      setMsgs((m) => [...m, { role: 'assistant', text: lines.join('\n'), source: 'Move check (Stockfish)' }]);
    } catch { /* position changed */ } finally { setBusy(false); }
  }

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const um: Msg = { role: 'user', text: q, fen };
    const next = [...msgs, um];
    setMsgs(next); setInput(''); setBusy(true);
    coachEngine.stop();
    try {
      let text: string, source: string;
      if (useClaude) {
        const profileText = data!.profile.top.map((w) => `- ${w.label} (${w.status}, ${w.incidents} incidents): ${WEAKNESS[w.key]?.lesson}`).join('\n');
        const { askClaude } = await import('../coach/llm'); // the Anthropic SDK loads only when used
        text = await askClaude(key!, data!.settings.aiModel, coachEngine, { fen, level, rating: data!.strength.rating, profileText }, msgs.map((m) => ({ role: m.role, text: m.text })), q);
        source = 'Claude + Stockfish';
      } else {
        const r = await answer(coachEngine, fen, q, level);
        text = r.text; source = 'Built-in coach (Stockfish)';
        setArrows((r.arrows ?? []).map((a) => ({ from: a.from, to: a.to, color: a.color as Arrow['color'] })));
      }
      const all = [...next, { role: 'assistant' as const, text, source }];
      setMsgs(all);
      await chats.put({ id: threadId, title: q.slice(0, 60), fen: root, updated: Date.now(), messages: all.map(({ role, text: t, fen: f }) => ({ role, text: t, fen: f })) });
    } catch (e) {
      setMsgs([...next, { role: 'assistant', text: `Sorry: ${(e as Error).message}`, source: 'error' }]);
    } finally { setBusy(false); }
  }

  const lastMoveSan = c.history().slice(-1)[0];
  const suggestions = [
    'What is the best move here, and why?',
    'What is my opponent threatening?',
    'What is the plan in this position?',
    lastMoveSan ? `Was ${lastMoveSan} a good move?` : 'Who is better?',
  ];
  return (
    <div className="mx-auto w-full max-w-[1320px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-2 sm:px-0">
        <div><h1 className="h-display text-2xl sm:text-[2rem]">AI Coach</h1>
          <p className="text-sm text-ink-300">Set up or play out any position, then ask. Every evaluation comes from Stockfish running in your browser.</p></div>
        <span className={`chip ${useClaude ? 'text-brass-300 border-brass-600' : ''}`}>{useClaude ? `Claude (${data.settings.aiModel}) + Stockfish` : 'Built-in coach · offline'}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_440px] items-start">
        <div>
          <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-230px))] gap-2">
            {live && <EvalBar cp={evalW} flipped={flip} />}
            <div className="flex-1 min-w-0"><Board fen={fen} orientation={flip ? 'black' : 'white'} movable="both" onMove={(u) => { setMoves([...moves, u]); setArrows([]); if (talk) void commentOn(fen, u); }}
              lastMove={moves.length ? [moves[moves.length - 1].slice(0, 2), moves[moves.length - 1].slice(2, 4)] : undefined} arrows={arrows.length ? arrows : lines[0] && live ? [{ from: lines[0].pv[0].slice(0, 2), to: lines[0].pv[0].slice(2, 4), color: 'blue' }] : []}
              theme={data.settings.boardTheme} coords={data.settings.showCoords} /></div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button className="btn btn-sm" onClick={() => setMoves(moves.slice(0, -1))} disabled={!moves.length}>↶ Undo</button>
            <button className="btn btn-sm" onClick={() => { setMoves([]); setArrows([]); }}>Reset to start</button>
            <button className="btn btn-sm" onClick={() => setFlip(!flip)}>⇅ Flip</button>
            <button className="btn btn-sm" onClick={() => setLive(!live)}>{live ? 'Hide engine' : 'Show engine'}</button>
            <button className={`btn btn-sm ${talk ? '!border-brass-500 text-brass-300' : ''}`} onClick={() => setTalk(!talk)} title="Explain every move I play on this board">{talk ? '🗣 Explaining my moves' : '🗣 Explain my moves: off'}</button>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(fen)}>Copy FEN</button>
          </div>
          {live && lines.length > 0 && (
            <div className="mt-3 card p-3 space-y-1">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-3 text-xs"><span className="w-12 font-semibold tabular-nums text-ink-100">{formatScore(scoreOf(l) * sign)}</span><span className="font-mono text-ink-300 truncate">{formatLine(fen, pvToSan(fen, l.pv, 10))}</span></div>
              ))}
              <div className="text-[10px] text-ink-500">depth {lines[0]?.depth}</div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input className="input !text-xs font-mono" placeholder="Paste a FEN to load a position…" value={fenInput} onChange={(e) => setFenInput(e.target.value)} />
            <button className="btn btn-sm" onClick={() => { const f = fenInput.trim(); if (!isSanePosition(f)) { alert('That FEN is not a legal position (check the kings, pawns on the first/last rank, and whose move it is).'); return; } setRoot(new Chess(f).fen()); setMoves([]); setFenInput(''); }}>Load</button>
          </div>
        </div>
        <div className="card flex flex-col h-[min(78vh,760px)]">
          <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
            {!msgs.length && (
              <div className="text-sm text-ink-300">
                <p className="h-display text-lg text-ink-100">Ask me about this position.</p>
                <p className="mt-1">I can explain the best move, what your opponent threatens, the plan, or whether a move (type it, e.g. "Is Nxe5 good?") works. Explanations are pitched at your level ({level}).</p>
                {!useClaude && <p className="mt-2 text-xs text-ink-400">For free-form conversation, add an Anthropic API key in Settings. Everything else works offline.</p>}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-brass-500/20 text-ink-100 rounded-br-md' : 'bg-ink-800 text-ink-100 rounded-bl-md'}`}>
                  {m.role === 'assistant' ? <Explained text={m.text} /> : m.text}
                  {m.source && <div className="mt-1.5 text-[10px] text-ink-500">{m.source}</div>}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-ink-400"><Spinner /> Thinking with Stockfish…</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-ink-700 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s} className="chip hover:border-brass-500" disabled={busy} onClick={() => ask(s)}>{s}</button>)}</div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
              <input className="input" placeholder="Ask a question…" value={input} onChange={(e) => setInput(e.target.value)} />
              <button className="btn btn-primary" disabled={busy || !input.trim()}>Ask</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
