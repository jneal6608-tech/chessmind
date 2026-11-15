// Loads everything the screens need, and keeps it fresh when the database changes.
import { useEffect, useState, useCallback } from 'react';
import { games as G, attempts as A, srs as S, exercises as E, ratings as R, repertoire as REP, onDataChange, type Attempt, type SrsCard, type RatingEntry, type RepertoireLine } from '../store/db';
import { getSettings, type Settings } from '../store/settings';
import type { GameRecord } from '../analysis/types';
import type { Exercise } from '../training/types';
import { BANK } from '../training/bank';
import { buildProfile, type Profile } from '../analysis/profile';
import { estimateStrength, type Strength } from '../analysis/strength';

export interface AppData {
  games: GameRecord[];
  attempts: Attempt[];
  cards: Map<string, SrsCard>;
  exercises: Exercise[];
  ownExercises: Exercise[];
  ratings: RatingEntry[];
  repertoire: RepertoireLine[];
  settings: Settings;
  profile: Profile;
  strength: Strength;
}

export async function loadAll(): Promise<AppData> {
  const [games, attempts, cards, own, ratings, repertoire, settings] = await Promise.all([G.all(), A.all(), S.all(), E.all(), R.all(), REP.all(), getSettings()]);
  return {
    games, attempts, cards: new Map(cards.map((c) => [c.exerciseId, c])), exercises: [...own, ...BANK], ownExercises: own,
    ratings, repertoire, settings, profile: buildProfile(games, attempts), strength: estimateStrength(games, settings.startingElo),
  };
}

let cached: AppData | null = null;
let inflight: Promise<AppData> | null = null;
function refresh() { inflight = loadAll().then((d) => { cached = d; inflight = null; return d; }); return inflight; }

export function useAppData(): [AppData | null, () => void] {
  const [d, setD] = useState<AppData | null>(cached);
  const reload = useCallback(() => { refresh().then(setD); }, []);
  useEffect(() => {
    if (!cached) (inflight ?? refresh()).then(setD);
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onDataChange(() => { clearTimeout(t); t = setTimeout(() => refresh().then(setD), 120); });
    return () => { off(); clearTimeout(t); };
  }, []);
  return [d, reload];
}
