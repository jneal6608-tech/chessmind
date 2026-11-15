import { formatScore, winPct } from '../engine/uci';

/** Vertical evaluation bar, White at the bottom unless flipped. */
export function EvalBar({ cp, flipped, thinking }: { cp: number | null; flipped?: boolean; thinking?: boolean }) {
  const w = cp === null ? 50 : winPct(cp);
  const label = cp === null ? '' : formatScore(cp);
  return (
    <div className="relative self-stretch shrink-0 w-3 sm:w-4 overflow-hidden rounded-[4px] bg-ink-700 ring-1 ring-white/5" title={label ? `Evaluation ${label}` : 'Evaluation'}>
      <div className="absolute inset-x-0 transition-all duration-500 ease-out bg-[#ecebe6]" style={flipped ? { top: 0, height: `${w}%` } : { bottom: 0, height: `${w}%` }} />
      {label && (
        <div className={`absolute inset-x-0 text-[8px] sm:text-[9px] font-bold text-center ${(w >= 50) !== !!flipped ? 'bottom-0.5 text-ink-800' : 'top-0.5 text-ink-100'} ${thinking ? 'opacity-60' : ''}`}>
          {label.replace('+', '')}
        </div>
      )}
    </div>
  );
}
