// Theoretical endgames every improving player needs. Each FEN's verdict is
// checked by Stockfish in tests/data.test.ts. You play the side to move.
export interface TheoryEndgame {
  id: string;
  title: string;
  theme: string;
  goal: 'win' | 'draw';
  fen: string;
  rating: number;
  idea: string;
  steps: string[];
}
export const THEORY_ENDGAMES: TheoryEndgame[] = [
  {
    id: 'kq-k', title: 'Queen mate', theme: 'eg_mate', goal: 'win', rating: 800,
    fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    idea: 'Use the queen to shrink the king\'s box (a knight\'s move away from it), then bring your own king up to help mate.',
    steps: ['Put the queen a knight\'s jump from the enemy king to cut it off.', 'Follow the king as it moves, keeping the box shrinking.', 'When it is on the edge, stop and walk your king over. Watch out for stalemate!'],
  },
  {
    id: 'kr-k', title: 'Rook mate', theme: 'eg_mate', goal: 'win', rating: 1000,
    fen: '8/8/4k3/8/8/8/8/R3K3 w - - 0 1',
    idea: 'The rook cuts the king off along a rank or file; your king takes the opposition and the rook checks it back, one line at a time.',
    steps: ['Cut the king off with the rook.', 'Bring your king toward the enemy king.', 'When the kings face each other, check with the rook to push the king back a line.', 'Make a waiting rook move when you need to hand over the move.'],
  },
  {
    id: 'two-rooks', title: 'Two-rook ladder', theme: 'eg_mate', goal: 'win', rating: 700,
    fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1',
    idea: 'The rooks take turns: one cuts off a rank, the other checks on the next rank. The king is pushed to the edge without help from your king.',
    steps: ['Cut off a rank with one rook.', 'Check with the other rook on the next rank.', 'If the king attacks a rook, move it far away along the same rank.'],
  },
  {
    id: 'kp-6th', title: 'King on the sixth', theme: 'eg_pawn', goal: 'win', rating: 900,
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    idea: 'With your king on the sixth rank in front of the pawn, you win no matter who is to move. Do not push the pawn too early.',
    steps: ['Keep the king in front of the pawn.', 'Take the opposition or step to the side to push the enemy king away.', 'Push the pawn only when your king controls the squares in front of it.'],
  },
  {
    id: 'kp-opposition-win', title: 'Winning with the opposition', theme: 'eg_opposition', goal: 'win', rating: 1300,
    fen: '8/8/3k4/8/3K4/8/3P4/8 w - - 0 1',
    idea: 'The kings face each other and it is your move, which would normally be bad. But your pawn can make a waiting move (d2-d3), handing the move back: now you have the opposition.',
    steps: ['Walk the king forward in front of the pawn.', 'When the kings face each other and it is your move, a pawn move hands the move to your opponent.', 'Reach the sixth rank in front of the pawn: then it is a known win.'],
  },
  {
    id: 'kp-defend', title: 'Holding the pawn ending', theme: 'eg_opposition', goal: 'draw', rating: 1200,
    fen: '8/4k3/8/4PK2/8/8/8/8 b - - 0 1',
    idea: 'The defender draws by keeping the opposition: stand directly in front of the enemy king with one square between, when it is the opponent\'s turn.',
    steps: ['Stay in front of the pawn.', 'Answer each king move by taking the opposition.', 'If you are pushed to the back rank, go straight back, not to the side.'],
  },
  {
    id: 'square-rule', title: 'Rule of the square', theme: 'eg_pawn', goal: 'win', rating: 900,
    fen: '8/8/8/8/k7/8/6P1/7K w - - 0 1',
    idea: 'Draw a square from the pawn to its promotion rank. If the enemy king cannot step into it, the pawn runs home alone.',
    steps: ['Push the pawn (two squares on its first move).', 'Do not waste time with the king.'],
  },
  {
    id: 'outside-passer', title: 'The outside passed pawn', theme: 'eg_pawn', goal: 'win', rating: 1400,
    fen: '8/5kpp/8/8/8/8/P4PPP/6K1 w - - 0 1',
    idea: 'An extra pawn far from the kings works as a decoy: the enemy king must go and stop it, and your king eats the other pawns.',
    steps: ['Activate your king first.', 'Advance the outside pawn to drag the enemy king away.', 'Your king then wins the pawns on the other side.'],
  },
  {
    id: 'lucena', title: 'Lucena position', theme: 'eg_rook', goal: 'win', rating: 1700,
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    idea: 'Build a bridge: drive the enemy king one more file away, put the rook on the fourth rank, then walk the king out and block checks with the rook.',
    steps: ['Check the enemy king one more file away (Rd1+).', 'Bring the rook to the fourth rank (Rd4).', 'Walk the king out; when checks come, interpose the rook.'],
  },
  {
    id: 'philidor', title: 'Philidor defence', theme: 'eg_rook', goal: 'draw', rating: 1600,
    fen: '4k3/8/r7/4PK2/8/8/8/1R6 b - - 0 1',
    idea: 'Keep your rook on your third rank (here the sixth) until the pawn advances; then go to the far side and check from behind.',
    steps: ['Keep the rook on the sixth rank so the white king cannot come forward.', 'When the pawn moves to e6, the king loses its shelter: swing the rook down and check from behind.', 'Keep your king in front of the pawn.'],
  },
  {
    id: 'rook-behind', title: 'Rook behind the passed pawn', theme: 'eg_rook', goal: 'win', rating: 1500,
    fen: '8/8/5k2/8/P7/8/5K2/R6r w - - 0 1',
    idea: 'Rooks belong behind passed pawns: yours, to push it; the enemy\'s, to stop it. Here your rook already supports the pawn from behind.',
    steps: ['Push the pawn with rook support.', 'Bring the king toward the action when the enemy rook is tied down.', 'Avoid allowing checks that win the pawn.'],
  },
  {
    id: 'wrong-bishop', title: 'Wrong-coloured bishop', theme: 'eg_draw', goal: 'draw', rating: 1300,
    fen: '7k/8/6KP/8/8/8/8/3B4 b - - 0 1',
    idea: 'A rook pawn with a bishop that cannot control the promotion square is a draw if the defending king reaches the corner.',
    steps: ['Stay in the corner (h8/g8).', 'Just shuffle between the two corner squares.', 'Beware: a stalemate is fine for you, so you have no worries.'],
  },
  {
    id: 'q-vs-pawn', title: 'Queen vs. central pawn', theme: 'eg_queen', goal: 'win', rating: 1600,
    fen: '8/8/8/8/8/K7/4pk2/7Q w - - 0 1',
    idea: 'Check and pin until the enemy king is forced in front of its own pawn. Each time it blocks the pawn, your king steps closer.',
    steps: ['Give checks or pin the pawn so the king must step onto the promotion square.', 'Use the free tempo to bring your king closer.', 'Repeat until your king helps win the pawn.'],
  },
];
