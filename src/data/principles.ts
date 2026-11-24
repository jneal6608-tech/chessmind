// Chess principles as guided lessons. Each lesson walks through real positions
// step by step: the coach explains, the board shows it, and "your move"
// challenges make you apply it. Challenge answers were checked with Stockfish
// (depth 18); the lesson screen also accepts any move the engine rates as
// equally good, and explains anything else.
//
// Positions are given as SAN moves from the start (checked for legality in
// tests/data.test.ts) or as a FEN. A step without a position keeps the last one.

export type PrincipleCategory = 'Thinking' | 'Openings' | 'Pawn structure' | 'Pieces' | 'Strategy' | 'Attack & defence' | 'Endgames';
export type PrincipleLevel = 'club' | 'advanced' | 'expert';

export interface LessonTask {
  prompt: string;
  /** Accepted moves in SAN (the first one is the main answer). */
  answers: string[];
  hint: string;
  success: string;
  /** Said when the student plays a move the engine also dislikes. */
  wrong?: string;
}
export interface LessonStep {
  say: string;
  moves?: string;
  fen?: string;
  /** "e2e4" (green) or "e2e4:red" / ":blue" / ":yellow". */
  arrows?: string[];
  marks?: string[];
  task?: LessonTask;
}
export interface Principle {
  id: string;
  title: string;
  category: PrincipleCategory;
  level: PrincipleLevel;
  /** The rule in one sentence. */
  rule: string;
  steps: LessonStep[];
  takeaways: string[];
  /** Weakness keys (training/themes.ts) this principle fixes. */
  fixes: string[];
  /** Exercise themes to practise afterwards. */
  practise?: string[];
  /** A theory endgame id to play out afterwards. */
  endgame?: string;
}

const RUY_9 = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O';
const GREEK = 'rnbq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQK2R w KQ - 0 7';
const TARRASCH = 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O dxc5 Bxc5';
const CARLSBAD = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nge2 Re8 O-O Nf8';
const NAJDORF = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6';
const DRAGON = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O';
const FRENCH_ADV = 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4';

export const PRINCIPLES: Principle[] = [
  // ───────────────────────── Thinking
  {
    id: 'cct', title: 'Checks, captures, threats, then the blunder check', category: 'Thinking', level: 'club',
    rule: 'Before every move, list the forcing moves for BOTH sides, then picture the board after your move and look at their checks and captures.',
    fixes: ['hanging_pieces', 'no_blunder_check', 'missed_threat', 'ignored_forcing', 'moving_fast'], practise: ['defense', 'capture_hanging'],
    steps: [
      { say: 'Most games below 2000 are decided by a one-move oversight, not by deep strategy. The cure is a routine you run every single move, until it becomes automatic.' },
      { say: 'Step 1: what did their last move change? Here Black just played 3...Nd4, leaving the e5 pawn without its defender. It looks like a free pawn.', moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4', arrows: ['c6d4:yellow'] },
      { say: 'Step 2: list the forcing moves for YOU (Nxe5, Nxd4, Bxf7+) and for THEM if you take (…Qg5 hits two things). Step 3, the blunder check: after Nxe5, what are their checks, captures and double attacks?', arrows: ['f3e5:red', 'd8g5:red'] },
      { say: 'Your move. Run the routine: is the e5 pawn really free?', task: { prompt: 'White to move. Find a safe, strong move.', answers: ['Nxd4', 'O-O', 'Nc3', 'c3'], hint: 'After Nxe5, Black has …Qg5, attacking the knight on e5 and the g2 pawn at the same time. Remove the knight on d4 instead.', success: 'Right. Nxd4 removes the active knight, and after …exd4 you play O-O and c3 with a lead in development. The greedy Nxe5? runs into …Qg5!, a double attack on e5 and g2.', wrong: 'This is exactly the trap: …Qg5 attacks two things at once.' } },
      { say: 'Make it physical: before you touch a piece, look at THEIR checks and captures one more time. It costs five seconds and saves whole games.' },
    ],
    takeaways: ['After every opponent move, ask what changed and what it now attacks.', 'List checks, captures and threats for both sides before choosing.', 'Blunder check: picture the board after your move and look at their forcing replies.'],
  },
  {
    id: 'intermezzo', title: 'Forcing moves first: the fork trick', category: 'Thinking', level: 'advanced',
    rule: 'When a capture looks unsafe, check whether a follow-up forcing move (a fork, a check) wins the material back with interest.',
    fixes: ['missed_tactic', 'poor_calculation', 'ignored_forcing', 'missed_fork'], practise: ['fork', 'advantage'],
    steps: [
      { say: 'Calculation is not seeing far; it is seeing the forcing moves. A capture that loses a piece "on paper" can be fine if the next move is a fork.' },
      { say: 'Black to move. The e4 pawn is defended by the knight on c3, so …Nxe4 seems to lose a knight for a pawn.', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3', arrows: ['f6e4:yellow', 'c3e4:red'] },
      { say: 'Your move as Black. Look one move deeper: after Nxe4, what pawn move attacks two white pieces at once?', task: { prompt: 'Black to move. Find the move that equalises at once.', answers: ['Nxe4'], hint: 'Take on e4. If Nxe4, then …d5! attacks the bishop on c4 and the knight on e4.', success: 'The fork trick: 4…Nxe4! 5.Nxe4 d5 forks bishop and knight, and Black gets the piece back with a free, active centre.' } },
      { say: 'The lesson: when you evaluate a capture, do not stop at "they recapture". Ask what YOUR next forcing move is.' },
    ],
    takeaways: ['Evaluate a capture at the end of the forcing sequence, not after the first recapture.', 'Pawn forks in the centre (…d5, d4) are the most common follow-up.'],
  },
  {
    id: 'prophylaxis', title: 'Prophylaxis: what does my opponent want?', category: 'Thinking', level: 'advanced',
    rule: 'Before your own plan, ask what your opponent would do if it were their move, and take it away if it is annoying and cheap to stop.',
    fixes: ['missed_threat', 'missed_mating_threat', 'passive_play', 'piece_placement'], practise: ['defense', 'positional'],
    steps: [
      { say: 'Strong players spend half their thinking on the OPPONENT\'s plan. This is called prophylaxis: preventing their best idea before it happens.' },
      { say: 'The Ruy Lopez main line. White wants d4. What would Black love to play if White pushes d4 now?', moves: RUY_9, arrows: ['c8g4:red', 'g4f3:red'] },
      { say: 'Black would answer d4 with …Bg4, pinning the f3 knight to the queen so that d4 gets weak. Your move: one quiet pawn move removes that idea forever.', task: { prompt: 'White to move. Stop Black\'s best idea first.', answers: ['h3', 'd4', 'd3', 'a4'], hint: 'Take the g4 square away from the bishop.', success: '9.h3 is the main line for 150 years for exactly this reason: no …Bg4 pin, so d4 can follow with full support.' } },
      { say: 'Prophylaxis is cheap when it also improves your position (h3 gives your king an escape square too). Avoid "prophylaxis" that wastes several moves.' },
    ],
    takeaways: ['Ask "what would they play if I passed?" every move.', 'A cheap move that kills their best plan is often the strongest move on the board.', 'Prefer prophylaxis that also improves your own position.'],
  },
  // ───────────────────────── Openings
  {
    id: 'opening-tempo', title: 'Development, centre, king: and why time matters', category: 'Openings', level: 'club',
    rule: 'Every opening move should develop a piece, fight for the centre or get your king safe; a move that does none of these must win something concrete.',
    fixes: ['opening_development', 'early_queen', 'center_control', 'opening_unfamiliar'], practise: ['opening'],
    steps: [
      { say: 'In the opening, time (tempo) is the currency. Each move should bring a new piece, fight for e4/d4/e5/d5 or prepare castling.' },
      { say: 'White brought the queen out early to h5 and the bishop to c4: Qxf7 is checkmate if you do nothing.', moves: 'e4 e5 Qh5 Nc6 Bc4', arrows: ['h5f7:red', 'c4f7:red'] },
      { say: 'Your move as Black. Defend f7 in a way that ALSO gains time against the early queen.', task: { prompt: 'Black to move. Stop the mate and punish the early queen.', answers: ['g6', 'Qe7', 'Qf6'], hint: 'A pawn move can block the queen\'s line and threaten to chase it with …Nf6.', success: '3…g6! blocks the queen, and next …Nf6 attacks her again: you develop with tempo while White moves the queen a third time.', wrong: 'Careful: anything that ignores f7 loses to Qxf7#, and …Nf6?? walks straight into it.' } },
      { say: 'The principle behind it: an early queen becomes a target, and every move she spends running away is a free developing move for you.' },
    ],
    takeaways: ['Knights and bishops before the queen; castle early.', 'Do not move the same piece twice without a reason.', 'Punish early queen moves by developing with threats.'],
  },
  {
    id: 'structure-plans', title: 'Openings are pawn structures: know the plan', category: 'Openings', level: 'advanced',
    rule: 'Memorise the pawn structure an opening leads to and its standard plan, not 20 moves of theory.',
    fixes: ['opening_unfamiliar', 'passive_play'], practise: ['opening', 'positional'],
    steps: [
      { say: 'When you leave theory, the pawns tell you the plan. Every opening produces a typical structure, and each structure has a known plan.' },
      { say: 'French Advance: White\'s pawn chain d4–e5 points at the kingside, so White attacks there. Black\'s chain d5–e6 points at the queenside.', moves: FRENCH_ADV, marks: ['d4', 'e5', 'd5', 'e6'] },
      { say: 'Rule: attack a pawn chain at its BASE. Black hits d4 (with …c5, pieces on c6/b6), White later hits d5/e6 with f4–f5. Here Black played …c4 to grab queenside space instead: the plan is …b5–b4.', arrows: ['b7b5', 'b5b4'] },
      { say: "Apply it as Black in the French Advance. White's chain is d4-e5, and its base, d4, is your target.", moves: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3",
        task: { prompt: "Black to move. Add pressure to the base of the chain.", answers: ["Qb6", "Bd7", "Nge7"], hint: "Which piece can join the c5 pawn and the c6 knight against d4, and hit b2 as well?", success: "Qb6! c5, Nc6 and Qb6 all aim at d4 (and b2). Next comes ...Nge7-f5 as a fourth attacker. Bd7 and Nge7 are fine too: they prepare the same pressure." } },
    ],
    takeaways: ['Pawn chains point to where you attack.', 'Attack a chain at its base.', 'Learn one model game for each structure you get from your openings.'],
  },
  // ───────────────────────── Pawn structure
  {
    id: 'chain-base', title: 'Attack the pawn chain at its base', category: 'Pawn structure', level: 'club',
    rule: 'A pawn chain is only as strong as its last pawn: hit the base and the whole chain wobbles.',
    fixes: ['pawn_structure', 'passive_play'], practise: ['positional'],
    steps: [
      { say: 'In a chain (d4–e5), the front pawn is protected by the one behind. The base, d4, has no pawn protecting it. That is where you strike.', moves: 'e4 e6 d4 d5 e5', marks: ['d4'] },
      { say: 'Your move as Black. Hit the base.', task: { prompt: 'Black to move. Challenge White\'s centre.', answers: ['c5'], hint: 'Which pawn move attacks d4?', success: '3…c5! is the main line of the French Advance: the whole plan is pressure on d4 with …Nc6, …Qb6 and …Nge7-f5.' } },
    ],
    takeaways: ['Front of the chain = space; base = weakness.', 'Pile up on the base with pawns and pieces.'],
  },
  {
    id: 'iqp', title: 'The isolated queen\'s pawn (IQP)', category: 'Pawn structure', level: 'advanced',
    rule: 'With an IQP, play actively for the attack and the d5 (or d4) break; against it, blockade the square in front, trade pieces and win the pawn in the endgame.',
    fixes: ['pawn_structure', 'bad_exchange', 'piece_placement'], practise: ['positional'],
    steps: [
      { say: 'An isolated pawn has no pawn neighbours, so only pieces can defend it. It gives space and open lines (good in the middlegame) but it is a target (bad in the endgame).' },
      { say: 'Tarrasch Defence: Black has an IQP on d5. It controls e4 and c4, and Black\'s pieces are active.', moves: TARRASCH, marks: ['d5'] },
      { say: 'White\'s plan: put pressure on d5 (Bg5 removes a defender, Rd1, Nd4) and blockade it. The square in front of an IQP is the perfect home for a knight because no pawn can chase it.', arrows: ['c1g5', 'f3d4'], marks: ['d4'] },
      { say: 'Black\'s plan: keep pieces on, play …d4 when it opens lines, or attack the kingside. Every trade helps the side playing against the IQP.' },
      { say: "Your turn with White against the isolated pawn on d5.", moves: TARRASCH,
        task: { prompt: "White to move. Start the pressure on d5.", answers: ["Bg5", "Na4", "a3", "b3"], hint: "Which black piece defends d5? Attack or pin it.", success: "Bg5 hits the f6 knight, the main defender of d5. The plan: pressure d5, blockade d4 with a knight, trade pieces. Na4 (hitting c5) and a3 are equally good ways to start." } },
    ],
    takeaways: ['IQP side: avoid trades, attack, look for the pawn break.', 'Against the IQP: blockade the square in front, trade pieces, attack the pawn in the endgame.'],
  },
  {
    id: 'minority', title: 'The minority attack (Carlsbad structure)', category: 'Pawn structure', level: 'advanced',
    rule: 'Two pawns can attack three: push b4–b5 against …a7-b7-c6 to leave the opponent with a weak pawn on c6 or d5.',
    fixes: ['pawn_structure', 'passive_play'], practise: ['positional'],
    steps: [
      { say: 'The Carlsbad structure comes from the Queen\'s Gambit Exchange: White has pawns a2, b2 and d4 against Black\'s a7, b7, c6, d5.', moves: CARLSBAD },
      { say: 'White plays Rab1, b4 and b5. When White takes on c6 (or Black takes on b5), Black is left with a backward c-pawn or an isolated d-pawn.', arrows: ['b2b4', 'b4b5', 'b5c6'] },
      { say: 'Black\'s counter: the kingside. The knight route …Nf8-g6 or …Ne6, and …Ne4 with pressure on the white king. Knowing both plans is the whole game.', arrows: ['f8g6:blue', 'f6e4:blue'] },
      { say: "Now play the plan as White.", moves: CARLSBAD,
        task: { prompt: "White to move. Prepare the minority attack.", answers: ["Rab1", "Rad1", "Rae1", "a4"], hint: "The b-pawn wants to go b4-b5. Put a rook behind it first.", success: "Rab1, then b4-b5: the rook supports the pawn march and later presses the b-file. Rad1/Rae1 (central rooks first) are equally good preparation." } },
    ],
    takeaways: ['Minority attack = create a weakness on the opponent\'s side by trading pawns.', 'The defending side counterattacks on the other wing.'],
  },
  {
    id: 'holes', title: 'Weak squares and pawn moves you can\'t take back', category: 'Pawn structure', level: 'club',
    rule: 'Pawns can\'t move backwards: every pawn push gives up control of squares for good, so push pawns only for a concrete reason.',
    fixes: ['pawn_structure', 'king_safety'], practise: ['positional', 'mating_threat'],
    steps: [
      { say: 'A "hole" is a square no pawn of yours can ever cover again. Enemy pieces love holes, especially knights.' },
      { say: 'Najdorf: Black played …e5, which leaves d5 as a permanent hole (no black pawn can ever attack it again). In return Black gets space and activity.', moves: NAJDORF, marks: ['d5'] },
      { say: 'Black\'s last move …Be6 exists only to control d5. White will try Nd5 / Bd5 forever; Black will try …d5 to get rid of the hole. Whole games revolve around one square.', arrows: ['c3d5', 'e6d5:blue'] },
      { say: "Your move as White: use Black's hole.", moves: NAJDORF,
        task: { prompt: "White to move. Use the hole on d5.", answers: ["Nd5", "Qd2", "Qd3", "Bf3"], hint: "Which square can no black pawn ever attack again?", success: "Nd5 lands in the hole: if ...Nxd5 exd5, the e6 bishop is hit and White gets c4 and the c-file. Qd2, Qd3 and Bf3 prepare the same idea by adding control of d5 first." } },
    ],
    takeaways: ['Before a pawn push, name the squares it gives up.', 'A hole near the centre or your king is a long-term weakness.', 'The side with the hole fights for it with pieces or a pawn break.'],
  },
  // ───────────────────────── Pieces
  {
    id: 'outposts', title: 'Outposts: squares pawns can\'t reach', category: 'Pieces', level: 'club',
    rule: 'Put knights on squares in the enemy half that are protected by your pawn and can never be attacked by an enemy pawn.',
    fixes: ['piece_placement', 'passive_play'], practise: ['positional'],
    steps: [
      { say: 'A knight on an outpost is often worth more than a rook: it cannot be chased away, it controls key squares, and it blocks enemy pawns.' },
      { say: 'In this Najdorf structure d5 is White\'s dream square: no black pawn can ever attack it.', moves: NAJDORF, marks: ['d5'], arrows: ['c3d5'] },
      { say: 'If Black ever trades the e6 bishop, a white knight on d5 dominates the board. That is why Black keeps the light-squared bishop and plays …Nbd7 and …Rc8: to fight for d5 with pieces.' },
      { say: "Sveshnikov: Black played ...e5, so d5 can never be attacked by a black pawn again.", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6",
        task: { prompt: "White to move. Occupy the outpost.", answers: ["Nd5"], hint: "Which square is supported for you and unreachable for their pawns?", success: "Nd5! The knight sits on the outpost created by ...e5. Stockfish rates every other move clearly worse." } },
    ],
    takeaways: ['Outpost = enemy half + supported by your pawn + no enemy pawn can attack it.', 'Knights belong on outposts; bishops on long open diagonals.', 'Trade the opponent\'s pieces that can fight for your outpost.'],
  },
  {
    id: 'bad-bishop', title: 'Good bishop, bad bishop', category: 'Pieces', level: 'advanced',
    rule: 'A bishop is "bad" when your own pawns are fixed on its colour; trade it, reroute it outside the chain, or put your pawns on the other colour.',
    fixes: ['piece_placement', 'bad_exchange', 'minor_endgames'], practise: ['positional', 'eg_minor'],
    steps: [
      { say: 'In the French, Black\'s pawns sit on light squares (d5, e6), so the c8 bishop is locked behind them: the classic bad bishop.', moves: FRENCH_ADV, marks: ['c8', 'd5', 'e6'] },
      { say: 'Black\'s solutions: trade it (…b6 and …Ba6 to swap with White\'s good bishop), or bring it outside the chain before playing …e6 (that is why Caro-Kann players develop …Bf5 first).', arrows: ['c8a6:blue'] },
      { say: 'In endgames this decides games: a bad bishop defends pawns but can never attack the enemy pawns on the other colour.' },
      { say: "Caro-Kann Advance: Black's pawns will stand on light squares (c6, d5, e6). Solve the light-squared bishop BEFORE playing ...e6.", moves: "e4 c6 d4 d5 e5",
        task: { prompt: "Black to move. Don't lock your bishop in.", answers: ["Bf5", "c5"], hint: "Get the c8 bishop outside the pawn chain.", success: "Bf5! The bishop gets outside the chain first; after ...e6 it is an active piece instead of a bad one. That is the whole idea of the Caro-Kann." } },
    ],
    takeaways: ['Count your pawns on your bishop\'s colour.', 'Put pawns on the opposite colour of your remaining bishop.', 'Trade your bad bishop, keep your good one.'],
  },
  {
    id: 'rooks', title: 'Rooks: open files and the 7th rank', category: 'Pieces', level: 'club',
    rule: 'Rooks need open files; once a file is open, use it to reach the 7th rank, where a rook attacks pawns from the side and cuts off the king.',
    fixes: ['piece_placement', 'rook_endgames', 'passive_play'], practise: ['eg_rook', 'positional'],
    steps: [
      { say: 'A rook behind its own pawns is a spectator. Find the open (no pawns) or half-open (no pawns of yours) file, put a rook there, and then go deeper.' },
      { say: 'White owns the open d-file. The 7th rank is the target: from d7 the rook hits b7, a7 and f7 at once. Note White has played h3 earlier, so the back rank is safe.', fen: '2r3k1/pp3ppp/8/8/8/7P/PP3PP1/3R2K1 w - - 0 1', arrows: ['d1d7'] },
      { say: 'Your move.', task: { prompt: 'White to move. Activate the rook.', answers: ['Rd7'], hint: 'Use the open d-file to reach the 7th rank.', success: 'Rd7: the rook attacks b7 and keeps the black king on the back rank. If …Rc2, Rxb7 Rxb2 Rxa7 and White wins a pawn.' } },
    ],
    takeaways: ['Rooks on open files, then the 7th rank.', 'Make luft (h3/h6) before your rooks leave the back rank.', 'Two rooks on the 7th usually win.'],
  },
  {
    id: 'worst-piece', title: 'Improve your worst piece', category: 'Pieces', level: 'club',
    rule: 'When there are no tactics and no clear plan, find your least active piece and bring it to a better square.',
    fixes: ['passive_play', 'piece_placement', 'missed_advantage'], practise: ['positional'],
    steps: [
      { say: 'Positions without tactics feel empty. That is when weaker players make random moves. Strong players ask one question: which of my pieces does the least?' },
      { say: 'Count the squares each piece controls. A knight on the rim (a3/h3), a bishop blocked by its own pawns, a rook behind pawns: those are candidates.' },
      { say: 'In the Carlsbad structure Black\'s knight travels d7–f8–g6 or e6: two moves to go from passive to a great square. Slow manoeuvres like that are normal.', moves: CARLSBAD, arrows: ['f8g6', 'f8e6:blue'] },
      { say: "Your move as Black in the Carlsbad. Which piece does the least?", moves: "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nge2 Re8 O-O",
        task: { prompt: "Black to move. Improve your worst piece.", answers: ["Nf8", "a5", "h6", "g6"], hint: "The d7 knight blocks the c8 bishop and has no future. Reroute it via f8.", success: "Nf8! The knight heads for g6 or e6, the c8 bishop is no longer blocked, and the knight guards h7. One quiet move improves two pieces." } },
    ],
    takeaways: ['No tactic? Improve your worst piece.', 'A piece is only as good as the squares it controls.', 'Manoeuvres of 2-3 moves are fine when the opponent can\'t punish them.'],
  },
  // ───────────────────────── Strategy
  {
    id: 'two-weaknesses', title: 'The principle of two weaknesses', category: 'Strategy', level: 'expert',
    rule: 'One weakness can usually be defended; create a second one on the other side of the board, then switch between them until the defence breaks.',
    fixes: ['conversion', 'missed_advantage', 'passive_play'], practise: ['eg_conversion', 'advantage'],
    steps: [
      { say: 'A good defender can hold one weak pawn by putting pieces around it. But pieces defending one wing can\'t reach the other in time.' },
      { say: 'So when you have a small advantage: fix one weakness, tie their pieces to it, then open a second front (a pawn break, a king march, a passed pawn) on the other side.' },
      { say: 'This is how the minority attack ends: c6 becomes weak on the queenside, and later White plays e4 or f3–e4 to create a second target in the centre.', moves: CARLSBAD, arrows: ['b2b4', 'f2f3:blue', 'e3e4:blue'] },
      { say: "Pawn ending: Black's king guards the kingside. Create a second front it can't reach.", fen: "8/5pk1/6p1/7p/1P5P/6P1/5PK1/8 w - - 0 1",
        task: { prompt: "White to move and win.", answers: ["b5"], hint: "Your b-pawn is the second weakness for Black: it drags the king away.", success: "b5! The passed pawn runs; when the black king chases it, White's king eats the kingside pawns. Two weaknesses, one defender." } },
    ],
    takeaways: ['One weakness = defended. Two weaknesses = lost.', 'Do not hurry: improve everything before the decisive switch.'],
  },
  {
    id: 'trading', title: 'When to trade pieces', category: 'Strategy', level: 'advanced',
    rule: 'Trade when you are ahead in material, when you are cramped, or when it removes their best piece; avoid trades when you attack or they have the weakness.',
    fixes: ['bad_exchange', 'conversion', 'missed_advantage'], practise: ['winning_capture', 'eg_conversion'],
    steps: [
      { say: 'Every trade changes the position. Ask: who is happier with fewer pieces?' },
      { say: 'Ahead in material: trade PIECES, not pawns. An extra pawn in a queen middlegame is a detail; in a king-and-pawn ending it is the whole game.' },
      { say: 'Cramped (less space): trade, because your pieces get in each other\'s way. Attacking: keep pieces, because every attacker counts. Facing an IQP: trade, because the pawn gets weaker as pieces leave.' },
      { say: 'Here White can trade the bishop for the c6 knight. It doubles Black\'s pawns, but gives Black the bishop pair. The Exchange Ruy Lopez is built on that trade: White aims for an endgame where the kingside majority is healthy.', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4' },
      { say: "You are a pawn up in a rook ending. Rook endings are drawish; pawn endings are not.", fen: "8/4k3/3r4/8/3R1K2/5P2/8/8 w - - 0 1",
        task: { prompt: "White to move. Use the trade.", answers: ["Rxd6"], hint: "If the rooks come off, does your king win the pawn ending?", success: "Rxd6! Kxd6 and the pawn ending is winning (Stockfish about +5.8); keep the rooks and it is a draw. Trade pieces when ahead, especially into a pawn ending you have checked." } },
    ],
    takeaways: ['Ahead: trade pieces, keep pawns.', 'Cramped: trade. Attacking: don\'t.', 'Trade their best piece, keep your best piece.'],
  },
  {
    id: 'center-counter', title: 'Opposite castling: the race and the counter in the centre', category: 'Strategy', level: 'advanced',
    rule: 'With kings on opposite wings, throw pawns at the enemy king and count tempi; against a wing attack, the best defence is a counterattack in the centre or on your own wing.',
    fixes: ['king_safety', 'missed_mating_threat', 'poor_calculation'], practise: ['mating_threat', 'defense'],
    steps: [
      { say: 'When kings castle on opposite sides, pawn storms are safe (your own king isn\'t behind those pawns). The game becomes a race: whoever opens lines first usually wins.' },
      { say: 'The Yugoslav Attack against the Dragon. White will play h4–h5, Bh6 to trade the Dragon bishop, and mate on h7. Black must be faster on the queenside.', moves: DRAGON, arrows: ['h2h4', 'h4h5', 'e3h6'] },
      { say: 'Your move as Black. Join the race: put a rook on the half-open file aiming at the white king.', task: { prompt: 'Black to move. Start the counterattack.', answers: ['Rc8', 'Rb8'], hint: 'Which file is half-open toward c1?', success: '…Rc8: the rook on the c-file, followed by …Ne5–c4 and …Rxc3 sacrifices, is Black\'s counter. Every tempo counts: defensive moves usually lose the race.' } },
    ],
    takeaways: ['Opposite castling = race: count the moves until lines open.', 'Pawn storm toward the enemy king; pieces follow on the open files.', 'Meet a wing attack with a counter in the centre.'],
  },
  // ───────────────────────── Attack & defence
  {
    id: 'greek-gift', title: 'The Greek gift: Bxh7+', category: 'Attack & defence', level: 'advanced',
    rule: 'Bxh7+ works when you have a bishop on d3, a knight that can reach g5, the queen reaching h5, and Black has no knight on f6 and no easy way to cover h7 and g5.',
    fixes: ['missed_mate', 'missed_tactic', 'missed_mating_threat', 'king_safety'], practise: ['mate_in_3', 'advantage'],
    steps: [
      { say: 'The Greek gift is the most famous sacrifice in chess. It isn\'t magic: it works only when a checklist is ticked.' },
      { say: 'The checklist: (1) bishop on d3 hits h7; (2) knight on f3 can jump to g5 with check; (3) queen gets to h5; (4) Black\'s f6 knight is gone (here pushed away by e5); (5) Black can\'t easily take on g5 or run.', fen: GREEK, arrows: ['d3h7:red', 'f3g5', 'd1h5'] },
      { say: 'Your move: all five boxes are ticked.', task: { prompt: 'White to move and attack.', answers: ['Bxh7+'], hint: 'Sacrifice the bishop on h7 with check, then Ng5+ and Qh5.', success: 'Bxh7+! Kxh7 Ng5+ and Qh5 arrive with mate threats on h7. Stockfish rates it about +5.8, more than double any quiet move.' } },
      { say: 'Defending against it: keep a knight on f6, or have …h6 / …Be7 covering g5 ready. When you see the setup coming, spend one move to cut a box from the checklist.' },
    ],
    takeaways: ['Check the five conditions before sacrificing.', 'Defence: a knight on f6 is the best guard of h7.'],
  },
  {
    id: 'defence', title: 'Defending well: counterattack, trade attackers, give back material', category: 'Attack & defence', level: 'advanced',
    rule: 'Defend actively: counterattack when you can, trade off the most dangerous attacker, and give back material if it kills the attack.',
    fixes: ['missed_threat', 'missed_mating_threat', 'king_safety', 'holding_draws'], practise: ['defense', 'mating_threat'],
    steps: [
      { say: 'Passive defence (moving pieces back) usually loses slowly. Good defenders look for a counter-threat first, because it gains time.' },
      { say: 'Ranking of defensive ideas: (1) a bigger counter-threat or check; (2) trade the attacker; (3) move the target to a better square; (4) defend it; (5) block. Try them in that order.' },
      { say: 'Giving material back is a weapon: returning a pawn to trade queens or to open a line for your rook often turns a losing defence into an equal game.' },
      { say: "Black to move. White threatens Nxb6 and your knight is loose. Rank the defences: capture or counter-threat first.", fen: "8/1p2k2p/1np3p1/p3P3/2N2r2/P1N4P/B1K3R1/8 b - - 1 37",
        task: { prompt: "Black to move. Find the only move that holds.", answers: ["Nxc4"], hint: "Can you take the attacker instead of running?", success: "Nxc4! Capture the attacker: after Bxc4 Rxc4 material is level and the threat is gone. Stockfish rates every other move as losing." } },
    ],
    takeaways: ['Counter-threat first, passive guard last.', 'Trade the strongest attacker.', 'Return material to kill an attack.'],
  },
  // ───────────────────────── Endgames
  {
    id: 'king-active', title: 'In the endgame the king is a fighting piece', category: 'Endgames', level: 'club',
    rule: 'Once queens are gone, march the king to the centre; in pawn endings, put the king IN FRONT of your pawn.',
    fixes: ['king_activity', 'promotion_technique', 'opposition'], practise: ['eg_pawn', 'eg_opposition'], endgame: 'kp-opposition-win',
    steps: [
      { say: 'In the middlegame the king hides. In the endgame there are no mating threats left, so the king is worth about a rook in activity.' },
      { say: 'King and pawn against king. The pawn is far back, which is good: it gives you spare moves. Where should the white king go?', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1' },
      { say: 'Your move.', task: { prompt: 'White to move and win.', answers: ['Ke4', 'Kd4', 'Kf4'], hint: 'King in front of the pawn, not behind it.', success: 'The king goes in front of the pawn (Kd4, Ke4 or Kf4 all win). The king clears the way; the pawn follows. Playing Kd2 or pushing the pawn first lets Black draw.' , wrong: 'Pushing the pawn or keeping the king behind it lets the black king block in front: that is a draw.' } },
    ],
    takeaways: ['Centralise the king as soon as the queens are off.', 'King in front of the pawn; the pawn far back gives spare tempi.'],
  },
  {
    id: 'rook-behind', title: 'Rooks behind passed pawns (Tarrasch\'s rule)', category: 'Endgames', level: 'advanced',
    rule: 'Rooks belong behind passed pawns, yours or theirs: behind your own pawn the rook gains power as the pawn advances; behind theirs it stops it without being tied down.',
    fixes: ['rook_endgames', 'holding_draws', 'conversion'], practise: ['eg_rook'], endgame: 'rook-behind',
    steps: [
      { say: 'Rook endings are the most common endings. One rule covers most of them: rook behind the passed pawn.' },
      { say: 'Behind your own pawn, the rook\'s file gets longer with every push. In front of it, the rook gets boxed in and the pawn can\'t move.' },
      { say: 'Practise it now in the theory section: the "rook behind the passed pawn" position, played out against Stockfish.' },
      { say: "Your passed a-pawn is ready to run. Where does your rook belong?", fen: "5r2/8/6k1/P7/8/2K5/8/7R w - - 0 1",
        task: { prompt: "White to move. Place the rook.", answers: ["Ra1", "Rg1+"], hint: "Behind the passed pawn.", success: "Ra1: rook behind the passed pawn. Every pawn push now makes your rook stronger, and Black's rook has to stay in front of the pawn." } },
    ],
    takeaways: ['Rook behind the passer.', 'An active rook is worth a pawn.', 'Learn Lucena (to win) and Philidor (to draw).'],
  },
  {
    id: 'dont-hurry', title: 'Do not hurry: converting a winning position', category: 'Endgames', level: 'expert',
    rule: 'When you are winning, first take away all counterplay and improve every piece; only then make the decisive move.',
    fixes: ['conversion', 'missed_advantage', 'moving_fast'], practise: ['eg_conversion'],
    steps: [
      { say: 'Most thrown wins come from rushing: pushing a pawn too early, grabbing material that lets the opponent\'s pieces in, or allowing a perpetual.' },
      { say: 'The method: (1) secure your king and loose pieces; (2) stop their only active idea; (3) improve every piece, then (4) break through. The opponent can\'t do anything meanwhile, so there is no need to rush.' },
      { say: 'Ask before each move: "what is their only chance?" (a check, a passed pawn, a trick on the back rank), and take that away first.' },
      { say: "You're a pawn up. Before pushing, ask what their only counterplay is: the rook coming to e1 or e2.", fen: "4r1k1/pp3ppp/8/8/2P5/8/PP3PPP/3R2K1 w - - 0 1",
        task: { prompt: "White to move. Take away their counterplay first.", answers: ["Kf1", "g3", "h3"], hint: "Your king can guard e1 and e2 and walk toward the centre at the same time.", success: "Kf1! The king covers e1 and e2, removes the back-rank danger and heads for the centre. Only then do you push the extra pawn." } },
    ],
    takeaways: ['Winning? Kill counterplay first.', 'Improve all pieces before the breakthrough.', 'Trade pieces, not pawns.'],
  },
  // ───────────────────────── Deeper: the 1800-2000 toolkit
  {
    id: 'calculation', title: 'How to calculate: candidates, then one line at a time', category: 'Thinking', level: 'advanced',
    rule: 'List 2-4 candidate moves first, calculate each one separately to a quiet position, and evaluate the END position, not the line.',
    fixes: ['poor_calculation', 'missed_tactic', 'unsound_sacrifice', 'missed_mate'], practise: ['mate_in_2', 'mate_in_3', 'advantage'],
    steps: [
      { say: 'Most players calculate badly not because they can\'t see far, but because they jump between ideas. Method beats talent.' },
      { say: 'Step 1: candidates. Write down (in your head) every forcing move: checks, captures, threats. Add one or two "natural" moves. Stop at four.' },
      { say: 'Step 2: one line at a time. For each candidate, find their BEST reply (not the one you hope for), then your best answer, until the position is quiet: no more captures or checks.' },
      { say: 'Step 3: evaluate the end. Count material, check king safety and look for loose pieces. Compare the end positions of your candidates, then play the best one. If two are close, choose the simpler.' },
      { say: 'Back-rank check: White to move. One candidate is forcing and ends the game. Calculate it to the end before you play.', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        task: { prompt: 'White to move. Find the forcing win.', answers: ['Rd8#'], hint: 'Checks first. Which check leaves the king no squares?', success: 'Rd8# : the king is boxed in by its own pawns. Checks first, every time.' } },
      { say: 'Practise: in every puzzle, say the whole line before you touch a piece. If you change your mind mid-line, start the line again from the top.' },
    ],
    takeaways: ['Candidates first (max 4), forcing moves on top.', 'Assume their best reply.', 'Evaluate the final quiet position, not how exciting the line looks.'],
  },
  {
    id: 'practical', title: 'Practical play: time, nerves and decisions', category: 'Thinking', level: 'advanced',
    rule: 'Spend your time at the critical moments (tension, transitions, the opponent\'s new idea), play routine moves fast, and never let the clock decide.',
    fixes: ['moving_fast', 'poor_calculation', 'no_blunder_check'], practise: ['defense'],
    steps: [
      { say: 'Critical moments: a capture or check is possible; the opponent made a move you didn\'t expect; the position is about to change type (trade of queens, opening of a file, pawn break). Think hard there.' },
      { say: 'Routine moments: recaptures, forced replies, a plan you already decided on. Move faster there to bank time.' },
      { say: 'Budget: roughly 40% of your time for the first 20 moves after the opening. If you are below 1 minute per 10 moves, simplify the position instead of entering complications.' },
      { say: 'Nerves: after a blunder, the next move is the most dangerous. Sit on your hands, reset, and evaluate the position fresh: it is often still playable.' },
      { say: "Critical moment: captures are possible and both sides have threats. This is where you spend your time.", fen: "5k2/5p1p/3p4/1N6/P7/6rP/1Pr2Pb1/R5K1 w - - 0 30",
        task: { prompt: "White to move. Find the only move that holds.", answers: ["fxg3"], hint: "Count every capture. Which one removes the most dangerous attacker?", success: "fxg3! The only move: Stockfish rates everything else at about -4.5. A quick \"natural\" move here loses; this is exactly where the clock should be spent." } },
    ],
    takeaways: ['Think at critical moments, move fast in routine ones.', 'Low on time? Simplify.', 'After a mistake, take a breath before the next move.'],
  },
  {
    id: 'space', title: 'Space: restrict first, then break', category: 'Strategy', level: 'advanced',
    rule: 'With more space, avoid trades and restrict the opponent\'s pawn breaks; with less space, trade pieces and play for the freeing break.',
    fixes: ['passive_play', 'center_control', 'bad_exchange'], practise: ['positional'],
    steps: [
      { say: 'Space = squares your pawns control in the enemy half. More space means your pieces can move freely behind the pawns, while theirs get in each other\'s way.' },
      { say: 'The Maroczy Bind: White\'s pawns on c4 and e4 clamp d5. Black\'s freeing breaks (…d5, …b5) are hard to achieve.', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Nf6 Nc3 d6 Be2 Nxd4 Qxd4 Bg7', marks: ['d5'] },
      { say: 'White\'s rules: keep the clamp, avoid trades (Black needs them), and push on the side where the space is (b4-c5 or f4). Black\'s rules: trade minor pieces, prepare …b5 or …f5, and be patient.', arrows: ['b2b4', 'c4c5'] },
      { say: "You have the Maroczy Bind. Your move.", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Nf6 Nc3 d6 Be2 Nxd4 Qxd4 Bg7",
        task: { prompt: "White to move. Keep the bind and develop.", answers: ["Be3", "Bd2", "Bg5", "O-O"], hint: "Develop the last minor piece and keep everything protected.", success: "Be3: develop, keep the clamp on d5, avoid trades. The side with space does not need to hurry: the cramped side has the problem." } },
    ],
    takeaways: ['More space: avoid trades, stop their breaks.', 'Less space: trade, prepare the freeing break.', 'Find the pawn break before you need it.'],
  },
  {
    id: 'pawn-breaks', title: 'Know your pawn break', category: 'Pawn structure', level: 'advanced',
    rule: 'In every structure there are only one or two pawn breaks that change the position; prepare yours with pieces and stop theirs.',
    fixes: ['passive_play', 'pawn_structure', 'missed_advantage'], practise: ['positional'],
    steps: [
      { say: 'A pawn break is a pawn move that attacks an enemy pawn and opens lines. It is how plans actually happen.' },
      { say: 'French Advance: Black\'s breaks are …c5 (done) and …f6 (hitting e5). White\'s breaks are f4–f5 and b4 against …c4.', moves: FRENCH_ADV, arrows: ['f7f6:blue', 'b2b4', 'f2f4'] },
      { say: 'Preparing a break: put pieces behind it (rook on its file, knight supporting the square in front), then push when it gains something. Breaks played too early simply lose a pawn.' },
      { say: "King's Indian, closed centre. White's break is c4-c5 on the queenside; Black's is ...f5 on the kingside.", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7",
        task: { prompt: "White to move. Prepare your break.", answers: ["b4", "Ne1", "Bd2", "a3"], hint: "Support c5 with another pawn.", success: "b4! (the Bayonet Attack) prepares c5, which opens the c-file and hits d6. Ne1 is the other main plan (preparing f3 and c5). It is a race against ...f5." } },
    ],
    takeaways: ['Name the breaks for both sides in every structure.', 'Prepare breaks with pieces; push at the right moment.', 'Stop their break if it is their only plan.'],
  },
  {
    id: 'exchange-sac', title: 'The exchange sacrifice', category: 'Attack & defence', level: 'expert',
    rule: 'A rook for a minor piece is worth it when it wrecks the enemy king, removes their key piece, or wins a lasting positional bind.',
    fixes: ['missed_tactic', 'unsound_sacrifice', 'king_safety'], practise: ['advantage'],
    steps: [
      { say: 'Material counts are guides, not laws. A rook does nothing on a closed file; a knight on an outpost or a bishop hitting the king can be worth more.' },
      { say: 'The Dragon\'s signature: …Rxc3. After bxc3, White\'s king on c1 is exposed and the g7 bishop rakes the long diagonal toward a1.', moves: DRAGON + ' Rc8 Bb3 Ne5', arrows: ['c8c3:red', 'g7a1:blue'] },
      { say: 'Ask three questions before an exchange sacrifice: (1) what does the rook do now? (2) what does their minor piece do? (3) what changes for the kings? If the answers favour you, material is secondary.' },
      { say: "Dragon, Soltis Variation: White is going for your king and you just took on e4. Your rook on c4 eyes the c3 knight.", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 h4 Nc4 Bxc4 Rxc4 h5 Nxh5 g4 Nf6 Bh6 Nxe4 Qe3",
        task: { prompt: "Black to move. Find the exchange sacrifice.", answers: ["Rxc3"], hint: "Give the rook for the c3 knight. What happens to the white king?", success: "Rxc3! After bxc3 the white king is exposed and your pieces flood in. Stockfish rates Rxc3 as level, and every other move is clearly worse." } },
    ],
    takeaways: ['Rooks need open files; minor pieces need squares.', '…Rxc3 to wreck the castled king is a standard pattern.', 'Think long-term: the bind lasts, the material deficit is small.'],
  },
  {
    id: 'opposite-bishops', title: 'Opposite-coloured bishops: attack in the middlegame, draw in the endgame', category: 'Strategy', level: 'advanced',
    rule: 'With opposite-coloured bishops, the attacker is effectively a piece up (the defender\'s bishop can\'t guard the attacked squares); in the endgame they are very drawish.',
    fixes: ['conversion', 'holding_draws', 'minor_endgames', 'king_safety'], practise: ['eg_minor'],
    steps: [
      { say: 'Each bishop controls squares the other can never touch. In an attack, your bishop hits squares the defender\'s bishop can\'t defend.' },
      { say: 'Middlegame: if you have the attack, keep queens and rooks on; aim at the colour of your bishop around their king.' },
      { say: 'Endgame: even two pawns up is often a draw. Defender\'s method: put pawns and the king on the colour your bishop controls, blockading the passed pawns. Attacker: create passed pawns far apart (two weaknesses again).' },
      { say: "Two pawns down, but the bishops are on opposite colours. Blockade on your bishop's colour.", fen: "8/8/4k3/8/4PP2/3B1K2/8/2b5 b - - 0 1",
        task: { prompt: "Black to move. Set up the blockade.", answers: ["Bb2"], hint: "The pawns want e5 or f5. Which of those can your dark bishop control?", success: "Bb2! The bishop controls e5, your king holds the light squares. Careful: Bxf4?? Kxf4 loses, because bishop and pawn against a lone king wins." } },
    ],
    takeaways: ['Middlegame: attack on your bishop\'s colour.', 'Endgame: drawish; defender blockades on his bishop\'s colour.', 'Winning side needs passed pawns on both wings.'],
  },
  {
    id: 'knight-bishop', title: 'Knight vs bishop', category: 'Pieces', level: 'advanced',
    rule: 'Bishops love open positions and pawns on both wings; knights love closed centres, outposts and pawns on one side.',
    fixes: ['bad_exchange', 'minor_endgames', 'piece_placement'], practise: ['eg_minor', 'positional'],
    steps: [
      { say: 'Before you trade bishop for knight (or the other way), picture the position 10 moves later: will it open or stay closed?' },
      { say: 'Fix enemy pawns on the colour of your bishop: they become targets. Put your own pawns on the opposite colour.' },
      { say: 'Knight advantages: a protected outpost, a blocked centre, all the pawns on one wing (the bishop\'s range doesn\'t matter there). Bishop advantages: passed pawns on both wings, open lines, a race.' },
      { say: 'The Exchange Ruy Lopez is a deliberate bishop-for-knight trade: White bets on a better pawn structure over the bishop pair.', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4' },
      { say: "Sveshnikov: only one black piece still controls d5.", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5",
        task: { prompt: "White to move. Win the fight for d5.", answers: ["Bxf6", "Nd5"], hint: "Trade your bishop for the piece that guards d5.", success: "Bxf6! White gives the bishop for the knight because that knight was the main guard of d5. After ...gxf6 Nd5, a white knight dominates against Black's bishops. Nd5 first is also a main line." } },
    ],
    takeaways: ['Open board, pawns on both sides: bishop.', 'Closed centre, outposts: knight.', 'Fix their pawns on your bishop\'s colour.'],
  },
  {
    id: 'opposition', title: 'Opposition, key squares and triangulation', category: 'Endgames', level: 'advanced',
    rule: 'In king-and-pawn endings, the king that reaches the key squares in front of the pawn wins; the opposition decides who gets there, and triangulation wins a tempo when you need it.',
    fixes: ['opposition', 'king_activity', 'promotion_technique'], practise: ['eg_opposition', 'eg_pawn'], endgame: 'kp-opposition-win',
    steps: [
      { say: 'Key squares: for a pawn on e4, if the white king reaches d6, e6 or f6, it wins no matter who moves. The fight is about reaching them.' },
      { say: 'Opposition: kings facing each other with one square between, and the side NOT to move "has the opposition": the other king must step aside and let you through.', fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', marks: ['e5', 'd6', 'e6', 'f6'] },
      { say: 'Triangulation: when you need to "pass", walk your king around a triangle of three squares while their king has only two good squares. You lose a tempo on purpose and they end up to move.' },
      { say: 'Play it out against Stockfish next: "Winning with the opposition" in the endgame trainer.' },
      { say: "Kings face each other and it's White's move, so Black has the opposition. But you have a spare pawn move.", fen: "8/8/4k3/8/4K3/8/4P3/8 w - - 0 1",
        task: { prompt: "White to move and win.", answers: ["e3", "Kf4", "Kd4"], hint: "A pawn move \"passes\" the move to Black.", success: "e3! Now Black must move and give way (Kd6 Kf5, or Kf6 Kd5) and your king reaches the key squares. Spare tempo moves decide pawn endings. Kf4/Kd4 also win, but e3 is the cleanest." } },
    ],
    takeaways: ['Know the key squares for your pawn.', 'Side NOT to move has the opposition.', 'Triangulate to pass the move.'],
  },
  {
    id: 'lucena-philidor', title: 'Lucena and Philidor: the two rook endings you must know', category: 'Endgames', level: 'advanced',
    rule: 'Lucena (to win): build a bridge with the rook on the 4th rank. Philidor (to draw): rook on your 3rd rank until the pawn advances, then check from behind.',
    fixes: ['rook_endgames', 'holding_draws', 'conversion'], practise: ['eg_rook'], endgame: 'lucena',
    steps: [
      { say: 'Half of all endgames are rook endings, and two positions explain most of them.' },
      { say: 'Lucena: your pawn on the 7th, king in front of it, their king cut off. Rook to the 4th rank, king out, then block the checks with the rook ("building a bridge").' },
      { say: 'Philidor: the defender keeps the rook on the 3rd rank (from his side), stopping the king from coming forward. When the pawn steps to that rank, the rook drops to the back and checks from behind: the king has no shelter.' },
      { say: 'Play both in the endgame trainer: Lucena to win, Philidor to hold.' },
      { say: "The Lucena position: your pawn is on the 7th, your king in front of it.", fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
        task: { prompt: "White to move. Start the winning technique.", answers: ["Rd1+", "Rc4", "Rc5", "Rc8+"], hint: "Check the black king one file further away, then bring the rook to the 4th rank.", success: "Rd1+ Ke7 then Rd4: when the king comes out and the checks start, the rook blocks on the 4th rank (\"building a bridge\"). Rc4 straight away works too." } },
    ],
    takeaways: ['Lucena: rook to the 4th, build a bridge.', 'Philidor: 3rd-rank defence, then checks from behind.'],
  },
  {
    id: 'outside-passer', title: 'The outside passed pawn', category: 'Endgames', level: 'club',
    rule: 'A passed pawn far from the other pawns is a decoy: the enemy king must run after it, and your king eats the pawns it left behind.',
    fixes: ['conversion', 'promotion_technique', 'king_activity'], practise: ['eg_pawn'], endgame: 'outside-passer',
    steps: [
      { say: 'In pawn endings, an outside passed pawn is usually decisive, even with equal material.' },
      { say: 'Method: push the outside passer to drag the enemy king away, then march your own king to the other wing and win the pawns there.' },
      { say: 'This is also why, when you are ahead, trading into a pawn ending with an outside passer is often the cleanest win.' },
      { say: "You have the outside passed pawn. Win it calmly.", fen: "8/5kpp/8/8/8/8/P4PPP/6K1 w - - 0 1",
        task: { prompt: "White to move and win.", answers: ["Kf1", "f4", "f3", "h4"], hint: "Before pushing the a-pawn, bring your king toward the centre.", success: "Kf1 (or f4/f3 first) wins: your king goes to the centre, the a-pawn later drags Black's king away, and your king eats the kingside. No need to rush a4." } },
    ],
    takeaways: ['Outside passer = decoy.', 'Trade into pawn endings where you have one.'],
  },
];

export const PRINCIPLE_BY_ID = new Map(PRINCIPLES.map((p) => [p.id, p]));
export const CATEGORIES: PrincipleCategory[] = ['Thinking', 'Openings', 'Pawn structure', 'Pieces', 'Strategy', 'Attack & defence', 'Endgames'];
export const LEVEL_LABEL: Record<PrincipleLevel, string> = { club: 'Club', advanced: 'Advanced', expert: 'Expert' };

/** Principles that fix the player's top weaknesses, most urgent first. */
export function principlesFor(weaknessKeys: string[]): Principle[] {
  const out: Principle[] = [];
  for (const k of weaknessKeys) for (const p of PRINCIPLES) if (p.fixes.includes(k) && !out.includes(p)) out.push(p);
  return out;
}
