// What every exercise theme teaches: the pattern, how to spot it, the questions
// to ask at the board, and the classic mistake. Shown by the coach before and
// after each exercise, so the exercise trains a habit, not just a move.
import type { CoachLevel } from '../coach/explain';

export interface ThemeGuide {
  /** One line: what this pattern is. */
  what: string;
  /** The checklist to run at the board. */
  ask: string[];
  /** The tell-tale signs in a position. */
  spot: string;
  /** The usual way people get it wrong. */
  trap: string;
  /** Extra depth for stronger players. */
  deeper?: string;
}

export const THEME_GUIDE: Record<string, ThemeGuide> = {
  defense: {
    what: 'Your opponent has a threat. Before your own plans, you must see it and find the move that handles it.',
    spot: 'Look at the piece they moved last: what does it attack now, and what line did it open behind it?',
    ask: ['If I passed, what would they play? Checks, captures, attacks on loose pieces.', 'Which of my pieces are attacked more times than they are defended?', 'Can I defend AND improve at once: move the piece to a better square, or counter-attack something bigger?'],
    trap: 'Seeing only one threat and fixing it, while the second threat (often a check or a back-rank idea) is still there.',
    deeper: 'Rank the defences: counter-threat first (gains time), then moving the target to an active square, then guarding, then blocking. Passive guards usually lose slowly.',
  },
  mating_threat: {
    what: 'They threaten checkmate. Nothing else on the board matters until that is stopped.',
    spot: 'Heavy pieces (queen, rooks) pointing at your king, a back rank with no escape square, or pieces near your king that you can\'t chase away.',
    ask: ['Which checks do they have, and where could my king go?', 'Can I give my king an escape square (luft), block the line, or trade the attacking piece?', 'Is there a check of my own that changes everything?'],
    trap: 'Grabbing material or starting your own attack "because it is faster" when their mate comes first.',
    deeper: 'Count tempi: an attack that is one move slower than theirs is worth nothing. A defence that also trades an attacker is usually best.',
  },
  capture_hanging: {
    what: 'Something of theirs is not defended (or defended too few times). Take it.',
    spot: 'After every opponent move, scan their pieces: which ones have no defender?',
    ask: ['What did their last move stop defending?', 'Is the piece really free, or is it a trap (a check or a fork after I take)?', 'After I take, is my capturing piece safe?'],
    trap: 'Taking with the wrong piece and walking into a fork, or missing that the "free" piece was bait for a back-rank mate.',
  },
  winning_capture: {
    what: 'A capture that wins material even after they take back: you are trading something small for something big, or the defenders run out.',
    spot: 'Count attackers and defenders on the square. If you attack it more times than they defend it, the last capture is yours.',
    ask: ['How many times do I attack it? How many times do they defend it?', 'Who captures first with the cheapest piece?', 'When the dust settles, who is up?'],
    trap: 'Starting the exchange with your most valuable piece: take with the least valuable attacker first.',
    deeper: 'Static exchange evaluation: list captures from cheapest to dearest on both sides and stop the moment continuing loses.',
  },
  fork: {
    what: 'One piece attacks two targets at once. They can save only one.',
    spot: 'Two of their pieces (or king + piece) that a knight, pawn or queen can hit from the same square. Loose pieces and the king are the best targets.',
    ask: ['Which of their pieces are undefended?', 'Is there a square that attacks two of them, especially with check?', 'Can I force a piece onto a forkable square first (a check or a capture)?'],
    trap: 'Forking two defended pieces: if both are protected, the fork wins nothing.',
  },
  pin: {
    what: 'A piece cannot move (or should not) because a more valuable piece stands behind it on the same line.',
    spot: 'Their king or queen on the same line as one of their pieces, with your bishop, rook or queen able to reach that line.',
    ask: ['What stands in front of their king or queen?', 'Can I attack the pinned piece again, with a pawn ideally?', 'Is the pin absolute (king behind: the piece may not move) or relative (it can move but loses material)?'],
    trap: 'Pinning and then not adding pressure: a pin is only as good as the extra attackers you bring.',
  },
  skewer: {
    what: 'The reverse of a pin: attack a big piece, it moves, and you take the piece behind it.',
    spot: 'King or queen in front of another piece on a line, usually after a check drives the king onto that line.',
    ask: ['Which checks put their king in line with something loose?', 'Is the piece behind defended?'],
    trap: 'Skewering a defended rook with your queen: the trade may favour them.',
  },
  discovered: {
    what: 'Moving one piece unmasks an attack by the piece behind it. The moving piece can make a second threat.',
    spot: 'Your piece standing between your rook, bishop or queen and one of their pieces or their king.',
    ask: ['What does my long-range piece hit if the blocker moves?', 'Where can the blocker go with its own threat (or check)?'],
    trap: 'Moving the blocker to a square where it simply gets taken with check.',
    deeper: 'Discovered check is the strongest version: the moving piece can go anywhere, even take a defended piece, because they must answer the check first.',
  },
  back_rank: {
    what: 'The king is stuck behind its own pawns on the back rank. A rook or queen landing there mates.',
    spot: 'A castled king, three pawns unmoved in front, and the back rank guarded by only one piece.',
    ask: ['Is their back rank guarded? By how many pieces?', 'Can I deflect or trade the last defender?'],
    trap: 'Forgetting your own back rank while attacking theirs. Make luft (h3/h6) when the rooks come out.',
  },
  mate_in_1: { what: 'Checkmate in one move.', spot: 'A king with few free squares.', ask: ['List every check.', 'For each, can the king escape, block or capture?'], trap: 'Giving a check that lets the king walk out.' },
  mate_in_2: { what: 'A forced checkmate in two moves.', spot: 'An exposed king and your pieces close by.', ask: ['Look at checks first, then captures, then quiet moves that threaten mate.', 'After each of their replies, is there a mate?'], trap: 'Stopping your calculation after your first move: check every reply.', deeper: 'Sometimes the key is a quiet move that takes away the last flight square: if no check works, look for that.' },
  mate_in_3: { what: 'A forced checkmate in three moves: a short calculation exercise.', spot: 'Several checks available near their king.', ask: ['Which check leaves the king the fewest squares?', 'Write the sequence in your head before moving.'], trap: 'Playing the first check that looks nice instead of the forcing one.' },
  advantage: {
    what: 'You have a chance to win something decisive. Find the move that keeps it.',
    spot: 'Their pieces are loose or their king is exposed, and your pieces are active.',
    ask: ['Checks, captures, threats: list them all, for both sides.', 'Which move forces matters (they must respond)?', 'What is their best defence to my idea?'],
    trap: 'Playing the natural move instead of the forcing one: chances disappear if you give them a free move.',
  },
  promotion: { what: 'Push a pawn through to make a new queen.', spot: 'A passed pawn close to the last rank and pieces that can clear its path.', ask: ['What stops the pawn? Can I remove, deflect or block that piece?'], trap: 'Promoting into a stalemate or a fork.' },
  positional: { what: 'No tactic: find the move that improves your position the most.', spot: 'Your worst piece, their weakest square, an open file nobody controls.', ask: ['Which of my pieces does least? Where would it be better?', 'What does my opponent want to do, and can I stop it first?'], trap: 'Making a "plan" move that ignores their threat.' },
  opening: { what: 'Find the move that follows opening principles in this position.', spot: 'Undeveloped pieces, an uncastled king, a central square nobody controls.', ask: ['Which piece is not developed yet?', 'Does this move fight for the centre?', 'Am I moving a piece twice without a reason?'], trap: 'Grabbing a pawn and falling behind in development.' },
  eg_pawn: { what: 'King and pawn endings: every tempo counts.', spot: 'Kings racing for key squares in front of the pawns.', ask: ['Who has the opposition?', 'Is my king inside the square of their pawn?'], trap: 'Pushing pawns too early instead of improving the king.' },
  eg_opposition: { what: 'Kings facing each other with one square between: the side NOT to move holds the opposition.', spot: 'Two kings on the same file or rank, pawns close by.', ask: ['If I step forward, can their king face mine?', 'Do I have a spare pawn move to pass the move?'], trap: 'Rushing forward and giving away the opposition.' },
  eg_rook: { what: 'Rook endings: activity is everything.', spot: 'Passed pawns and rooks that are either active or tied down.', ask: ['Is my rook behind the passed pawn?', 'Can my king cut theirs off?'], trap: 'Defending passively with the rook in front of the pawn.' },
  eg_minor: { what: 'Bishop and knight endings.', spot: 'Pawns on both wings favour bishops; blocked positions favour knights.', ask: ['Which colour squares does my bishop control?', 'Where can my king go to support the pawns?'], trap: 'Putting your pawns on the same colour as your bishop.' },
  eg_queen: { what: 'Queen endings: checks everywhere.', spot: 'Exposed kings.', ask: ['Can they give perpetual check? Hide the king first.'], trap: 'Pushing the pawn while your king is exposed to checks.' },
  eg_conversion: { what: 'You are winning: convert it calmly.', spot: 'Extra material.', ask: ['Can I trade pieces?', 'What is their only counterplay? Take it away first.'], trap: 'Rushing and allowing tricks.' },
  eg_draw: { what: 'Defend a worse ending to a draw.', spot: 'Known drawing set-ups (Philidor, wrong bishop, fortress).', ask: ['Which drawing set-up fits?', 'Can I trade into a draw?'], trap: 'Passive defence.' },
  eg_mate: { what: 'Basic checkmates with extra material.', spot: 'A lone king.', ask: ['Am I shrinking its box each move?', 'Does it have a legal move (stalemate check)?'], trap: 'Stalemate.' },
  eg_tactic: { what: 'A tactic in the endgame: promotion tricks, deflections, stalemate traps.', spot: 'Passed pawns and few pieces.', ask: ['Which piece stops my pawn? Can I deflect it?'], trap: 'Missing a stalemate defence.' },
};

/** The coach's intro line before an exercise, tuned to the level. */
export function coachIntro(theme: string, goal: string, level: CoachLevel): string {
  const g = THEME_GUIDE[theme];
  if (!g) return goal === 'hold' ? 'They have a threat. Find it first, then the move that stops it.' : 'Checks, captures and threats first: for you and for them.';
  if (level === 'beginner') return `Ask yourself: ${g.ask[0]}`;
  if (level === 'intermediate') return `Tip: ${g.spot}`;
  return `${g.spot} ${g.deeper ?? g.ask[g.ask.length - 1]}`;
}
