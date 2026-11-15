// PLAY: games against Stockfish-powered opponents. Finished games are saved
// and analysed automatically; an unfinished game survives a page reload.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color } from 'chess.js';
import { Board } from '../ui/Board';
import { MoveList } from '../ui/MoveList';
import { Page, Card, Segmented, Modal, Spinner, Stat } from '../ui/common';
import { LEVELS, PERSONALITIES, chooseMove, levelById, recommendLevel } from '../engine/opponent';
import { playEngine } from '../engine/browser';
import { EngineCancelled } from '../engine/uci';
import { games, kv } from '../store/db';
import { useAppData } from '../services/data';
import { analyzeSoon } from '../services/analysisQueue';
import { playSound } from '../services/sound';
import { tryMove, uid, START_FEN, opp } from '../chess/util';
import { identifyOpening } from '../openings/identify';
import { scoreFor } from '../analysis/strength';
import { go } from '../services/router';
import type { GameRecord } from '../analysis/types';

interface Setup { levelId: string; personality: string; color: 'w' | 'b' | 'random'; tc: string; takebacks: boolean; masterMs: number }
interface Live {
  id: string;
  setup: Setup;
  userColor: Color;
  moves: string[];
  times: number[];
  clock: { w: number; b: number } | null;
  inc: number;
  turnStart: number;
  takebacks: number;
  startedAt: number;
  over?: { result: GameRecord['result']; reason: string };
}

const TCS: { id: string; label: string; base: number; inc: number }[] = [
  { id: 'none', label: 'No clock', base: 0, inc: 0 },
  { id: '10+0', label: '10 min', base: 600000, inc: 0 },
  { id: '15+10', label: '15 | 10', base: 900000, inc: 10000 },
  { id: '30+0', label: '30 min', base: 1800000, inc: 0 },
];
const DEFAULT_SETUP: Setup = { levelId: 'l4', personality: 'balanced', color: 'random', tc: '15+10', takebacks: true, masterMs: 1500 };

function fenOf(moves: string[]) {
  const c = new Chess();
  for (const m of moves) tryMove(c, m);
  return c;
}
const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function PlayPage() {
  const [data] = useAppData();
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [live, setLive] = useState<Live | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | 'resign' | 'abandon'>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const token = useRef(0);
  const liveRef = useRef<Live | null>(null);
  liveRef.current = live;

  // Restore an unfinished game and the last setup.
  useEffect(() => {
    (async () => {
      const s = await kv.get<Setup>('playSetup');
      if (s) setSetup({ ...DEFAULT_SETUP, ...s });
      const l = await kv.get<Live>('liveGame');
      if (l && !l.over) setLive({ ...l, turnStart: Date.now() });
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) void kv.set('liveGame', live && !live.over ? live : null); }, [live, loaded]);

  const rec = useMemo(() => {
    if (!data) return null;
    const recent = data.games.filter((g) => g.opponent.kind === 'ai').slice(-8);
    const sc = recent.length ? recent.reduce((a, g) => a + (scoreFor(g) ?? 0), 0) / recent.length : null;
    return recommendLevel(data.strength.rating, sc);
  }, [data]);

  const chess = useMemo(() => fenOf(live?.moves ?? []), [live?.moves]);
  const fen = chess.fen();
  const sans = useMemo(() => chess.history(), [chess]);
  const turn = chess.turn();
  const userTurn = !!live && !live.over && turn === live.userColor;

  // Clock tick
  useEffect(() => {
    if (!live?.clock || live.over) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live?.clock, live?.over]);
  const remaining = (c: Color) => {
    if (!live?.clock) return 0;
    const base = live.clock[c];
    return !live.over && turn === c ? base - (now - live.turnStart) : base;
  };
  // Flag fall
  useEffect(() => {
    if (!live?.clock || live.over) return;
    if (remaining(turn) <= 0) {
      const c = fenOf(live.moves);
      const winnerHasMaterial = c.board().flat().some((p) => p && p.color !== turn && p.type !== 'k');
      finish({ ...live }, winnerHasMaterial ? (turn === 'w' ? '0-1' : '1-0') : '1/2-1/2', winnerHasMaterial ? `${turn === live.userColor ? 'You' : 'The engine'} lost on time` : 'Time out vs insufficient material');
    }
  });

  function start() {
    const userColor: Color = setup.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color;
    const tc = TCS.find((t) => t.id === setup.tc)!;
    token.current++;
    playEngine.cancelAll();
    playEngine.newGame();
    setSavedId(null); setViewPly(null); setEngineError(null);
    setFlipped(userColor === 'b');
    setLive({
      id: uid(), setup, userColor, moves: [], times: [], clock: tc.base ? { w: tc.base, b: tc.base } : null, inc: tc.inc,
      turnStart: Date.now(), takebacks: 0, startedAt: Date.now(),
    });
    void kv.set('playSetup', setup);
  }

  function endReason(c: Chess): { result: GameRecord['result']; reason: string } | undefined {
    if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', reason: 'Checkmate' };
    if (c.isStalemate()) return { result: '1/2-1/2', reason: 'Stalemate' };
    if (c.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'Threefold repetition' };
    if (c.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'Insufficient material' };
    if (c.isDraw()) return { result: '1/2-1/2', reason: '50-move rule' };
    return undefined;
  }

  function applyMove(l: Live, uci: string): Live | null {
    const c = fenOf(l.moves);
    const mover = c.turn();
    const mv = tryMove(c, uci);
    if (!mv) return null;
    const spent = Date.now() - l.turnStart;
    let clock = l.clock;
    if (clock) clock = { ...clock, [mover]: clock[mover] - spent + l.inc };
    playSound(c.isCheck() ? 'check' : mv.captured ? 'capture' : 'move');
    const next: Live = { ...l, moves: [...l.moves, uci], times: [...l.times, spent], clock, turnStart: Date.now() };
    const end = endReason(c);
    if (end) { finish(next, end.result, end.reason); return null; }
    return next;
  }

  async function finish(l: Live, result: GameRecord['result'], reason: string) {
    token.current++;
    playEngine.cancelAll();
    playSound('end');
    const done = { ...l, over: { result, reason } };
    setLive(done);
    setThinking(false);
    if (l.moves.length < 2) return; // nothing worth saving
    const level = levelById(l.setup.levelId);
    const pers = PERSONALITIES.find((p) => p.id === l.setup.personality)!;
    const c = fenOf(l.moves);
    const settings = data?.settings;
    const userName = settings?.playerName || 'You';
    const oppName = `ChessMind ${level.name}${pers.id !== 'balanced' ? ` (${pers.name})` : ''}`;
    c.header('Event', 'ChessMind training game', 'Site', 'ChessMind', 'Date', new Date(l.startedAt).toISOString().slice(0, 10).replace(/-/g, '.'),
      'White', l.userColor === 'w' ? userName : oppName, 'Black', l.userColor === 'b' ? userName : oppName, 'Result', result,
      'TimeControl', l.setup.tc === 'none' ? '-' : `${TCS.find((t) => t.id === l.setup.tc)!.base / 1000}+${l.inc / 1000}`, 'Termination', reason);
    const rec: GameRecord = {
      id: l.id, date: l.startedAt, source: 'play', pgn: c.pgn(), moves: l.moves, sans: c.history(), times: l.times,
      userColor: l.userColor, result, termination: reason,
      opponent: { kind: 'ai', name: oppName, levelId: level.id, personality: pers.id, elo: level.elo },
      timeControl: l.setup.tc, opening: identifyOpening(l.moves), takebacks: l.takebacks,
    };
    await games.put(rec);
    setSavedId(rec.id);
    if (settings?.autoAnalyze !== false) analyzeSoon(rec.id);
  }

  // Engine's turn
  useEffect(() => {
    if (!live || live.over || turn === live.userColor) return;
    const my = ++token.current;
    setThinking(true);
    const level = levelById(live.setup.levelId);
    const lvl = level.movetime ? { ...level, movetime: live.setup.masterMs } : level;
    const t0 = Date.now();
    chooseMove(playEngine, fen, lvl, live.setup.personality)
      .then(async (choice) => {
        // Feel natural: don't answer instantly (but never wait on a clock that is ticking for real).
        const wait = Math.max(0, (live.clock ? 250 : 450) - (Date.now() - t0));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        const cur = liveRef.current;
        if (my !== token.current || !cur || cur.id !== live.id || cur.over) return;
        setThinking(false);
        const next = applyMove(cur, choice.uci);
        if (next) setLive(next);
      })
      .catch((e) => {
        if (e instanceof EngineCancelled || my !== token.current) return;
        setThinking(false);
        setEngineError(`The engine failed to respond: ${(e as Error).message}. Reload the page to restart it.`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.id, live?.moves.length, live?.over]);

  function userMove(uci: string) {
    if (!live || !userTurn || viewPly !== null) return;
    const next = applyMove(live, uci);
    if (next) setLive(next);
  }

  function takeback() {
    if (!live || live.over || !live.setup.takebacks) return;
    token.current++;
    playEngine.cancelAll();
    setThinking(false);
    // Remove the engine reply (if it has moved) and the user's last move.
    const n = live.moves.length;
    const back = turn === live.userColor ? 2 : 1;
    const keep = Math.max(live.userColor === 'b' ? 1 : 0, n - back);
    if (keep >= n) return;
    setLive({ ...live, moves: live.moves.slice(0, keep), times: live.times.slice(0, keep), turnStart: Date.now(), takebacks: live.takebacks + 1 });
    setViewPly(null);
  }
  function offerDraw() {
    if (!live || live.over) return;
    // The engine accepts only if the position is genuinely level and the game is under way.
    playEngine.analyze(fen, { depth: 12 }).then((r) => {
      const s = r.lines[0]?.cp ?? (r.lines[0]?.mate ? 9999 * Math.sign(r.lines[0].mate) : 0);
      const engineView = turn === live.userColor ? -s : s;
      if (live.moves.length >= 40 && Math.abs(engineView) <= 30) finish(live, '1/2-1/2', 'Draw agreed');
      else alert(engineView > 30 ? 'The engine declines: it thinks it is better.' : live.moves.length < 40 ? 'The engine declines: too early for a draw (before move 20).' : 'The engine declines.');
    }).catch(() => undefined);
  }

  const shownFen = viewPly === null ? fen : fenOf(live!.moves.slice(0, viewPly + 1)).fen();
  const lastIdx = viewPly ?? (live ? live.moves.length - 1 : -1);
  const last = live && lastIdx >= 0 ? live.moves[lastIdx] : undefined;
  const orientation = flipped ? 'black' : 'white';
  const level = levelById((live?.setup ?? setup).levelId);
  const pers = PERSONALITIES.find((p) => p.id === (live?.setup ?? setup).personality)!;
  const top: Color = flipped ? 'w' : 'b';
  const bottom = opp(top);
  const playerLabel = (c: Color) => (live ? (c === live.userColor ? (data?.settings.playerName || 'You') : `${level.name} · ${pers.name}`) : '');

  const Clock = ({ c }: { c: Color }) => {
    if (!live?.clock) return null;
    const ms = remaining(c);
    const active = !live.over && turn === c;
    return <div className={`rounded-lg px-3 py-1 font-mono text-lg tabular-nums ${active ? (ms < 30000 ? 'bg-blunder/80 text-white' : 'bg-ink-100 text-ink-900') : 'bg-ink-800 text-ink-300'}`}>{fmtClock(ms)}</div>;
  };
  const PlayerRow = ({ c }: { c: Color }) => (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-3 w-3 rounded-full ring-1 ring-black/30 ${c === 'w' ? 'bg-ink-100' : 'bg-ink-950 ring-ink-500'}`} />
        <span className="truncate text-sm font-semibold">{playerLabel(c)}</span>
        {live && c !== live.userColor && thinking && <Spinner />}
      </div>
      <Clock c={c} />
    </div>
  );

  if (!loaded) return <Page title="Play"><Spinner /></Page>;

  if (!live) {
    return (
      <Page title="Play" subtitle="Play a serious game against a Stockfish-powered opponent. Every finished game is analysed and feeds your training plan.">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Opponent strength" right={rec && <button className="btn btn-sm" onClick={() => setSetup({ ...setup, levelId: rec.id })}>Use recommended: {rec.name}</button>}>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEVELS.map((l) => (
                <button key={l.id} onClick={() => setSetup({ ...setup, levelId: l.id })}
                  className={`rounded-xl border p-3 text-left transition-colors ${setup.levelId === l.id ? 'border-brass-500 bg-brass-500/10' : 'border-ink-700 hover:border-ink-500 bg-ink-900/40'}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{l.name}{rec?.id === l.id && <span className="ml-2 chip text-brass-300 border-brass-600">recommended</span>}</span>
                    <span className="text-xs text-ink-400 tabular-nums">~{l.elo}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-300">{l.blurb}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-400">Ratings are approximate guides for choosing an opponent, not calibrated against human rating pools. The recommendation aims for a level you score about 50% against.</p>
          </Card>
          <div className="space-y-5">
            <Card title="Playing style">
              <div className="grid gap-2">
                {PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => setSetup({ ...setup, personality: p.id })}
                    className={`rounded-xl border px-3 py-2 text-left ${setup.personality === p.id ? 'border-brass-500 bg-brass-500/10' : 'border-ink-700 hover:border-ink-500'}`}>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-300">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Game">
              <div className="space-y-4">
                <div><div className="label mb-2">Your colour</div>
                  <Segmented value={setup.color} onChange={(v) => setSetup({ ...setup, color: v })} options={[{ value: 'w', label: 'White' }, { value: 'random', label: 'Random' }, { value: 'b', label: 'Black' }]} /></div>
                <div><div className="label mb-2">Time control</div>
                  <Segmented value={setup.tc} onChange={(v) => setSetup({ ...setup, tc: v })} options={TCS.map((t) => ({ value: t.id, label: t.label }))} /></div>
                {level.movetime && (
                  <div><div className="label mb-2">Engine thinking time</div>
                    <Segmented value={String(setup.masterMs)} onChange={(v) => setSetup({ ...setup, masterMs: Number(v) })} options={[500, 1500, 3000, 6000].map((ms) => ({ value: String(ms), label: `${ms / 1000}s` }))} /></div>
                )}
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="checkbox" checked={setup.takebacks} onChange={(e) => setSetup({ ...setup, takebacks: e.target.checked })} className="accent-brass-400" />
                  Allow takebacks <span className="text-ink-400 text-xs">(takebacks reduce how much a win counts toward your estimate)</span>
                </label>
                <button className="btn btn-primary w-full py-3 text-base" onClick={start}>Start game</button>
              </div>
            </Card>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 sm:px-6 py-3 sm:py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-170px))]">
          <PlayerRow c={top} />
          <Board fen={shownFen} orientation={orientation} movable={userTurn && viewPly === null ? (live.userColor === 'w' ? 'white' : 'black') : 'none'}
            onMove={userMove} lastMove={last ? [last.slice(0, 2), last.slice(2, 4)] : undefined}
            theme={data?.settings.boardTheme} coords={data?.settings.showCoords} animation={data?.settings.animation} />
          <PlayerRow c={bottom} />
        </div>
        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Opponent</div>
                <div className="font-semibold">{level.name} <span className="text-ink-400 text-xs">~{level.elo}</span></div>
                <div className="text-xs text-ink-300">{pers.name}</div>
              </div>
              <div className="text-right text-xs text-ink-400">{live.over ? live.over.reason : thinking ? 'Thinking…' : userTurn ? 'Your move' : ''}</div>
            </div>
            {engineError && <p className="mt-2 text-sm text-blunder">{engineError}</p>}
          </Card>
          <Card className="!p-2">
            <div className="h-[220px] lg:h-[320px]">
              <MoveList sans={sans} current={viewPly ?? sans.length - 1} onSelect={(i) => setViewPly(i === sans.length - 1 ? null : i)} />
            </div>
            <div className="mt-2 flex justify-between gap-1 border-t border-ink-700 pt-2">
              <button className="btn btn-ghost btn-sm" aria-label="First move" onClick={() => setViewPly(sans.length ? 0 : null)}>⏮</button>
              <button className="btn btn-ghost btn-sm" aria-label="Previous move" onClick={() => setViewPly((v) => Math.max(0, (v ?? sans.length - 1) - 1))}>◀</button>
              <button className="btn btn-ghost btn-sm" aria-label="Next move" onClick={() => setViewPly((v) => (v === null || v + 1 >= sans.length - 1 ? null : v + 1))}>▶</button>
              <button className="btn btn-ghost btn-sm" aria-label="Last move" onClick={() => setViewPly(null)}>⏭</button>
              <button className="btn btn-ghost btn-sm" aria-label="Flip board" onClick={() => setFlipped((f) => !f)}>⇅</button>
            </div>
          </Card>
          {!live.over ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" disabled={!live.setup.takebacks || live.moves.length < (live.userColor === 'w' ? 1 : 2)} onClick={takeback}>↶ Takeback</button>
              <button className="btn" onClick={offerDraw} disabled={live.moves.length < 2}>½ Offer draw</button>
              <button className="btn" onClick={() => setConfirm('resign')} disabled={live.moves.length < 2}>⚑ Resign</button>
              <button className="btn" onClick={() => setConfirm('abandon')}>↻ Restart</button>
            </div>
          ) : (
            <Card className="border-brass-600/60">
              <div className="text-center">
                <div className="h-display text-2xl">{live.over.result === '1/2-1/2' ? 'Draw' : (live.over.result === '1-0') === (live.userColor === 'w') ? 'You won' : 'You lost'}</div>
                <div className="text-sm text-ink-300 mt-1">{live.over.reason} · {live.over.result}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="btn btn-primary" disabled={!savedId} onClick={() => savedId && go(`review/${savedId}`)}>Review game</button>
                <button className="btn" onClick={start}>Rematch</button>
                <button className="btn col-span-2" onClick={() => setLive(null)}>New opponent</button>
              </div>
              {savedId && <p className="mt-3 text-xs text-ink-400 text-center">Saved. Analysis runs in the background; your weakness profile updates when it finishes.</p>}
            </Card>
          )}
          {live.takebacks > 0 && <p className="text-xs text-ink-400">Takebacks used: {live.takebacks}</p>}
          {!live.over && data && (
            <div className="grid grid-cols-2 gap-3 card p-3">
              <Stat label="Your estimate" value={data.strength.rating} sub={data.strength.provisional ? 'provisional' : `±${data.strength.deviation}`} />
              <Stat label="Opponent" value={`~${level.elo}`} sub={pers.name} />
            </div>
          )}
        </div>
      </div>
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'resign' ? 'Resign this game?' : 'Abandon and restart?'}>
        <p className="text-sm text-ink-300">{confirm === 'resign' ? 'The game will be saved as a loss and analysed.' : 'The current game will not be saved.'}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const c = confirm; setConfirm(null);
            if (c === 'resign') finish(live, live.userColor === 'w' ? '0-1' : '1-0', `${data?.settings.playerName || 'You'} resigned`);
            else { token.current++; playEngine.cancelAll(); setThinking(false); setLive(null); }
          }}>{confirm === 'resign' ? 'Resign' : 'Restart'}</button>
        </div>
      </Modal>
    </div>
  );
}
export { START_FEN };
