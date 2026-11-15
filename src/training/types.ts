import type { Phase } from '../chess/util';

export type ExerciseKind = 'tactic' | 'endgame' | 'opening' | 'own_mistake';
export interface Exercise {
  id: string;
  /** bank: bundled, engine-verified; game: from one of your games; theory: curated endgame/opening. */
  source: 'bank' | 'game' | 'theory';
  kind: ExerciseKind;
  /** Weakness/theme key (see themes.ts). */
  theme: string;
  fen: string;
  /** UCI moves: solver, reply, solver, ... For 'win'/'draw' goals only the first move is a hint. */
  solution: string[];
  rating: number;
  phase: Phase;
  prompt: string;
  explanation: string;
  /** best: find the move sequence; hold: find the only saving move; win/draw: play it out vs the engine. */
  goal: 'best' | 'hold' | 'win' | 'draw';
  evalCp?: number;
  threat?: string;
  /** For own-mistake exercises: the move you played and the game it came from. */
  played?: string;
  gameId?: string;
  ply?: number;
  title?: string;
  /** Weakness key this exercise was created for (own-game exercises). */
  weakness?: string;
  /** Accept any move within this many win-% points of the best (own-game positions are not always unique). */
  tolerance?: number;
}
