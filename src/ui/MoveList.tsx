import { useEffect, useRef } from 'react';
import type { MoveClass } from '../analysis/types';
import { CLASS_GLYPH, CLASS_LABEL } from './classes';

export function MoveList({ sans, current, onSelect, classes, startPly = 0 }: {
  sans: string[]; current: number; onSelect?: (ply: number) => void; classes?: (MoveClass | undefined)[]; startPly?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the current move visible by scrolling the list box only (never the page).
  useEffect(() => {
    const box = ref.current;
    const a = box?.querySelector<HTMLElement>('[data-active="true"]');
    if (!box || !a) return;
    const top = a.offsetTop, bottom = top + a.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top - 4;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 4;
  }, [current]);
  const rows: { no: number; w?: number; b?: number }[] = [];
  const blackFirst = startPly % 2 === 1;
  sans.forEach((_, i) => {
    const abs = i + startPly;
    const no = Math.floor(abs / 2) + 1;
    if (abs % 2 === 0 || (i === 0 && blackFirst)) rows.push({ no });
    if (abs % 2 === 0) rows[rows.length - 1].w = i; else rows[rows.length - 1].b = i;
  });
  const cell = (i?: number) => {
    if (i === undefined) return <span className="px-2 py-1 text-ink-500">…</span>;
    const cls = classes?.[i];
    const active = i === current;
    const quiet = cls === 'good' || cls === 'forced';
    return (
      <button data-active={active} onClick={() => onSelect?.(i)} title={cls ? CLASS_LABEL[cls] : undefined}
        className={`flex items-center justify-between gap-1 text-left px-2 py-1 rounded-md font-medium tabular-nums transition-colors ${active ? 'bg-brass-500/25 text-brass-300' : 'hover:bg-ink-700'} ${cls && !quiet && !active ? `cls-${cls}` : ''}`}>
        <span>{sans[i]}</span>
        {cls ? <span className={`text-[10px] font-bold cls-${cls} ${quiet ? 'opacity-50' : ''}`}>{CLASS_GLYPH[cls]}</span> : null}
      </button>
    );
  };
  return (
    <div ref={ref} className="relative scroll-thin h-full overflow-y-auto text-sm">
      {rows.length === 0 && <div className="text-ink-400 text-sm p-2">No moves yet.</div>}
      <div className="grid grid-cols-[2.4rem_1fr_1fr] gap-y-0.5">
        {rows.map((r) => (
          <div key={r.no} className="contents">
            <span className="text-ink-500 py-1 pl-1 tabular-nums">{r.no}.</span>
            {cell(r.w)}{cell(r.b)}
          </div>
        ))}
      </div>
    </div>
  );
}
