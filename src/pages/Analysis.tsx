// ANALYSIS BOARD: analyse any position or pasted game with a live evaluation
// bar, engine lines, move labels and "why is this better" comparisons.
import { useState } from 'react';
import { Chess } from 'chess.js';
import { AnalysisBoard } from '../ui/AnalysisBoard';
import { Page, Spinner } from '../ui/common';
import { useAppData } from '../services/data';
import { START_FEN, isSanePosition } from '../chess/util';

export function AnalysisPage({ fenParam }: { fenParam?: string }) {
  const [data] = useAppData();
  const [root, setRoot] = useState(() => (fenParam && isSanePosition(fenParam) ? new Chess(fenParam).fen() : START_FEN));
  const [line, setLine] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [key, setKey] = useState(0);
  if (!data) return <Page title="Analysis board"><Spinner /></Page>;

  function load() {
    const t = text.trim();
    setErr('');
    if (!t) return;
    // A FEN?
    if (t.split(' ').length >= 2 && t.includes('/') && !t.includes('.')) {
      if (!isSanePosition(t)) { setErr('That FEN is not a legal position.'); return; }
      setRoot(new Chess(t).fen()); setLine([]); setKey((k) => k + 1); return;
    }
    // Otherwise a PGN or a list of moves
    const c = new Chess();
    try { c.loadPgn(t); } catch {
      try {
        const c2 = new Chess();
        for (const tok of t.replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)) {
          if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) break;
          c2.move(tok);
        }
        const h = c2.history({ verbose: true });
        setRoot(START_FEN); setLine(h.map((m) => m.lan)); setKey((k) => k + 1); return;
      } catch { setErr('Could not read that. Paste a FEN, a PGN, or moves like "e4 e5 Nf3".'); return; }
    }
    const h = c.history({ verbose: true });
    const start = h[0]?.before ?? START_FEN;
    setRoot(start); setLine(h.map((m) => m.lan)); setKey((k) => k + 1);
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-2 sm:px-6 py-3 sm:py-6 fade-in">
      <AnalysisBoard key={key} fen={root} initialLine={line} theme={data.settings.boardTheme} coords={data.settings.showCoords}
        intro={line.length ? 'Step through the game with ▶ or the arrow keys: every move gets rated. Play your own moves at any point to explore.' : undefined} />
      <div className="mt-4 card p-3">
        <div className="label mb-1">Load a position or game</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea className="input h-16 font-mono text-xs" placeholder="Paste a FEN, a PGN, or moves like: e4 e5 Nf3 Nc6 Bb5" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex sm:flex-col gap-2">
            <button className="btn btn-primary" onClick={load}>Load</button>
            <button className="btn" onClick={() => { setRoot(START_FEN); setLine([]); setKey((k) => k + 1); setText(''); }}>New board</button>
          </div>
        </div>
        {err && <p className="mt-1 text-sm text-blunder">{err}</p>}
      </div>
    </div>
  );
}
