import { lazy, Suspense, useEffect, useState } from 'react';
import { useRoute } from './services/router';
import { DashboardPage } from './pages/Dashboard';
import { PlayPage } from './pages/Play';
import { Spinner } from './ui/common';

// Heavier screens load on demand (charts, coach, openings data).
const TrainingPage = lazy(() => import('./pages/Training').then((m) => ({ default: m.TrainingPage })));
const ReviewPage = lazy(() => import('./pages/Review').then((m) => ({ default: m.ReviewPage })));
const OpeningsPage = lazy(() => import('./pages/Openings').then((m) => ({ default: m.OpeningsPage })));
const AnalysisPage = lazy(() => import('./pages/Analysis').then((m) => ({ default: m.AnalysisPage })));
const PrinciplesPage = lazy(() => import('./pages/Principles').then((m) => ({ default: m.PrinciplesPage })));
const CoachPage = lazy(() => import('./pages/Coach').then((m) => ({ default: m.CoachPage })));
const StatsPage = lazy(() => import('./pages/Stats').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
import { analyzeSoon, subscribeQueue } from './services/analysisQueue';
import { getSettings } from './store/settings';
import { setSound } from './services/sound';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l9-8 9 8v8a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { id: 'play', label: 'Play', icon: 'M9 21h8l-1-3H10zM10 17h6l-1-6 2-2-1-4c-1.5-1.5-4.5-1.5-6 0l-1 4 2 2z' },
  { id: 'training', label: 'Training', icon: 'M12 3l2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-.5z' },
  { id: 'review', label: 'Game Analysis', icon: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6' },
  { id: 'analysis', label: 'Analysis Board', icon: 'M4 4h16v16H4zM4 12h16M12 4v16M8 8h.01M16 16h.01' },
  { id: 'openings', label: 'Openings', icon: 'M4 5a2 2 0 012-2h5v18H6a2 2 0 01-2-2zM13 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5z' },
  { id: 'principles', label: 'Principles', icon: 'M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z M9 12l2 2 4-4' },
  { id: 'coach', label: 'AI Coach', icon: 'M4 5h16v11H9l-5 4z M8 9h8M8 12h5' },
  { id: 'stats', label: 'Statistics', icon: 'M5 20V10m7 10V4m7 16v-7' },
  { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .2-1.4-1.4L17 5l-3-1-1 2h-2L10 4 7 5l.4 2-1.4 1.4L4 8.2 3 11l2 1v0l-2 1 1 3 2-.2 1.4 1.4L7 19l3 1 1-2h2l1 2 3-1-.4-2 1.4-1.4 2 .2 1-3z' },
];
const MOBILE = ['dashboard', 'play', 'training', 'review', 'coach'];

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

export function App() {
  const route = useRoute();
  const [page, ...rest] = route;
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => { getSettings().then((s) => setSound(s.sound)); analyzeSoon(); return subscribeQueue((q) => setBusy(!!q.gameId)); }, []);
  useEffect(() => setMore(false), [page]);
  let content;
  switch (page) {
    case 'play': content = <PlayPage key={rest.join('/')} route={rest} />; break;
    case 'training': content = <TrainingPage route={rest} />; break;
    case 'review': content = <ReviewPage id={rest[0]} />; break;
    case 'openings': content = <OpeningsPage route={rest} />; break;
    case 'analysis': content = <AnalysisPage key={rest[0] ?? 'free'} fenParam={rest[0]} />; break;
    case 'principles': content = <PrinciplesPage route={rest} />; break;
    case 'coach': content = <CoachPage key={rest[0] ?? 'free'} fenParam={rest[0]} />; break;
    case 'stats': content = <StatsPage />; break;
    case 'settings': content = <SettingsPage />; break;
    default: content = <DashboardPage />;
  }
  return (
    <div className="min-h-full lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-800 bg-ink-950/80 backdrop-blur lg:flex">
        <a href="#/dashboard" className="flex items-center gap-2.5 px-5 py-6">
          <img src="./favicon.svg" alt="" className="h-8 w-8" />
          <span className="h-display text-xl tracking-tight">Chess<span className="text-brass-400">Mind</span></span>
        </a>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${page === n.id || (!NAV.some((x) => x.id === page) && n.id === 'dashboard') ? 'bg-ink-800 text-brass-300' : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'}`}>
              <Icon d={n.icon} />{n.label}{n.id === 'review' && busy && <span className="ml-auto h-2 w-2 rounded-full bg-brass-400 pulse" title="Analysing" />}
            </a>
          ))}
        </nav>
        <p className="px-5 pb-5 text-[11px] text-ink-500">Stockfish runs locally in your browser. Your data stays on this device.</p>
      </aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur lg:hidden">
        <a href="#/dashboard" className="flex items-center gap-2"><img src="./favicon.svg" alt="" className="h-7 w-7" /><span className="h-display text-lg">Chess<span className="text-brass-400">Mind</span></span></a>
        {busy && <span className="text-xs text-ink-400 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brass-400 pulse" />analysing</span>}
      </header>
      <main className="pb-24 lg:pb-8"><Suspense fallback={<div className="p-8"><Spinner /></div>}>{content}</Suspense></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-ink-800 bg-ink-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.id)).map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${page === n.id ? 'text-brass-300' : 'text-ink-400'}`}><Icon d={n.icon} />{n.label.replace('Game ', '')}</a>
        ))}
        <button onClick={() => setMore(!more)} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${more ? 'text-brass-300' : 'text-ink-400'}`}><Icon d="M5 12h.01M12 12h.01M19 12h.01" />More</button>
      </nav>
      {more && (
        <div className="fixed inset-x-3 bottom-20 z-40 card-hi p-2 lg:hidden fade-in">
          {NAV.filter((n) => !MOBILE.includes(n.id)).map((n) => <a key={n.id} href={`#/${n.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-ink-800"><Icon d={n.icon} />{n.label}</a>)}
        </div>
      )}
    </div>
  );
}
