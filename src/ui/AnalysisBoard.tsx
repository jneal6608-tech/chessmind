// Free analysis: play any moves for both sides from a position, with a live
// evaluation bar, Stockfish's top lines, a label for every move you try
// (brilliant ... blunder) and plain-words answers to "why is this move better
// than that one?". Used from game reviews ("Analyse from here") and on its own.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type Arrow } from './Board';
import { EvalBar } from './EvalBar';
import { MoveList } from './MoveList';
import { Spinner } from './common';
import { Explained } from './Explained';
import { CLASS_LABEL, CLASS_MEANING, badgeFor } from './classes';
import { coachEngine } from '../engine/browser';
import { scoreOf, winPct, formatScore, EngineCancelled, type EvalLine } from '../engine/uci';
import { tryMove, pvToSan, formatLine, sanOf } from '../chess/util';
import { describeMove } from '../coach/teach';
import { compareMoves, analyzeCandidates, alternativeCaptures, type Candidate, type Comparison } from '../coach/compare';
import { classOf } from '../analysis/review';
import { moveGain } from '../chess/tactics';
import type { MoveClass } from '../analysis/types';

interface Cached { lines: EvalLine[]; depth: number }
const DEPTH = 18;
const MIN_DEPTH = 10; // depth needed before a move is labelled

export interface AnalysisBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  theme?: string;
  coords?: boolean;
  title?: string;
  intro?: string;
  /** The move actually played in the game from `fen`, if any (UCI). */
  gameMove?: string;
  /** Moves to load straight away (e.g. the engine's suggestion or the game continuation). */
  initialLine?: string[];
  onClose?: () => void;
}

export function AnalysisBoard(p: AnalysisBoardProps) {
  const [line, setLine] = useState<string[]>(p.initialLine ?? []);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(p.orientation === 'black');
  const [showEngine, setShowEngine] = useState(true);
  const [cache, setCache] = useState<Record<string, Cached>>({});
  const [cmp, setCmp] = useState<{ fen: string; title: string; c: Comparison } | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  useEffect(() => { setLine(p.initialLine ?? []); setIdx(0); setCmp(null); }, [p.fen]);

  // Positions along the variation
  const fens = useMemo(() => {
    const c = new Chess(p.fen);
    const out = [c.fen()];
    for (const u of line) { if (!tryMove(c, u)) break; out.push(c.fen()); }
    return out;
  }, [p.fen, line.join(' ')]);
  const sans = useMemo(() => pvToSan(p.fen, line, 400), [p.fen, line.join(' ')]);
  const cur = Math.min(idx, fens.length - 1);
  const fen = fens[cur];
  const pos = new Chess(fen);
  const turn = pos.turn();
  const here = cache[fen];
  const lines = here?.lines ?? [];

  // Live engine on the current position (keeps the deepest result per position).
  useEffect(() => {
    if (pos.isGameOver()) {
      setCache((m) => ({ ...m, [fen]: { lines: [{ cp: pos.isCheckmate() ? undefined : 0, mate: pos.isCheckmate() ? 0 : undefined, pv: [], depth: 99 }], depth: 99 } }));
      return;
    }
    if ((cacheRef.current[fen]?.depth ?? 0) >= DEPTH) return;
    let cancelled = false;
    coachEngine.stop();
    const put = (ls: EvalLine[]) => {
      if (cancelled || !ls.length) return;
      const d = ls[0].depth;
      setCache((m) => (m[fen] && m[fen].depth > d ? m : { ...m, [fen]: { lines: [...ls], depth: d } }));
    };
    const t = setTimeout(() => {
      coachEngine.analyze(fen, { depth: DEPTH, multipv: 3, onInfo: put }).then((r) => put(r.lines)).catch(() => undefined);
    }, 120);
    return () => { cancelled = true; clearTimeout(t); coachEngine.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, nonce]);
  useEffect(() => () => coachEngine.stop(), []);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => Math.min(fens.length - 1, i + 1)); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fens.length]);

  function play(ucis: string[]) {
    const next = [...line.slice(0, cur), ...ucis];
    // Same moves as already in the line: just step forward.
    if (line.slice(0, next.length).join(' ') === next.join(' ')) { setIdx(next.length); return; }
    setLine(next); setIdx(next.length); setCmp(null);
  }

  // Label of every move in the variation, once both positions are analysed.
  const classes: (MoveClass | undefined)[] = line.slice(0, fens.length - 1).map((u, i) => labelMove(fens[i], fens[i + 1], u, cache));
  const lastMove = cur > 0 ? line[cur - 1] : undefined;
  const lastCls = cur > 0 ? classes[cur - 1] : undefined;
  const prev = cur > 0 ? cache[fens[cur - 1]] : undefined;

  // Why the best move was better than the one just played (instant: uses cached lines).
  const playedCmp = useMemo(() => {
    if (!lastMove || !prev || !here || prev.depth < MIN_DEPTH || here.depth < MIN_DEPTH) return null;
    const best = prev.lines[0];
    if (!best?.pv[0] || best.pv[0] === lastMove) return null;
    const pf = fens[cur - 1];
    const bestC: Candidate = { uci: best.pv[0], san: sanOf(pf, best.pv[0]), cp: scoreOf(best), pv: best.pv };
    const mine: Candidate = { uci: lastMove, san: sanOf(pf, lastMove), cp: -scoreOf(here.lines[0]), pv: [lastMove, ...(here.lines[0]?.pv ?? [])] };
    return compareMoves(pf, bestC, mine);
  }, [lastMove, prev?.depth, here?.depth, fen]);

  async function compareCandidates(ucis: string[], title: string) {
    setCmpBusy(true); setCmp(null);
    coachEngine.stop();
    try {
      const cands = await analyzeCandidates(coachEngine, fen, ucis, 14);
      if (cands.length >= 2) {
        cands.sort((a, b) => b.cp - a.cp);
        setCmp({ fen, title, c: compareMoves(fen, cands[0], cands[cands.length - 1]) });
      }
    } catch (e) { if (!(e instanceof EngineCancelled)) throw e; }
    finally { setCmpBusy(false); setNonce((n) => n + 1); }
  }
  function compareLines(i: number) {
    const a = lines[0], b = lines[i];
    if (!a || !b) return;
    const ca: Candidate = { uci: a.pv[0], san: sanOf(fen, a.pv[0]), cp: scoreOf(a), pv: a.pv };
    const cb: Candidate = { uci: b.pv[0], san: sanOf(fen, b.pv[0]), cp: scoreOf(b), pv: b.pv };
    setCmp({ fen, title: `${ca.san} or ${cb.san}?`, c: compareMoves(fen, ca, cb) });
  }

  const alts = useMemo(() => alternativeCaptures(fen).slice(0, 2), [fen]);
  const evalWhite = lines[0] ? (turn === 'w' ? scoreOf(lines[0]) : -scoreOf(lines[0])) : null;
  const arrows: Arrow[] = [];
  if (showEngine) {
    if (lines[0]?.pv[0]) arrows.push({ from: lines[0].pv[0].slice(0, 2), to: lines[0].pv[0].slice(2, 4), color: 'green' });
    if (lines[1]?.pv[0] && lines[1].pv[0] !== lines[0]?.pv[0] && winPct(scoreOf(lines[0])) - winPct(scoreOf(lines[1])) < 8) arrows.push({ from: lines[1].pv[0].slice(0, 2), to: lines[1].pv[0].slice(2, 4), color: 'blue' });
  }
  const gameSan = p.gameMove ? sanOf(p.fen, p.gameMove) : undefined;
  const thinking = !pos.isGameOver() && (here?.depth ?? 0) < DEPTH;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_440px] items-start">
      <div>
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-190px))] gap-2">
          {showEngine && <EvalBar cp={evalWhite} flipped={flip} thinking={thinking} />}
          <div className="flex-1 min-w-0">
            <Board fen={fen} orientation={flip ? 'black' : 'white'} movable="both" onMove={(u) => play([u])}
              lastMove={lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : undefined} arrows={arrows} theme={p.theme} coords={p.coords}
              badge={lastMove && lastCls ? badgeFor(lastMove.slice(2, 4), lastCls) : undefined} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => setIdx(0)} aria-label="Start">⏮</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setIdx(Math.max(0, cur - 1))} aria-label="Back">◀</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setIdx(Math.min(fens.length - 1, cur + 1))} aria-label="Forward">▶</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setIdx(fens.length - 1)} aria-label="End">⏭</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setFlip(!flip)} aria-label="Flip">⇅</button>
          <button className="btn btn-sm" onClick={() => { setLine([]); setIdx(0); setCmp(null); }} disabled={!line.length}>↺ Reset</button>
          <button className="btn btn-sm" onClick={() => setShowEngine(!showEngine)}>{showEngine ? 'Hide engine' : 'Show engine'}</button>
        </div>
      </div>

      <div className="card p-4 space-y-3 max-h-none lg:max-h-[calc(100vh-120px)] overflow-y-auto scroll-thin">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="h-display text-lg">{p.title ?? 'Analysis board'}</div>
            <p className="text-sm text-ink-300">{p.intro ?? 'Move pieces for both sides to test your own ideas. Every move you play gets a label and an explanation.'}</p>
          </div>
          {p.onClose && <button className="btn btn-ghost btn-sm" onClick={p.onClose} aria-label="Close">✕</button>}
        </div>

        {gameSan && cur === 0 && <p className="text-xs text-ink-400">In the game, <b className="text-ink-200">{gameSan}</b> was played here.</p>}

        {line.length > 0 && (
          <div>
            <div className="h-[120px] rounded-lg bg-ink-900 p-1">
              <MoveList sans={sans} current={cur - 1} classes={classes} startPly={plyOf(p.fen)} onSelect={(i) => setIdx(i + 1)} />
            </div>
            <p className="mt-1 text-[11px] text-ink-500">Click a move to jump to it. Playing a different move there starts a new line. ← → keys step through.</p>
          </div>
        )}

        {/* The move just played in the variation */}
        {lastMove && (
          <div className={`rounded-xl p-3 text-sm ring-1 ${lastCls && ['blunder', 'mistake', 'miss'].includes(lastCls) ? 'bg-blunder/10 ring-blunder/30' : lastCls === 'inaccuracy' ? 'bg-inacc/10 ring-inacc/30' : 'bg-ink-800/60 ring-ink-700'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{sans[cur - 1]}{' '}
                {lastCls ? <span className={`cls-${lastCls}`}>· {CLASS_LABEL[lastCls]}</span> : <span className="text-ink-400 text-xs inline-flex items-center gap-1"><Spinner /> rating the move…</span>}
              </span>
              {lastCls && <span className="text-[11px] text-ink-400 text-right">{CLASS_MEANING[lastCls]}</span>}
            </div>
            <p className="mt-1 text-ink-200"><Explained text={describeMove(fens[cur - 1], lastMove, new Chess(fens[cur - 1]).turn())} /></p>
            {playedCmp && !playedCmp.equal && (
              <div className="mt-2 border-t border-ink-700 pt-2">
                <div className="text-ink-100"><Explained text={playedCmp.summary} /></div>
                <ul className="mt-1 list-disc pl-5 space-y-0.5 text-ink-300">{playedCmp.reasons.map((r, i) => <li key={i}><Explained text={r} /></li>)}</ul>
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-sm" onClick={() => { setIdx(cur - 1); }}>◀ Take it back</button>
                  <button className="btn btn-sm" onClick={() => { const pv = prev!.lines[0].pv; setLine([...line.slice(0, cur - 1), ...pv.slice(0, 1)]); setIdx(cur); }}>Play {playedCmp.better.san} instead</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Engine lines */}
        {showEngine && (
          <div>
            <div className="flex items-center justify-between">
              <span className="label">Stockfish</span>
              <span className="text-[11px] text-ink-400 tabular-nums flex items-center gap-1">{thinking && <Spinner />}{here ? `depth ${Math.min(here.depth, DEPTH)}` : 'thinking…'}</span>
            </div>
            {pos.isGameOver() ? <p className="mt-1 text-sm text-ink-300">{pos.isCheckmate() ? 'Checkmate.' : 'The game is over (draw).'}</p> : (
              <div className="mt-1 space-y-1.5">
                {lines.slice(0, 3).map((l, i) => {
                  const ls = pvToSan(fen, l.pv, 10);
                  const ev = formatScore(turn === 'w' ? scoreOf(l) : -scoreOf(l));
                  return (
                    <div key={i} className="rounded-lg bg-ink-900 px-2 py-1.5">
                      <div className="flex items-start gap-2">
                        <span className={`w-12 shrink-0 text-center rounded px-1 text-xs font-bold tabular-nums ${scoreOf(l) * (turn === 'w' ? 1 : -1) >= 0 ? 'bg-ink-100 text-ink-900' : 'bg-ink-700 text-ink-100'}`}>{ev}</span>
                        <div className="min-w-0 flex-1 flex flex-wrap gap-x-1 text-xs font-mono leading-relaxed">
                          {lineTokens(fen, ls).map((t, j) => t.move ? (
                            <button key={j} className={`hover:text-brass-300 hover:underline ${t.ply === 0 ? 'font-bold text-ink-100' : 'text-ink-200'}`} title="Play the line up to this move" onClick={() => play(l.pv.slice(0, t.ply + 1))}>{t.text}</button>
                          ) : <span key={j} className="text-ink-400">{t.text}</span>)}
                        </div>
                      </div>
                      {i > 0 && lines[0] && <button className="mt-1 text-[11px] text-brass-300 hover:underline" onClick={() => compareLines(i)}>Why is {sanOf(fen, lines[0].pv[0])} {winPct(scoreOf(lines[0])) - winPct(scoreOf(l)) < 3 ? 'about as good as' : 'better than'} {ls[0]}?</button>}
                    </div>
                  );
                })}
                {!lines.length && <div className="text-sm text-ink-400 flex items-center gap-2"><Spinner /> Thinking…</div>}
                {lines[0]?.pv[0] && <p className="text-xs text-ink-300"><span className="text-good font-semibold">Top move {sanOf(fen, lines[0].pv[0])}:</span> <Explained text={describeMove(fen, lines[0].pv[0], turn)} /></p>}
              </div>
            )}
          </div>
        )}

        {/* Several ways to capture the same piece */}
        {alts.map((a) => (
          <div key={a.square} className="rounded-lg border border-ink-700 p-2 text-sm">
            <div className="text-ink-200">You can take on <b>{a.square}</b> {a.sans.length === 2 ? 'two' : a.sans.length} ways: <span className="font-mono">{a.sans.join(', ')}</span>.</div>
            <button className="btn btn-sm mt-1.5" disabled={cmpBusy} onClick={() => compareCandidates(a.ucis, `Taking on ${a.square}: ${a.sans.join(' or ')}?`)}>Which capture is better, and why?</button>
          </div>
        ))}

        {cmpBusy && <div className="flex items-center gap-2 text-sm text-ink-400"><Spinner /> Comparing the moves with Stockfish…</div>}
        {cmp && cmp.fen === fen && (
          <div className="rounded-xl bg-brass-500/10 ring-1 ring-brass-500/30 p-3 text-sm">
            <div className="label !text-[10px]">{cmp.title}</div>
            <p className="mt-1 font-semibold text-ink-100"><Explained text={cmp.c.summary} /></p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5 text-ink-200">{cmp.c.reasons.map((r, i) => <li key={i}><Explained text={r} /></li>)}</ul>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-ink-300">
              <div><b className="text-good">{cmp.c.better.san}</b>: <span className="font-mono">{formatLine(fen, pvToSan(fen, cmp.c.better.pv, 6))}</span></div>
              <div><b className="text-mistake">{cmp.c.worse.san}</b>: <span className="font-mono">{formatLine(fen, pvToSan(fen, cmp.c.worse.pv, 6))}</span></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-sm" onClick={() => play(cmp.c.better.pv.slice(0, 1))}>Play {cmp.c.better.san}</button>
              <button className="btn btn-sm" onClick={() => play(cmp.c.worse.pv.slice(0, 1))}>Play {cmp.c.worse.san}</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/** Label for one move from two analysed positions, same rules as the game review. */
export function labelMove(before: string, afterFen: string, uci: string, cache: Record<string, Cached>): MoveClass | undefined {
  const a = cache[before], b = cache[afterFen];
  if (!a || !b || a.depth < MIN_DEPTH || b.depth < MIN_DEPTH || !a.lines[0]) return undefined;
  const legal = new Chess(before).moves().length;
  const best = a.lines[0], second = a.lines[1];
  const bestCp = scoreOf(best);
  const afterCp = -scoreOf(b.lines[0]);
  const bestPlayed = best.pv[0] === uci;
  const wBefore = winPct(bestCp), wAfter = winPct(afterCp);
  const winLoss = bestPlayed ? 0 : Math.max(0, wBefore - wAfter);
  const nearBest = !!second && second.pv[0] === uci && winPct(bestCp) - winPct(scoreOf(second)) < 2;
  const gap = second ? winPct(bestCp) - winPct(scoreOf(second)) : 0;
  const onlyMove = bestPlayed && !!second && gap >= 15 && wBefore > 15 && wBefore < 90 && legal > 1;
  const sacGain = (bestPlayed || winLoss < 2) && wAfter >= 45 && wBefore < 97 && legal > 1 ? moveGain(before, uci) : 0;
  const alt = bestPlayed ? second?.pv[0] : best.pv[0];
  const sacrifice = sacGain <= -2 && (!alt || moveGain(before, alt) > sacGain + 1);
  return classOf(winLoss, { book: false, forced: legal === 1, bestPlayed, missed: false, nearBest, onlyMove, sacrifice });
}

function plyOf(fen: string) {
  const p = fen.split(' ');
  return (Number(p[5]) - 1) * 2 + (p[1] === 'b' ? 1 : 0);
}
/** Split a SAN line into numbered, clickable tokens. */
function lineTokens(fen: string, sans: string[]) {
  const p = fen.split(' ');
  let no = Number(p[5]) || 1;
  let white = p[1] === 'w';
  const out: { text: string; move: boolean; ply: number }[] = [];
  sans.forEach((s, i) => {
    if (white) out.push({ text: `${no}.`, move: false, ply: -1 });
    else if (i === 0) out.push({ text: `${no}...`, move: false, ply: -1 });
    out.push({ text: s, move: true, ply: i });
    if (!white) no++;
    white = !white;
  });
  return out;
}
