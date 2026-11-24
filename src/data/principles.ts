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
    ],
    takeaways: ['Winning? Kill counterplay first.', 'Improve all pieces before the breakthrough.', 'Trade pieces, not pawns.'],
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
