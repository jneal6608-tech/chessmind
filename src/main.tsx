import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { allEngines } from './engine/browser';

createRoot(document.getElementById('root')!).render(<App />);
// Engines are Web Workers; shut them down cleanly when the page goes away.
window.addEventListener('pagehide', () => allEngines.forEach((e) => e.terminate()));
