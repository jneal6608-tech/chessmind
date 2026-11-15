import { kv } from './db';

export interface Settings {
  playerName: string;
  /** Usernames on other sites: used to find your colour in imported PGNs. */
  aliases: string[];
  startingElo: number;
  boardTheme: 'walnut' | 'slate' | 'green' | 'marble';
  showCoords: boolean;
  animation: boolean;
  sound: boolean;
  analysisDepth: number;
  autoAnalyze: boolean;
  coachLevel: 'auto' | 'beginner' | 'intermediate' | 'advanced';
  aiModel: string;
  aiEnabled: boolean;
  confirmMoves: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  playerName: 'You', aliases: [], startingElo: 1250, boardTheme: 'walnut', showCoords: true, animation: true,
  sound: true, analysisDepth: 12, autoAnalyze: true, coachLevel: 'auto', aiModel: 'claude-opus-5-5', aiEnabled: false,
  confirmMoves: false,
};
let cache: Settings | null = null;
export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  cache = { ...DEFAULT_SETTINGS, ...((await kv.get<Partial<Settings>>('settings')) ?? {}) };
  return cache;
}
export async function saveSettings(p: Partial<Settings>) {
  cache = { ...(await getSettings()), ...p };
  await kv.set('settings', cache);
  return cache;
}
export function clearSettingsCache() { cache = null; }
/** The API key is kept apart from settings and is never included in exports. */
export const apiKey = {
  get: () => kv.get<string>('apiKey'),
  set: (k: string) => kv.set('apiKey', k),
};
