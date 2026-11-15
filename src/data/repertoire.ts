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

  {
    id: 'qg', name: "Queen's Gambit", color: 'w', vs: '1...d5', style: ['classical', 'positional', 'solid'],
    summary: 'Offer the c-pawn to pull Black\'s d-pawn away from the centre. If Black takes, you get the centre and win the pawn back easily.',
    ideas: ['c4 attacks the d5 pawn: if it ever leaves, your e-pawn can take over the centre.', 'If Black grabs the pawn (...dxc4), develop quickly and take it back with the bishop.', 'Pin the f6 knight with Bg5 so it cannot defend d5 as well.', 'The minority attack: later, push your b-pawn to b5 to weaken Black\'s queenside pawns.'],
    plans: ['Develop: Nc3, Bg5, e3, Nf3, Bd3, castle.', 'Put a rook on c1, where the c-file opens.', 'Push b4-b5 against Black\'s pawns on c6/d5.'],
    lines: [
      { id: 'qg-qgd', name: 'Against the Declined', san: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3',
        notes: { 2: 'The gambit: offer the c-pawn.', 6: 'Pin the knight that defends d5.', 12: 'The rook will be useful when the c-file opens.' } },
      { id: 'qg-qga', name: 'Against the Accepted', san: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
        notes: { 3: 'Black takes the pawn, but can\'t keep it.', 6: 'Opens the bishop\'s path to c4.', 8: 'Pawn regained, and you are ahead in development.' } },
      { id: 'qg-trap', name: 'Trap: holding on to the pawn', san: 'd4 d5 c4 dxc4 e3 b5 a4 c6 axb5 cxb5 Qf3',
        notes: { 5: 'Black tries to keep the extra pawn...', 6: 'Hit the pawn chain from the side.', 10: 'The queen attacks the rook on a8 down the long diagonal, and the knight on b8 is in the way of any defence.' },
        trap: { badPly: 5, text: 'Trying to keep the pawn with ...b5 fails: a4 breaks the chain, and Qf3 hits the rook on a8.' } },
    ],
  },
  {
    id: 'ruy', name: 'Ruy Lopez', color: 'w', vs: '1...e5', style: ['classical', 'positional', 'long-term pressure'],
    summary: 'The bishop on b5 attacks the knight that defends e5. Quiet pressure: castle, prepare d4, and squeeze.',
    ideas: ['Bb5 puts pressure on the defender of e5.', 'The bishop retreats to a4 and b3 when kicked, still aiming at f7.', 'c3 then d4 builds a big centre.', 'h3 stops ...Bg4 pins and ...Ng4 jumps.'],
    plans: ['Castle, Re1, c3, h3, d4.', 'Bring the queen\'s knight around: Nbd2-f1-g3.'],
    lines: [
      { id: 'ruy-main', name: 'Main line (Closed)', san: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
        notes: { 4: 'Attack the knight that defends e5.', 6: 'Keep the bishop on the diagonal.', 8: 'Castle first; e4 is defended by tactics.', 14: 'Prepare d4.', 16: 'Stop ...Bg4.' } },
      { id: 'ruy-berlin', name: 'Berlin Defence', san: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
        notes: { 7: 'Black grabs e4; you get it back.', 8: 'Open the centre while Black\'s king is still there.', 15: 'An early queen trade, but Black\'s king has lost castling.' } },
      { id: 'ruy-exchange', name: 'Exchange Variation', san: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4',
        notes: { 6: 'Give up the bishop to damage Black\'s pawns.', 10: 'Open the centre: your healthy kingside majority matters in endgames.' } },
      { id: 'ruy-noah', name: "Trap to avoid: Noah's Ark", san: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4',
        notes: { 14: 'Taking back with the queen looks natural...', 15: '...but the pawns chase it.', 21: 'The bishop on b3 is trapped by the pawns. Take on d4 with the c-pawn after c3 instead, or avoid this line.' },
        trap: { badPly: 14, text: 'After 8.Qxd4?, ...c5 and ...c4 trap White\'s bishop on b3 (Noah\'s Ark trap). Play 8.c3 or keep the queen out of it.' } },
    ],
  },
  {
    id: 'scotch', name: 'Scotch Game', color: 'w', vs: '1...e5', style: ['open', 'tactical', 'direct'],
    summary: 'Open the centre straight away with d4. Simple ideas, open lines, fast development.',
    ideas: ['3.d4 trades your d-pawn for Black\'s e-pawn: you get a free hand in the centre.', 'Your knight on d4 is strong; keep it supported.', 'Against ...Nf6 lines, e5 kicks the knight away.'],
    plans: ['Develop with Be3, Nc3/Bc4, castle.', 'Use the half-open d-file with a rook.'],
    lines: [
      { id: 'sc-bc5', name: 'Classical: 4...Bc5', san: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
        notes: { 4: 'Strike the centre immediately.', 8: 'Defend the knight with the bishop.', 10: 'c3 makes the knight rock-solid.' } },
      { id: 'sc-nf6', name: '4...Nf6 (Mieses)', san: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
        notes: { 8: 'Trade knights to damage Black\'s pawns.', 10: 'Kick the f6 knight.', 14: 'Kick it again: you gain space with tempo.' } },
    ],
  },
  {
    id: 'anti-sicilian', name: 'Against the Sicilian (Alapin)', color: 'w', vs: '1...c5', style: ['solid', 'system', 'central'],
    summary: 'Play c3 and d4 to build a classical pawn centre, instead of entering the huge Open Sicilian theory.',
    ideas: ['c3 prepares d4, so you can recapture with a pawn and keep two centre pawns.', 'If Black takes on d5 with the queen, develop with tempo by hitting it.', 'Against ...Nf6, push e5 and chase the knight.'],
    plans: ['d4, Nf3, Be2/Bd3, castle.', 'Keep the pawn on d4 well protected.'],
    lines: [
      { id: 'al-d5', name: '2...d5', san: 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2',
        notes: { 2: 'Prepare d4.', 6: 'Take the centre; Black\'s queen is exposed.', 10: 'Calm development, then castle.' } },
      { id: 'al-nf6', name: '2...Nf6', san: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4',
        notes: { 4: 'Chase the knight.', 10: 'Recapture with the pawn: two centre pawns.', 12: 'Hit the knight on d5.' } },
    ],
  },
  {
    id: 'french', name: 'French Defence', color: 'b', vs: '1.e4', style: ['solid', 'counterattacking', 'pawn chains'],
    summary: 'Play ...e6 and ...d5. Black accepts a slightly cramped position, then attacks White\'s centre with ...c5 and ...f6.',
    ideas: ['...e6 prepares ...d5, attacking e4.', 'When White pushes e5, hit the base of the pawn chain (d4) with ...c5.', 'Then pile up on d4 with ...Nc6 and ...Qb6.', 'The light-squared bishop is often your problem piece: trade it or get it out via ...b6/...Ba6.'],
    plans: ['...c5, ...Nc6, ...Qb6 against d4.', 'Later ...f6 to attack e5 too.'],
    lines: [
      { id: 'fr-advance', name: 'Advance', san: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4',
        notes: { 5: 'Hit the base of the chain.', 7: 'More pressure on d4.', 9: 'Pressure on d4 and b2.', 11: 'Lock the queenside; the b2 pawn and b3 square become targets.' } },
      { id: 'fr-exchange', name: 'Exchange', san: 'e4 e6 d4 d5 exd5 exd5 Bd3 Nc6 c3 Bd6 Nf3 Nge7',
        notes: { 5: 'Symmetrical, and your light bishop is free now.', 11: 'The knight goes to e7, keeping the f-pawn free.' } },
      { id: 'fr-winawer', name: 'Winawer', san: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7',
        notes: { 5: 'Pin the knight that defends e4.', 7: 'Attack the chain.', 9: 'Give up the bishop to wreck White\'s pawns.' } },
      { id: 'fr-tarrasch', name: 'Tarrasch', san: 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6',
        notes: { 9: 'Hit d4.', 15: 'Now attack e5 as well: break the chain from both sides.' } },
    ],
  },
  {
    id: 'scandi', name: 'Scandinavian Defence', color: 'b', vs: '1.e4', style: ['simple', 'solid', 'easy to learn'],
    summary: 'Take on e4\'s partner straight away with 1...d5. Few lines to learn and a very clear structure.',
    ideas: ['1...d5 challenges e4 at once.', 'After 2...Qxd5 3.Nc3, the queen goes to a5 (or d6), out of danger.', 'Develop the light bishop to f5 or g4 before ...e6.', '...c6 gives the queen a retreat and controls d5.'],
    plans: ['...Nf6, ...c6, ...Bf5, ...e6, ...Nbd7, castle.'],
    lines: [
      { id: 'scan-qa5', name: '3...Qa5', san: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6',
        notes: { 5: 'The queen is safe on a5 and pins the c3 knight.', 9: 'A retreat square for the queen, and control of d5.', 11: 'Bishop out before ...e6.' } },
      { id: 'scan-qd6', name: '3...Qd6', san: 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6',
        notes: { 5: 'Modern retreat: safe from Nb5 after ...a6.', 9: 'Stops Nb5 and Bb5.' } },
      { id: 'scan-nf6', name: '2...Nf6 (Modern)', san: 'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 Bg4 Be2 e6',
        notes: { 3: 'Take back with the knight later; develop first.', 7: 'Pin the knight.' } },
    ],
  },
  {
    id: 'acc-dragon', name: 'Sicilian: Accelerated Dragon', color: 'b', vs: '1.e4', style: ['dynamic', 'counterattacking', 'fianchetto'],
    summary: 'A fighting reply to 1.e4. The bishop on g7 bites along the long diagonal; Black looks for ...d5 or queenside play.',
    ideas: ['...c5 fights for d4 from the side.', 'The fianchettoed bishop on g7 is your best piece: keep the long diagonal open.', 'Strike back in the centre with ...d5 when it works.', 'Against c3 (Alapin), play ...Nf6 and ...d6 to hit e5.'],
    plans: ['...g6, ...Bg7, ...Nf6, castle, then ...d6/...d5 and ...Bd7, ...Rc8.'],
    lines: [
      { id: 'ad-main', name: 'Main line', san: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6 f3 Bd7',
        notes: { 7: 'The accelerated fianchetto: ...d6 is not played yet, so ...d5 in one go stays possible.', 13: 'King to safety.', 17: 'Rooks to the c-file next.' } },
      { id: 'ad-maroczy', name: 'Maroczy Bind', san: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Nf6 Nc3 d6 Be2 Nxd4 Qxd4 Bg7',
        notes: { 8: 'White clamps d5.', 13: 'Trade a pair of knights to free your position.', 15: 'The bishop attacks the queen.' } },
      { id: 'ad-alapin', name: 'Against 2.c3', san: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 cxd4 d6',
        notes: { 3: 'Hit e4 right away.', 9: 'Attack the e5 pawn.' } },
    ],
  },
  {
    id: 'kid', name: "King's Indian Defence", color: 'b', vs: '1.d4', style: ['dynamic', 'attacking', 'fianchetto'],
    summary: 'Let White build a big centre, then attack it with ...e5 or ...c5. In many lines Black attacks on the kingside with ...f5.',
    ideas: ['Fianchetto the bishop and castle fast.', 'Strike the centre with ...e5.', 'When White closes it with d5, attack with ...Ne8/...Nd7 and ...f5.', 'Your king is safe; White\'s play is on the queenside.'],
    plans: ['...Nf6, ...g6, ...Bg7, ...O-O, ...d6, ...e5.', 'After d5: ...Ne7/...Nd7, ...f5, ...f4, ...g5.'],
    lines: [
      { id: 'kid-classical', name: 'Classical', san: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
        notes: { 9: 'Castle before striking.', 11: 'The key break.', 15: 'The knight heads to the kingside; ...Nd7/...Ne8 and ...f5 come next.' } },
      { id: 'kid-london', name: 'Against the London', san: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 Nbd7 O-O',
        notes: { 9: 'Prepare ...e5.', 11: '...Nbd7 supports ...e5.' } },
      { id: 'kid-fianchetto', name: 'Against the fianchetto', san: 'd4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O O-O d6 c4 Nbd7',
        notes: { 7: 'Castle; same set-up against everything.', 11: '...e5 is next.' } },
    ],
  },
  {
    id: 'slav', name: 'Slav Defence', color: 'b', vs: '1.d4', style: ['solid', 'positional'],
    summary: 'Support d5 with ...c6 so the light bishop can come out to f5 before ...e6. Solid and sound.',
    ideas: ['...c6 defends d5 without blocking the c8 bishop.', 'Get the bishop to f5 before playing ...e6.', 'If you take on c4, White usually wins the pawn back: develop, don\'t cling to it.'],
    plans: ['...Nf6, ...dxc4/...Bf5, ...e6, ...Bb4/...Be7, castle.'],
    lines: [
      { id: 'slav-main', name: 'Main line', san: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O',
        notes: { 3: 'Support d5 without locking in the bishop.', 9: 'The bishop gets out first.', 13: 'Pin the knight and get ready to castle.' } },
      { id: 'slav-exchange', name: 'Exchange', san: 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5',
        notes: { 5: 'Symmetrical: develop naturally.', 11: 'Mirror White\'s set-up.' } },
      { id: 'slav-semi', name: 'Semi-Slav', san: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5',
        notes: { 7: '...e6: rock solid.', 13: 'Gain space with tempo, then ...Bb7 and ...a6/...c5.' } },
    ],
  },
];
