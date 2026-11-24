import type { Color } from 'chess.js';
import type { Phase } from '../chess/util';
import type { Motif } from '../chess/motifs';

export type MoveClass = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'miss' | 'forced';

export interface Tag {
  /** Weakness key from training/themes.ts */
  key: string;
  /** 0..1: how sure the classifier is about this cause. */
  confidence: number;
  /** Evidence in plain language. */
  why: string;
}

export interface MoveAnalysis {
  ply: number; // 0-based half-move index
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** White's point of view, centipawns (mates near +/-10000). */
  evalBefore: number;
  evalAfter: number;
  bestUci: string;
  bestSan: string;
  /** Engine main line from fenBefore, SAN. */
  bestLine: string[];
  bestLineUci: string[];
  /** Engine's second choice (when there was one): its first move and score, mover's view. */
  secondUci?: string;
  secondSan?: string;
  secondCp?: number;
  /** Engine score of the best move, mover's view. */
  bestCp?: number;
  /** Opponent's best reply line after the played move, SAN. */
  replyLine: string[];
  replyLineUci: string[];
  /** Win-chance loss in percentage points for the mover (0..100). */
  winLoss: number;
  /** Centipawn loss, capped at 1000. */
  cpl: number;
  accuracy: number;
  cls: MoveClass;
  phase: Phase;
  timeMs?: number;
  motifsBest: Motif[];
  motifsReply: Motif[];
  /** Threat that existed before the move (what the opponent would do if it were their turn). */
  threatSan?: string;
  threatUci?: string;
  tags: Tag[];
  depth: number;
}

export interface PhaseStats { moves: number; accuracy: number; inaccuracies: number; mistakes: number; blunders: number }

export interface GameAnalysis {
  version: number;
  depth: number;
  moves: MoveAnalysis[];
  /** Index into moves of the user's most instructive errors, worst first. */
  critical: number[];
  accuracy: { w: number; b: number };
  counts: { w: Counts; b: Counts };
  phases: Record<Phase, PhaseStats>;
  lessons: { key: string; text: string; plies: number[] }[];
  missedWins: number;
  analyzedAt: number;
}
export interface Counts { inaccuracy: number; mistake: number; blunder: number; miss: number; best: number }

export interface OpponentInfo {
  kind: 'ai' | 'human';
  name: string;
  levelId?: string;
  personality?: string;
  elo?: number;
}

export interface GameRecord {
  id: string;
  date: number;
  source: 'play' | 'import';
  pgn: string;
  startFen?: string;
  moves: string[]; // uci
  sans: string[];
  times?: number[]; // ms spent per ply (user's and opponent's)
  userColor: Color;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination: string;
  opponent: OpponentInfo;
  timeControl?: string;
  opening?: { eco: string; name: string; ply: number };
  analysis?: GameAnalysis;
  takebacks?: number;
  userElo?: number;
  /** Opening-line practice: the line the bot followed, and where you left it (ply, book move, your move). */
  book?: { lineId: string; name: string; plies: number; deviated?: { ply: number; book: string; played: string } };
}
