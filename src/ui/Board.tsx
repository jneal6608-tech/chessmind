// Chessboard: chessground for rendering, drag-and-drop and click-to-move;
// chess.js supplies the legal destinations, so only legal moves can be made.
import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { Chess, type Square } from 'chess.js';

export interface Arrow { from: string; to: string; color?: 'green' | 'red' | 'blue' | 'yellow' }
export interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Which side the user may move: a colour, 'both', or 'none' (view only). */
  movable?: 'white' | 'black' | 'both' | 'none';
  onMove?: (uci: string) => void;
  lastMove?: [string, string];
  arrows?: Arrow[];
  highlights?: Record<string, 'hl-good' | 'hl-bad' | 'hl-info'>;
  theme?: string;
  coords?: boolean;
  animation?: boolean;
}

const BRUSH: Record<string, string> = { green: 'green', red: 'red', blue: 'blue', yellow: 'yellow' };

export function legalDests(fen: string): Map<Key, Key[]> {
  const c = new Chess(fen);
  const d = new Map<Key, Key[]>();
  for (const m of c.moves({ verbose: true })) {
    const arr = d.get(m.from as Key) ?? [];
    arr.push(m.to as Key);
    d.set(m.from as Key, arr);
  }
  return d;
}

export function Board(p: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);
  const onMoveRef = useRef(p.onMove);
  onMoveRef.current = p.onMove;
  const fenRef = useRef(p.fen);
  fenRef.current = p.fen;

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { coordinates: false, disableContextMenu: true, blockTouchScroll: true, addDimensionsCssVarsTo: el.current });
    return () => { api.current?.destroy(); api.current = null; };
  }, []);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const c = new Chess(p.fen);
    const turn = c.turn() === 'w' ? 'white' : 'black';
    const canMove = p.movable === 'both' || p.movable === turn;
    a.set({
      fen: p.fen,
      orientation: p.orientation ?? 'white',
      turnColor: turn,
      check: c.isCheck() ? turn : false,
      lastMove: p.lastMove as Key[] | undefined,
      coordinates: false, // drawn outside the board instead (easier to read)
      animation: { enabled: p.animation ?? true, duration: 180 },
      highlight: { lastMove: true, check: true, custom: new Map(Object.entries(p.highlights ?? {}) as [Key, string][]) },
      movable: {
        free: false,
        color: canMove ? turn : undefined,
        dests: canMove && !c.isGameOver() ? legalDests(p.fen) : new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => {
            const cc = new Chess(fenRef.current);
            const piece = cc.get(orig as Square);
            if (piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
              setPromo({ from: orig, to: dest, color: piece.color });
              return;
            }
            onMoveRef.current?.(orig + dest);
          },
        },
      },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      drawable: {
        enabled: true,
        autoShapes: (p.arrows ?? []).map((ar): DrawShape => ({ orig: ar.from as Key, dest: ar.to as Key, brush: BRUSH[ar.color ?? 'green'] })),
      },
    });
  }, [p.fen, p.orientation, p.movable, p.lastMove?.[0], p.lastMove?.[1], JSON.stringify(p.arrows), JSON.stringify(p.highlights), p.coords, p.animation]);

  const choose = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promo) return;
    const uci = promo.from + promo.to + piece;
    setPromo(null);
    onMoveRef.current?.(uci);
  };
  const cancelPromo = () => { setPromo(null); api.current?.set({ fen: fenRef.current }); };

  const white = (p.orientation ?? 'white') === 'white';
  const files = white ? 'abcdefgh' : 'hgfedcba';
  const ranks = white ? '87654321' : '12345678';
  const showCoords = p.coords ?? true;
  const shell = (
    <div className={`board-shell theme-${p.theme ?? 'walnut'}`}>
      <div ref={el} className="cg-wrap" />
      {promo && (
        <div className="promo-overlay" onClick={cancelPromo} role="dialog" aria-label="Choose promotion piece">
          <div className="flex w-full justify-center" onClick={(e) => e.stopPropagation()}>
            {(['q', 'r', 'b', 'n'] as const).map((t) => (
              <button key={t} onClick={() => choose(t)} aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[t]}>
                <img src={`./pieces/${promo.color}${t}.svg`} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  if (!showCoords) return shell;
  // Rank numbers on the left, file letters underneath, outside the squares.
  return (
    <div className="board-coords grid grid-cols-[1.1rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_1.2rem]">
      <div className="grid grid-rows-8 pr-1">{[...ranks].map((r) => <span key={r} className="coord-label flex items-center justify-end">{r}</span>)}</div>
      {shell}
      <span />
      <div className="grid grid-cols-8 pt-0.5">{[...files].map((f) => <span key={f} className="coord-label text-center">{f}</span>)}</div>
    </div>
  );
}
