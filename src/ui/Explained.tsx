// Text where chess terms are tappable: tap one to see a short definition.
import { useMemo, useState, Fragment } from 'react';
import { GLOSSARY } from '../data/glossary';

const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp(`\\b(${TERMS.map(esc).join('|')})(s|es|ed)?\\b`, 'gi');
const lookup = (w: string) => TERMS.find((t) => t.toLowerCase() === w.toLowerCase());

export function Explained({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const parts = useMemo(() => {
    const out: (string | { word: string; term: string })[] = [];
    let last = 0;
    for (const m of text.matchAll(RE)) {
      const term = lookup(m[1]);
      if (!term) continue;
      out.push(text.slice(last, m.index));
      out.push({ word: m[0], term });
      last = (m.index ?? 0) + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text]);
  return (
    <span className={className}>
      {parts.map((p, i) => typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : (
        <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setOpen(open === p.term ? null : p.term); }}
          className="underline decoration-dotted decoration-brass-400/70 underline-offset-2 hover:text-brass-300 cursor-help" title="What does this mean?">{p.word}</button>
      ))}
      {open && (
        <span className="mt-1.5 block rounded-lg bg-ink-800 px-3 py-2 text-xs leading-relaxed text-ink-200 ring-1 ring-brass-600/40" onClick={() => setOpen(null)}>
          <b className="text-brass-300 capitalize">{open}:</b> {GLOSSARY[open]}
        </span>
      )}
    </span>
  );
}
