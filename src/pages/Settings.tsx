import { useEffect, useState } from 'react';
import { Page, Card, Segmented, Modal, Spinner } from '../ui/common';
import { useAppData } from '../services/data';
import { saveSettings, apiKey, clearSettingsCache, type Settings } from '../store/settings';
import { exportAll, importAll, wipeAll } from '../store/db';
import { download, exportPgn } from '../services/importer';
import { setSound } from '../services/sound';
import { Board } from '../ui/Board';

export function SettingsPage() {
  const [data] = useAppData();
  const [s, setS] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [msg, setMsg] = useState('');
  const [wipe, setWipe] = useState(false);
  useEffect(() => { if (data && !s) setS(data.settings); }, [data]);
  useEffect(() => { apiKey.get().then((k) => setHasKey(!!k)); }, []);
  if (!s || !data) return <Page title="Settings"><Spinner /></Page>;
  const upd = async (p: Partial<Settings>) => { const n = await saveSettings(p); setS({ ...n }); if ('sound' in p) setSound(!!p.sound); };
  return (
    <Page title="Settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="You">
          <div className="space-y-3">
            <label className="block"><span className="label">Display name</span><input className="input mt-1" value={s.playerName} onChange={(e) => upd({ playerName: e.target.value })} /></label>
            <label className="block"><span className="label">Usernames on other sites (comma separated)</span><input className="input mt-1" defaultValue={s.aliases.join(', ')} onBlur={(e) => upd({ aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="e.g. mylichessname, mychesscomname" />
              <span className="text-xs text-ink-400">Used to tell which colour you played in imported games.</span></label>
            <label className="block"><span className="label">Starting rating for the estimate</span><input className="input mt-1 !w-32" inputMode="numeric" value={s.startingElo} onChange={(e) => upd({ startingElo: Number(e.target.value.replace(/\D/g, '')) || 1250 })} />
              <span className="text-xs text-ink-400 block">Your estimate starts here and moves with results against ChessMind opponents.</span></label>
            <div><span className="label">Coach explanations</span><div className="mt-1"><Segmented value={s.coachLevel} onChange={(v) => upd({ coachLevel: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'beginner', label: 'Simple' }, { value: 'intermediate', label: 'Club' }, { value: 'advanced', label: 'Advanced' }]} /></div>
              <span className="text-xs text-ink-400">Auto: simple below ~1450, more detail as your estimate rises.</span></div>
          </div>
        </Card>
        <Card title="Board">
          <div className="grid grid-cols-[1fr_140px] gap-4 items-start">
            <div className="space-y-3">
              <div><span className="label">Theme</span><div className="mt-1"><Segmented value={s.boardTheme} onChange={(v) => upd({ boardTheme: v })} options={[{ value: 'walnut', label: 'Walnut' }, { value: 'slate', label: 'Slate' }, { value: 'green', label: 'Green' }, { value: 'marble', label: 'Marble' }]} /></div></div>
              {([['showCoords', 'Show coordinates'], ['animation', 'Animate moves'], ['sound', 'Move sounds']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brass-400" checked={s[k]} onChange={(e) => upd({ [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <Board fen="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" movable="none" theme={s.boardTheme} coords={s.showCoords} />
          </div>
        </Card>
        <Card title="Analysis">
          <div className="space-y-3">
            <div><span className="label">Review depth</span><div className="mt-1"><Segmented value={String(s.analysisDepth)} onChange={(v) => upd({ analysisDepth: Number(v) })} options={[{ value: '10', label: 'Fast (10)' }, { value: '12', label: 'Standard (12)' }, { value: '14', label: 'Deep (14)' }, { value: '16', label: 'Deepest (16)' }]} /></div>
              <span className="text-xs text-ink-400">Higher depth is more reliable but slower, especially on Chromebooks. Changing it does not re-analyse old games.</span></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brass-400" checked={s.autoAnalyze} onChange={(e) => upd({ autoAnalyze: e.target.checked })} />Analyse games automatically when they finish</label>
          </div>
        </Card>
        <Card title="Claude coach (optional)">
          <p className="text-sm text-ink-300">Everything in ChessMind works without this. With an Anthropic API key, the AI Coach can hold a free conversation about positions; it must base every evaluation on the Stockfish engine running in your browser.</p>
          <p className="mt-2 text-xs text-ink-400">The key is stored only in this browser (IndexedDB), is never included in exports, and is sent only to api.anthropic.com. Usage is billed to your Anthropic account. Anyone with access to this browser profile could read it.</p>
          <div className="mt-3 flex gap-2"><input type="password" className="input" placeholder={hasKey ? '•••••••• (saved)' : 'sk-ant-…'} value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn" disabled={!key} onClick={async () => { await apiKey.set(key.trim()); setKey(''); setHasKey(true); await upd({ aiEnabled: true }); }}>Save</button>
            {hasKey && <button className="btn" onClick={async () => { await apiKey.set(''); setHasKey(false); await upd({ aiEnabled: false }); }}>Remove</button>}</div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brass-400" disabled={!hasKey} checked={s.aiEnabled && hasKey} onChange={(e) => upd({ aiEnabled: e.target.checked })} />Use Claude in the AI Coach</label>
          <label className="mt-2 block"><span className="label">Model</span><input className="input mt-1" value={s.aiModel} onChange={(e) => upd({ aiModel: e.target.value })} /></label>
        </Card>
        <Card title="Your data" className="lg:col-span-2">
          <p className="text-sm text-ink-300">Everything is stored in this browser (IndexedDB) and survives restarts. Export a backup regularly, especially before clearing browser data or switching devices.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={async () => download(`chessmind-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll(), 'application/json')}>Export full backup (JSON)</button>
            <label className="btn cursor-pointer">Import backup…<input type="file" accept=".json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { await importAll(await f.text(), 'merge'); clearSettingsCache(); setMsg('Backup imported (merged with existing data).'); } catch (err) { setMsg((err as Error).message); }
            }} /></label>
            <button className="btn" disabled={!data.games.length} onClick={() => download('chessmind-games.pgn', exportPgn(data.games))}>Export games (PGN)</button>
            <button className="btn" onClick={() => setWipe(true)}>Erase all data…</button>
          </div>
          {msg && <p className="mt-2 text-sm text-ink-200">{msg}</p>}
          <p className="mt-3 text-xs text-ink-500">{data.games.length} games · {data.attempts.length} exercise attempts · {data.ownExercises.length} positions from your games · {data.repertoire.length} repertoire lines.</p>
        </Card>
        <Card title="About" className="lg:col-span-2">
          <p className="text-xs text-ink-400">Engine: Stockfish 19 (lite, WebAssembly) by the Stockfish developers, GPLv3, via stockfish.js by Nathan Rugg. Board: chessground (GPLv3) by Lichess. Rules: chess.js. Opening names: Lichess chess-openings (CC0). Pieces: Colin M.L. Burnett (cburnett, GPLv2+). ChessMind is therefore distributed under GPLv3.</p>
        </Card>
      </div>
      <Modal open={wipe} onClose={() => setWipe(false)} title="Erase everything?">
        <p className="text-sm text-ink-300">All games, analysis, training history, repertoire and settings are deleted from this browser. This cannot be undone. Export a backup first if you might want it back.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setWipe(false)}>Cancel</button><button className="btn btn-primary" onClick={async () => { await wipeAll(); clearSettingsCache(); setWipe(false); location.reload(); }}>Erase</button></div>
      </Modal>
    </Page>
  );
}
