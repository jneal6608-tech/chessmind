// Background analysis of finished and imported games. Runs one game at a time
// on the analysis engine, saves the review, and turns mistakes into exercises.
import { games, exercises } from '../store/db';
import { analysisEngine } from '../engine/browser';
import { reviewGame, ANALYSIS_VERSION } from '../analysis/review';
import { exercisesFromGame } from '../training/fromGames';
import { getSettings } from '../store/settings';

export interface QueueStatus { gameId: string | null; done: number; total: number; pending: number; error?: string }
let status: QueueStatus = { gameId: null, done: 0, total: 0, pending: 0 };
const subs = new Set<(s: QueueStatus) => void>();
const set = (s: Partial<QueueStatus>) => { status = { ...status, ...s }; subs.forEach((f) => f(status)); };
export function subscribeQueue(f: (s: QueueStatus) => void) { subs.add(f); f(status); return () => { subs.delete(f); }; }
export const queueStatus = () => status;

let running = false;
const priority: string[] = [];
export function analyzeSoon(id?: string) {
  if (id && !priority.includes(id)) priority.unshift(id);
  void run();
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const all = await games.all();
      const todo = all.filter((g) => !g.analysis || g.analysis.version < ANALYSIS_VERSION).sort((a, b) => b.date - a.date);
      if (!todo.length) { set({ gameId: null, pending: 0 }); break; }
      const pi = priority.map((id) => todo.find((g) => g.id === id)).find(Boolean);
      const g = pi ?? todo[0];
      priority.splice(priority.indexOf(g.id), 1);
      set({ gameId: g.id, done: 0, total: g.moves.length + 1, pending: todo.length, error: undefined });
      const { analysisDepth } = await getSettings();
      try {
        const analysis = await reviewGame(g, analysisEngine, analysisDepth, (p) => set({ done: p.done, total: p.total }));
        const fresh = await games.get(g.id);
        if (!fresh) continue; // deleted meanwhile
        await games.put({ ...fresh, analysis });
        await exercises.putMany(exercisesFromGame({ ...fresh, analysis }));
      } catch (e) {
        set({ error: `Analysis failed: ${(e as Error).message}` });
        break;
      }
    }
  } finally {
    running = false;
  }
}
