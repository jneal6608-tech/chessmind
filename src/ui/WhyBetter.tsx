// "Why is the engine's move better?" in words: the summary plus the concrete
// reasons (material, threats, outposts, open files, the plan...). Then the
// follow-up: open either line on a board and play moves for BOTH sides, with
// a live evaluation, move labels and the same explanations for every try.
import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chess } from 'chess.js';
import type { Comparison } from '../coach/compare';
import { Explained } from './Explained';
import { Spinner } from './common';
import { formatLine, pvToSan } from '../chess/util';

const AnalysisBoard = lazy(() => import('./AnalysisBoard').then((m) => ({ default: m.AnalysisBoard })));

export function WhyBetter({ c, title, className = '' }: { c: Comparison; title?: string; className?: string }) {
  const [open, setOpen] = useState<{ line: string[]; title: string } | null>(null);
  const side = new Chess(c.fen).turn();
  const lineOf = (pv: string[]) => pv.slice(0, 8);
  return (
    <div className={`rounded-lg bg-ink-900 p-2.5 text-sm ${className}`}>
      <div className="label !text-[10px]">{title ?? (c.equal ? `${c.better.san} or ${c.worse.san}: what each is going for` : `Why ${c.better.san} is better than ${c.worse.san}`)}</div>
      <div className="mt-1 font-semibold text-ink-100"><Explained text={c.summary} /></div>
      <ul className="mt-1 list-disc pl-5 space-y-1 text-ink-300">{c.reasons.map((r, i) => <li key={i}><Explained text={r} /></li>)}</ul>
      <div className="mt-2 space-y-0.5 text-xs text-ink-400">
        <div><b className="text-good">{c.better.san}</b>: <span className="font-mono">{formatLine(c.fen, pvToSan(c.fen, c.better.pv, 6))}</span></div>
        <div><b className="text-mistake">{c.worse.san}</b>: <span className="font-mono">{formatLine(c.fen, pvToSan(c.fen, c.worse.pv, 6))}</span></div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className="btn btn-sm" onClick={() => setOpen({ line: lineOf(c.better.pv), title: `Play it out: ${c.better.san}` })}>▶ Play out {c.better.san}</button>
        <button className="btn btn-sm" onClick={() => setOpen({ line: lineOf(c.worse.pv), title: `Play it out: ${c.worse.san}` })}>▶ Play out {c.worse.san}</button>
        <button className="btn btn-sm" onClick={() => setOpen({ line: [], title: 'Try your own moves for both sides' })}>Try my own moves</button>
      </div>
      <p className="mt-1 text-[11px] text-ink-500">Step through the line with ◀ ▶, or make any move for either side: the board answers with the evaluation, a label and why.</p>
      {open && createPortal(
        <div data-explorer className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/95 backdrop-blur p-2 sm:p-6">
          <div className="mx-auto max-w-[1320px]">
            <Suspense fallback={<Spinner />}>
              <AnalysisBoard fen={c.fen} initialLine={open.line} orientation={side === 'w' ? 'white' : 'black'} title={open.title}
                intro={`Both sides are yours to move. Compare ${c.better.san} with ${c.worse.san}: play the opponent's best replies, then try your ideas.`} onClose={() => setOpen(null)} />
            </Suspense>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
