// The shared vocabulary of weaknesses and exercise themes.
import { Chess } from 'chess.js';
import type { Motif } from '../chess/motifs';
import { pieces, material } from '../chess/util';

export type Category = 'tactical' | 'positional' | 'opening' | 'endgame' | 'calculation';

export interface WeaknessDef {
  key: string;
  label: string;
  category: Category;
  /** Exercise themes that train this weakness, best first. */
  train: string[];
  /** One-line, plain-language lesson shown in reviews and the daily plan. */
  lesson: string;
}

export const WEAKNESSES: WeaknessDef[] = [
  // Tactical
  { key: 'missed_fork', label: 'Missed forks', category: 'tactical', train: ['fork'], lesson: 'Look for a square where one of your pieces (often a knight or queen) can attack two things at once. They can only save one.' },
  { key: 'missed_pin', label: 'Missed pins', category: 'tactical', train: ['pin'], lesson: 'When an enemy piece stands in front of its king or queen on a line, pin it with a bishop, rook or queen.' },
  { key: 'missed_skewer', label: 'Missed skewers', category: 'tactical', train: ['skewer'], lesson: 'When a king or queen stands in front of another piece on a line, look for a skewer: attack the front piece and take the one behind.' },
  { key: 'missed_discovered', label: 'Missed discovered attacks', category: 'tactical', train: ['discovered'], lesson: 'If one of your pieces blocks your rook, bishop or queen, moving it creates a discovered attack, and the moving piece can make a second threat.' },
  { key: 'missed_free_material', label: 'Missed free material', category: 'tactical', train: ['capture_hanging', 'winning_capture'], lesson: 'After every move your opponent makes, ask: is anything of theirs now unprotected? If a piece is attacked more times than it\'s defended, you can usually win it.' },
  { key: 'hanging_pieces', label: 'Hanging pieces', category: 'tactical', train: ['defense', 'capture_hanging'], lesson: 'Before you let go of a piece, check: can the square it lands on be captured? Was it protecting something that is now left alone?' },
  { key: 'back_rank', label: 'Back-rank weaknesses', category: 'tactical', train: ['back_rank', 'mating_threat'], lesson: 'Watch the back rank: a castled king behind three unmoved pawns can be mated there. Make luft (h3/h6) once the rooks come out.' },
  { key: 'missed_mate', label: 'Missed checkmates', category: 'tactical', train: ['mate_in_1', 'mate_in_2', 'mate_in_3'], lesson: 'Look at every check first. A check forces your opponent\'s reply, so you can work out exactly what happens.' },
  { key: 'missed_mating_threat', label: 'Missed mating threats', category: 'tactical', train: ['mating_threat', 'back_rank'], lesson: 'After your opponent moves, ask: "if it were their move again, could they give a dangerous check or capture?" Deal with that before your own plan.' },
  { key: 'missed_threat', label: 'Not seeing opponent threats', category: 'tactical', train: ['defense', 'mating_threat'], lesson: 'After every opponent move, ask: why did they play that? What does that piece attack now, and what did it open up?' },
  { key: 'missed_tactic', label: 'Missed winning tactics', category: 'tactical', train: ['advantage', 'fork', 'pin', 'discovered'], lesson: 'When your pieces are active and theirs are unprotected, slow down and look for checks, captures and double attacks: a winning trick is often there.' },
  { key: 'poor_calculation', label: 'Calculation errors', category: 'calculation', train: ['mate_in_2', 'mate_in_3', 'advantage'], lesson: 'In sharp positions, play the moves out in your head to the end: "I go there, they take, I take back... then what does the board look like?"' },
  // Positional
  { key: 'piece_placement', label: 'Poor piece placement', category: 'positional', train: ['positional'], lesson: 'Put your pieces where they reach a lot of squares, ideally toward the centre, and where pawns can\'t chase them away. A knight on the edge of the board covers only half as many squares.' },
  { key: 'pawn_structure', label: 'Weakening pawn structure', category: 'positional', train: ['positional'], lesson: 'Pawn weaknesses are permanent. Avoid doubled and isolated pawns unless you get something real for them.' },
  { key: 'bad_exchange', label: 'Bad exchanges', category: 'positional', train: ['winning_capture', 'defense'], lesson: 'Before you start trading, count what each side ends up with after all the captures. Then ask: who is happier without these pieces?' },
  { key: 'king_safety', label: 'Poor king safety', category: 'positional', train: ['mating_threat', 'defense'], lesson: 'Castle early, and leave the pawns in front of your king alone unless you have a clear reason: each pawn push opens a door for the enemy.' },
  { key: 'passive_play', label: 'Passive play', category: 'positional', train: ['advantage', 'positional'], lesson: 'When nothing is attacked, find your worst piece and give it a better square, or make a threat. Moves that do nothing let your opponent take over.' },
  { key: 'missed_advantage', label: 'Not using advantages', category: 'positional', train: ['advantage'], lesson: 'When you\'re ahead, look for the move that makes it bigger: a new attack, opening a line, or trading pieces so your extra material counts more.' },
  // Opening
  { key: 'opening_development', label: 'Slow development', category: 'opening', train: ['opening'], lesson: 'In the opening: get the knights and bishops out, castle, and connect your rooks. Move each piece once before moving any piece twice.' },
  { key: 'early_queen', label: 'Early queen moves', category: 'opening', train: ['opening'], lesson: 'If your queen comes out early, your opponent develops pieces by attacking her and you lose time. Bring her out after the knights and bishops.' },
  { key: 'center_control', label: 'Losing central control', category: 'opening', train: ['opening'], lesson: 'Fight for the four centre squares (e4, d4, e5, d5) with pawns and pieces. Pieces in the centre reach both sides of the board.' },
  { key: 'opening_unfamiliar', label: 'Opening mistakes', category: 'opening', train: ['opening'], lesson: 'Know the first few moves of your openings and, more importantly, what they are trying to do. Ideas beat memorised moves.' },
  // Endgame
  { key: 'king_activity', label: 'Passive king in endgames', category: 'endgame', train: ['eg_pawn', 'eg_opposition'], lesson: 'In the endgame your king becomes a fighting piece. Once the queens are gone, march it toward the centre.' },
  { key: 'promotion_technique', label: 'Pawn promotion technique', category: 'endgame', train: ['eg_tactic', 'eg_pawn', 'eg_opposition', 'promotion'], lesson: 'Escort your passed pawn with the king in front of it, and push it when the enemy king is outside the square.' },
  { key: 'opposition', label: 'Opposition', category: 'endgame', train: ['eg_opposition', 'eg_pawn'], lesson: 'In king-and-pawn endings, the opposition decides who gets through. Take it, or use a spare pawn move to gain it.' },
  { key: 'rook_endgames', label: 'Rook endgames', category: 'endgame', train: ['eg_rook'], lesson: 'Rooks belong behind passed pawns, yours or theirs. Keep the rook active; a passive rook loses rook endings.' },
  { key: 'minor_endgames', label: 'Minor-piece endgames', category: 'endgame', train: ['eg_minor'], lesson: 'Bishops love open boards with pawns on both sides; knights like closed positions and safe squares that pawns can\'t attack.' },
  { key: 'conversion', label: 'Converting winning positions', category: 'endgame', train: ['eg_conversion', 'eg_tactic', 'eg_rook', 'eg_pawn'], lesson: 'When you\'re ahead in material, trade pieces (not pawns), keep things simple, and take away your opponent\'s tricks before pushing for the win.' },
  { key: 'holding_draws', label: 'Holding equal endgames', category: 'endgame', train: ['eg_rook', 'eg_draw'], lesson: 'When defending, keep your pieces active and know the drawing set-ups (Philidor, wrong-coloured bishop, and so on).' },
  // Decision-making
  { key: 'moving_fast', label: 'Moving too quickly', category: 'calculation', train: ['defense', 'advantage'], lesson: 'Your worst mistakes came on quick moves. When pieces are attacking each other, slow down and check your move before you play it.' },
  { key: 'ignored_forcing', label: 'Ignoring forcing moves', category: 'calculation', train: ['mate_in_2', 'fork', 'discovered'], lesson: 'Every move, look at checks, captures and threats first: yours and your opponent\'s.' },
  { key: 'unsound_sacrifice', label: 'Unsound sacrifices', category: 'calculation', train: ['defense', 'advantage'], lesson: 'Before giving up material, calculate the follow-up to the end: what exactly do you get back, and what is your opponent\'s best defence?' },
  { key: 'no_blunder_check', label: 'Missing simple replies', category: 'calculation', train: ['defense', 'capture_hanging'], lesson: 'Before you play a move, picture the board after it and look at your opponent\'s checks and captures. Most blunders lose to a simple one-move reply.' },
];
export const WEAKNESS: Record<string, WeaknessDef> = Object.fromEntries(WEAKNESSES.map((w) => [w.key, w]));

export const THEME_LABEL: Record<string, string> = {
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discovered: 'Discovered attack', capture_hanging: 'Free material',
  winning_capture: 'Winning exchange', back_rank: 'Back-rank mate', mate_in_1: 'Mate in 1', mate_in_2: 'Mate in 2',
  mate_in_3: 'Mate in 3', mating_threat: 'Stop the mate', defense: 'Spot the threat', advantage: 'Find the winning move',
  promotion: 'Promotion', positional: 'Best positional move', opening: 'Opening', own: 'Your game',
  eg_pawn: 'Pawn endgame', eg_opposition: 'Opposition', eg_rook: 'Rook endgame', eg_minor: 'Minor-piece endgame',
  eg_queen: 'Queen endgame', eg_conversion: 'Convert the win', eg_draw: 'Hold the draw', eg_mate: 'Basic mate', eg_tactic: 'Endgame tactic',
};

const MOTIF_THEME: Record<string, string> = {
  back_rank_mate: 'back_rank', mate: 'mate_in_1', fork: 'fork', pin: 'pin', skewer: 'skewer', discovered: 'discovered',
  capture_hanging: 'capture_hanging', winning_capture: 'winning_capture', promotion: 'promotion',
};
const ORDER = ['back_rank_mate', 'mate', 'fork', 'skewer', 'pin', 'discovered', 'promotion', 'capture_hanging', 'winning_capture'];
/** Most instructive theme among detected motifs; 'advantage' when the idea is deeper than the detectors see. */
export function themeFromMotifs(m: Motif[]): string {
  for (const k of ORDER) if (m.some((x) => x.kind === k)) return MOTIF_THEME[k];
  return 'advantage';
}

/** Endgame family for an endgame position, or null. */
export function endgameType(fen: string): string | null {
  const c = new Chess(fen);
  const ps = pieces(c).filter((p) => p.type !== 'k');
  const kinds = new Set(ps.filter((p) => p.type !== 'p').map((p) => p.type));
  const m = material(c);
  if (m.wNonPawn + m.bNonPawn > 16) return null;
  if (kinds.has('q')) return kinds.size === 1 ? 'eg_queen' : null;
  if (kinds.size === 0) return ps.length ? 'eg_pawn' : null;
  if (kinds.has('r') && kinds.size === 1) return 'eg_rook';
  if (!kinds.has('r')) return 'eg_minor';
  return null;
}
