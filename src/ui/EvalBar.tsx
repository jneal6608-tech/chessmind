import { formatScore, winPct } from '../engine/uci';

/** Vertical evaluation bar, White at the bottom unless flipped. The number is always shown, from White's point of view. */
export function EvalBar({ cp, flipped, thinking, size = 'md' }: { cp: number | null; flipped?: boolean; thinking?: boolean; size?: 'sm' | 'md' }) {
  const w = cp === null ? 50 : winPct(cp);
  const label = cp === null ? '' : formatScore(cp);
  const whiteAhead = w >= 50;
  // Label sits at the end of the side that is ahead.
  const atBottom = whiteAhead !== !!flipped;
  return (
    <div className={`relative self-stretch shrink-0 overflow-hidden rounded-md bg-[#2a2d34] ring-1 ring-white/10 ${size === 'sm' ? 'w-3 sm:w-4' : 'w-5 sm:w-7'}`}
      title={label ? `Evaluation ${label} (White's view)` : 'Evaluation'} aria-label={label ? `Evaluation ${label}` : 'Evaluation'}>
      <div className="absolute inset-x-0 transition-all duration-500 ease-out bg-[#ecebe6]" style={flipped ? { top: 0, height: `${w}%` } : { bottom: 0, height: `${w}%` }} />
      <div className="absolute inset-x-0 top-1/2 h-px bg-brass-500/60" />
      {label && size === 'md' && (
        <div className={`absolute inset-x-0 text-center font-bold leading-none tabular-nums text-[9px] sm:text-[11px] ${atBottom ? 'bottom-1' : 'top-1'} ${whiteAhead ? 'text-ink-900' : 'text-ink-100'} ${thinking ? 'opacity-60' : ''}`}>
          {label.replace('+', '')}
        </div>
      )}
    </div>
  );
}
