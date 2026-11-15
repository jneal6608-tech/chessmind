import type { ReactNode } from 'react';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-5 sm:py-8 fade-in">
      <header className="mb-5 sm:mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display text-2xl sm:text-[2rem] text-ink-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-300 max-w-2xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-[0.95rem] font-semibold text-ink-100">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? 'text-ink-100'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-600 p-6 text-center text-sm text-ink-300">{children}</div>;
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-ink-900 p-1 ring-1 ring-ink-700">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === o.value ? 'bg-ink-700 text-brass-300 shadow' : 'text-ink-300 hover:text-ink-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card-hi w-full max-w-md p-5 fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h3 className="h-display text-xl mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-500 border-t-brass-400 ${className}`} />;
}
export function Bar({ value, max = 100, color = 'bg-brass-400' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-700 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}
export const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
export function resultFor(result: string, color: 'w' | 'b'): 'win' | 'loss' | 'draw' | 'none' {
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return color === 'w' ? 'win' : 'loss';
  if (result === '0-1') return color === 'b' ? 'win' : 'loss';
  return 'none';
}
export function ResultBadge({ result, color }: { result: string; color: 'w' | 'b' }) {
  const r = resultFor(result, color);
  const cls = r === 'win' ? 'bg-good/15 text-good ring-good/30' : r === 'loss' ? 'bg-blunder/15 text-blunder ring-blunder/30' : 'bg-ink-600/40 text-ink-200 ring-ink-500/40';
  return <span className={`inline-flex w-14 justify-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ${cls}`}>{r === 'none' ? '—' : r.toUpperCase()}</span>;
}
