// A compact, idea-first repertoire. Lines are written in SAN and checked for
// legality in tests/data.test.ts. Notes are keyed by ply (0 = first move).
export interface CourseLine {
  id: string;
  name: string;
  san: string;
  notes?: Record<number, string>;
  /** A trap: the idea is shown and practised, the bad move is marked. */
  trap?: { badPly: number; text: string };
}
export interface Course {
  id: string;
  name: string;
  color: 'w' | 'b';
  vs: string;
  style: string[];
  summary: string;
  ideas: string[];
  plans: string[];
  lines: CourseLine[];
}

export const COURSES: Course[] = [
  {
    id: 'italian', name: 'Italian Game', color: 'w', vs: '1...e5', style: ['classical', 'tactical', 'development'],
    summary: 'Fast development toward the centre and the f7 square, castle early, then prepare d4 with c3.',
    ideas: [
      'Bishop on c4 aims at f7, the weakest square near the black king.',
      'c3 then d4 builds a big pawn centre; d3 keeps things solid if d4 is not ready.',
      'Retreat Bc4-b3 before ...Na5 or ...d5 can hit it with tempo.',
      'h3 stops ...Bg4 pinning your knight to the queen.',
    ],
    plans: ['Castle, Re1, Nbd2-f1-g3 to bring the last knight over.', 'Push d4 when your pieces are ready.', 'In quiet positions, a4 grabs space against ...b5.'],
    lines: [
      { id: 'it-main', name: 'Giuoco Piano', san: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3',
        notes: { 2: 'Develop and attack e5.', 4: 'The bishop eyes f7.', 6: 'Prepares d4.', 8: 'Solid: protects e4 and opens the c1 bishop.', 10: 'King to safety first.', 14: 'Retreat early so ...d5 or ...Na5 will not come with tempo.', 16: 'Stops ...Bg4.' } },
      { id: 'it-two-knights', name: 'Two Knights with d3', san: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
        notes: { 6: 'd3 protects e4 and avoids the sharp lines after Ng5.' } },
      { id: 'it-blackburne', name: 'Blackburne trap: do not take on e5', san: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxd4 exd4 O-O',
        notes: { 5: 'Black leaves e5 hanging on purpose.', 6: 'Trade the knight first. 4.Nxe5? Qg5! attacks e5 and g2 at once.' },
        trap: { badPly: 6, text: 'The tempting 4.Nxe5? runs into 4...Qg5!, hitting the knight and g2. Trading on d4 first is safe and good.' } },
      { id: 'it-legal', name: 'Légal mate idea', san: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
        notes: { 8: 'The pinned knight moves anyway: if Black grabs the queen, it is mate.', 10: 'Check first.', 12: 'Checkmate with three minor pieces.' },
        trap: { badPly: 9, text: 'If Black takes the queen (5...Bxd1??), 6.Bxf7+ Ke7 7.Nd5# is mate. Pins to the queen are not absolute.' } },
    ],
  },
  {
    id: 'london', name: 'London System', color: 'w', vs: '1...d5 / 1...Nf6', style: ['solid', 'positional', 'system'],
    summary: 'The same set-up against almost anything: d4, Bf4, e3, Nf3, c3, Nbd2, Bd3. Few traps to memorise, clear plans.',
    ideas: [
      'Get the dark-squared bishop out (Bf4) before playing e3.',
      'The pawn triangle c3-d4-e3 is a rock in the centre.',
      'Retreat Bf4-g3 when Black offers ...Bd6, so your pawns stay healthy.',
      'Watch b2: ...Qb6 often attacks it.',
    ],
    plans: ['Ne5 with f4 for a kingside attack.', 'Or e4 in one go when your pieces support it.'],
    lines: [
      { id: 'ld-main', name: 'Main set-up vs ...d5', san: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
        notes: { 2: 'Bishop out before e3 locks it in.', 8: 'Supports d4 against ...c5 pressure.', 12: 'Meet ...Bd6 with Bg3: if Black trades, your h-pawn recaptures and opens the h-file.' } },
      { id: 'ld-qb6', name: 'Meeting ...Qb6', san: 'd4 d5 Bf4 c5 e3 Qb6 Nc3',
        notes: { 6: 'If 4...Qxb2, 5.Nb5! threatens Rb1 and Nc7+: the queen is in danger.' } },
      { id: 'ld-kid', name: 'Against the King\'s Indian set-up', san: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3',
        notes: { 10: 'h3 gives the bishop a retreat on h2 from ...Nh5.' } },
    ],
  },
  {
    id: 'caro', name: 'Caro-Kann Defence', color: 'b', vs: '1.e4', style: ['solid', 'positional', 'king safety'],
    summary: 'Challenge e4 with ...d5 after preparing it with ...c6. Healthy pawns, the light-squared bishop gets out before ...e6.',
    ideas: [
      '...c6 supports ...d5 so you can recapture with a pawn.',
      'Develop the c8 bishop to f5 or g4 before playing ...e6.',
      'Your pawn structure is sound: endgames are often good for you.',
      'Strike back in the centre later with ...c5 or ...e5.',
    ],
    plans: ['Complete development: ...Nd7, ...Ngf6, ...e6, ...Be7, castle.', 'Play ...c5 to challenge d4.'],
    lines: [
      { id: 'ck-classical', name: 'Classical', san: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6',
        notes: { 7: 'The bishop gets out before ...e6.', 11: 'Give the bishop a home on h7.', 17: 'Trade off White\'s best attacking piece.' } },
      { id: 'ck-advance', name: 'Advance', san: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3',
        notes: { 5: 'The bishop comes out before ...e6, the main idea of the Caro-Kann.', 9: 'Hit the base of the pawn chain.' } },
      { id: 'ck-exchange', name: 'Exchange', san: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7',
        notes: { 11: 'Pin and develop.', 13: 'Defend b7 calmly; trade queens if you like.' } },
      { id: 'ck-smother', name: 'Trap to avoid: smothered mate', san: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Qe2 Ndf6',
        notes: { 9: 'Only this knight! 5...Ngf6?? 6.Nd6# is a famous smothered mate (the e7 pawn is pinned).' },
        trap: { badPly: 9, text: 'After 5.Qe2, 5...Ngf6?? allows 6.Nd6#. The e-pawn is pinned to the king, so it cannot take the knight.' } },
    ],
  },
  {
    id: 'e5-black', name: '1...e5: Classical replies', color: 'b', vs: '1.e4', style: ['classical', 'tactical'],
    summary: 'Meet 1.e4 with 1...e5, develop knights before bishops, castle quickly, and know the early attacks on f7.',
    ideas: ['Defend e5 with ...Nc6, then develop toward the centre.', 'Early queen attacks are met by developing with tempo.', 'In the Two Knights, answer Ng5 and Bxf7 ideas precisely.'],
    plans: ['...Bc5 or ...Be7, castle, then ...d6 or ...d5.'],
    lines: [
      { id: 'e5-scholar', name: 'Stopping Scholar\'s Mate', san: 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6',
        notes: { 5: 'Block the queen\'s attack on f7 and gain time.', 7: 'Block the f-file and develop. Next ...Nd4 hits c2.' } },
      { id: 'e5-giuoco', name: 'Giuoco Piano as Black', san: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
        notes: { 7: 'Counterattack e4.', 11: 'King safety before anything else.' } },
      { id: 'e5-fried', name: 'Avoiding the Fried Liver', san: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5',
        notes: { 9: '5...Na5! hits the bishop. 5...Nxd5?! allows 6.Nxf7!, the Fried Liver attack.' },
        trap: { badPly: 9, text: 'Recapturing 5...Nxd5 allows 6.Nxf7 Kxf7 7.Qf3+ with a dangerous attack. 5...Na5 is the main move.' } },
    ],
  },
  {
    id: 'qgd', name: 'Queen\'s Gambit Declined', color: 'b', vs: '1.d4', style: ['solid', 'positional', 'classical'],
    summary: 'Hold the centre with ...d5 and ...e6, develop smoothly, castle, then free your game with ...c5 or ...dxc4 and ...e5.',
    ideas: ['...e6 supports d5 so you never give up the centre.', 'The c8 bishop is your problem piece: plan ...b6 and ...Bb7, or ...dxc4 and ...e5.', 'Break with ...c5 once you have castled.'],
    plans: ['Castle, ...h6 to ask the bishop, ...b6 and ...Bb7.'],
    lines: [
      { id: 'qgd-main', name: 'Tartakower', san: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
        notes: { 3: 'Keep the d5 pawn supported.', 11: 'Ask the bishop to decide.', 13: 'The problem bishop goes to b7.' } },
      { id: 'qgd-exchange', name: 'Exchange Variation', san: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O',
        notes: { 11: 'The Carlsbad structure: solid; later ...Re8, ...Nf8 and ...Ne6 or ...Ng6.' } },
      { id: 'qgd-elephant', name: 'Elephant trap', san: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8',
        notes: { 10: 'White grabs the "pinned" knight...', 11: '...but the pin is not real!', 13: 'Black regains the queen with check.' },
        trap: { badPly: 10, text: 'The knight on f6 looks pinned, but 6.Nxd5? Nxd5! 7.Bxd8 Bb4+ wins a piece for Black.' } },
      { id: 'qgd-london', name: 'Against the London', san: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 O-O',
        notes: { 5: 'Strike at d4 at once.', 11: 'Challenge the London bishop.' } },
    ],
  },
];
