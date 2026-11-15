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
  { key: 'missed_fork', label: 'Missed forks', category: 'tactical', train: ['fork'], lesson: 'Before each move, look for a square where one piece (often a knight or queen) can attack two things at once.' },
  { key: 'missed_pin', label: 'Missed pins', category: 'tactical', train: ['pin'], lesson: 'When an enemy piece stands in front of its king or queen on a line, look for a bishop, rook or queen that can pin it.' },
  { key: 'missed_skewer', label: 'Missed skewers', category: 'tactical', train: ['skewer'], lesson: 'When a valuable piece stands in front of another on a line, attack it: when it moves, the piece behind falls.' },
  { key: 'missed_discovered', label: 'Missed discovered attacks', category: 'tactical', train: ['discovered'], lesson: 'If one of your pieces blocks a line of your rook, bishop or queen, moving it can create two threats at once.' },
  { key: 'missed_free_material', label: 'Missed free material', category: 'tactical', train: ['capture_hanging', 'winning_capture'], lesson: 'Every move, ask: did my opponent leave anything undefended? Count attackers and defenders.' },
  { key: 'hanging_pieces', label: 'Hanging pieces', category: 'tactical', train: ['defense', 'capture_hanging'], lesson: 'Before you let go of a piece, check every square it moves to and every piece it stops defending: can it be taken for free?' },
  { key: 'back_rank', label: 'Back-rank weaknesses', category: 'tactical', train: ['back_rank', 'mating_threat'], lesson: 'A king behind three unmoved pawns can be mated on the back rank. Make an escape square (h3/h6) when the rooks come out.' },
  { key: 'missed_mate', label: 'Missed checkmates', category: 'tactical', train: ['mate_in_1', 'mate_in_2', 'mate_in_3'], lesson: 'Look at every check first. Checks are forcing, and forced lines are the ones you can calculate to the end.' },
  { key: 'missed_mating_threat', label: 'Missed mating threats', category: 'tactical', train: ['mating_threat', 'back_rank'], lesson: 'After your opponent moves, ask "what checks and captures do they threaten next?" before your own plan.' },
  { key: 'missed_threat', label: 'Not seeing opponent threats', category: 'tactical', train: ['defense', 'mating_threat'], lesson: 'After every opponent move ask: why did they play that? What does it attack now?' },
  { key: 'missed_tactic', label: 'Missed winning tactics', category: 'tactical', train: ['advantage', 'fork', 'pin', 'discovered'], lesson: 'When your pieces are active and theirs are loose, look harder: there is often a tactic waiting.' },
  { key: 'poor_calculation', label: 'Calculation errors', category: 'calculation', train: ['mate_in_2', 'mate_in_3', 'advantage'], lesson: 'In sharp positions, write the line out in your head to the end: "I go there, they take, I take back... then what?"' },
  // Positional
  { key: 'piece_placement', label: 'Poor piece placement', category: 'positional', train: ['positional'], lesson: 'Put pieces on squares where they control the centre and cannot be chased away easily. Knights on the rim are dim.' },
  { key: 'pawn_structure', label: 'Weakening pawn structure', category: 'positional', train: ['positional'], lesson: 'Pawns cannot move backwards. Avoid creating doubled or isolated pawns without getting something real for it.' },
  { key: 'bad_exchange', label: 'Bad exchanges', category: 'positional', train: ['winning_capture', 'defense'], lesson: 'Before trading, count the material after all the captures, and ask which side the trade helps.' },
  { key: 'king_safety', label: 'Poor king safety', category: 'positional', train: ['mating_threat', 'defense'], lesson: 'Castle early and avoid pushing the pawns in front of your king unless you have a clear reason.' },
  { key: 'passive_play', label: 'Passive play', category: 'positional', train: ['advantage', 'positional'], lesson: 'If you are not under threat, improve your worst piece or create a threat. Waiting moves let the opponent take over.' },
  { key: 'missed_advantage', label: 'Not using advantages', category: 'positional', train: ['advantage'], lesson: 'When you are better, look for the move that makes it bigger: an attack, a break, or a trade into a won endgame.' },
  // Opening
  { key: 'opening_development', label: 'Slow development', category: 'opening', train: ['opening'], lesson: 'In the opening: knights and bishops out, castle, connect the rooks. Move each piece once before moving one twice.' },
  { key: 'early_queen', label: 'Early queen moves', category: 'opening', train: ['opening'], lesson: 'An early queen gets chased by minor pieces and you lose time. Bring her out after the minor pieces.' },
  { key: 'center_control', label: 'Losing central control', category: 'opening', train: ['opening'], lesson: 'Fight for e4, d4, e5 and d5 with pawns and pieces. Whoever controls the centre has more room for everything else.' },
  { key: 'opening_unfamiliar', label: 'Opening mistakes', category: 'opening', train: ['opening'], lesson: 'Learn the first moves and the main ideas of your openings, not long memorised lines.' },
  // Endgame
  { key: 'king_activity', label: 'Passive king in endgames', category: 'endgame', train: ['eg_pawn', 'eg_opposition'], lesson: 'In the endgame the king is a strong piece. Bring it to the centre as soon as the queens are off.' },
  { key: 'promotion_technique', label: 'Pawn promotion technique', category: 'endgame', train: ['eg_pawn', 'eg_opposition'], lesson: 'Escort passed pawns with the king in front of them, and push passed pawns that the enemy king cannot catch.' },
  { key: 'opposition', label: 'Opposition', category: 'endgame', train: ['eg_opposition', 'eg_pawn'], lesson: 'In king-and-pawn endings, standing kings face to face with one square between them decides who gets through.' },
  { key: 'rook_endgames', label: 'Rook endgames', category: 'endgame', train: ['eg_rook'], lesson: 'Rooks belong behind passed pawns. Keep your rook active; a passive rook loses rook endings.' },
  { key: 'minor_endgames', label: 'Minor-piece endgames', category: 'endgame', train: ['eg_minor'], lesson: 'Bishops love open boards with pawns on both wings; knights like closed positions and outposts.' },
  { key: 'conversion', label: 'Converting winning positions', category: 'endgame', train: ['eg_conversion', 'eg_rook', 'eg_pawn'], lesson: 'When ahead in material, trade pieces (not pawns), keep it simple and do not allow counterplay.' },
  { key: 'holding_draws', label: 'Holding equal endgames', category: 'endgame', train: ['eg_rook', 'eg_draw'], lesson: 'When defending, keep your pieces active and know the drawing set-ups (e.g. Philidor in rook endings).' },
  // Decision-making
  { key: 'moving_fast', label: 'Moving too quickly', category: 'calculation', train: ['defense', 'advantage'], lesson: 'Your worst mistakes came on quick moves. In tense positions, slow down and run a blunder check.' },
  { key: 'ignored_forcing', label: 'Ignoring forcing moves', category: 'calculation', train: ['mate_in_2', 'fork', 'discovered'], lesson: 'Checks, captures and threats first: for you and for your opponent, every move.' },
  { key: 'unsound_sacrifice', label: 'Unsound sacrifices', category: 'calculation', train: ['defense', 'advantage'], lesson: 'Before giving up material, calculate the follow-up to the end: what exactly do you get back, and what is your opponent\'s best defence?' },
  { key: 'no_blunder_check', label: 'Missing simple replies', category: 'calculation', train: ['defense', 'capture_hanging'], lesson: 'Before playing a move, look at your opponent\'s checks and captures after it. Most blunders fail to a one-move reply.' },
];
export const WEAKNESS: Record<string, WeaknessDef> = Object.fromEntries(WEAKNESSES.map((w) => [w.key, w]));

export const THEME_LABEL: Record<string, string> = {
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discovered: 'Discovered attack', capture_hanging: 'Free material',
  winning_capture: 'Winning exchange', back_rank: 'Back-rank mate', mate_in_1: 'Mate in 1', mate_in_2: 'Mate in 2',
  mate_in_3: 'Mate in 3', mating_threat: 'Stop the mate', defense: 'Spot the threat', advantage: 'Find the winning move',
  promotion: 'Promotion', positional: 'Best positional move', opening: 'Opening', own: 'Your game',
  eg_pawn: 'Pawn endgame', eg_opposition: 'Opposition', eg_rook: 'Rook endgame', eg_minor: 'Minor-piece endgame',
  eg_queen: 'Queen endgame', eg_conversion: 'Convert the win', eg_draw: 'Hold the draw', eg_mate: 'Basic mate',
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
