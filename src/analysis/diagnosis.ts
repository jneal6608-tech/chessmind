// The road to 2000: measures your games against what a ~2000 player typically
// does, finds the biggest gaps, and turns them into a short, concrete plan.
// Everything here is computed from your analysed games and training results;
// with too little data it says so instead of guessing.
import type { GameRecord, MoveAnalysis } from './types';
import type { Attempt } from '../store/db';
import type { Profile } from './profile';
import { scoreFor } from './strength';
import { overallTrainingRating } from '../training/srs';
import { WEAKNESS } from '../training/themes';
import { principlesFor } from '../data/principles';

export interface Benchmark { key: string; label: string; you: number | null; target: number; better: 'up' | 'down'; fmt: (v: number) => string; ok: boolean | null; note: string }
export interface Finding {
  key: string;
  title: string;
  detail: string;
  /** How much it costs you, 0..1, used for ordering. */
  weight: number;
  actions: { label: string; path: string }[];
}
export interface Diagnosis {
  games: number;
  enough: boolean;
  rating: number;
  gap: number;
  benchmarks: Benchmark[];
  findings: Finding[];
  headline: string;
  plan: { day: string; tasks: string[] }[];
}

const OFFENCE = new Set(['missed_fork', 'missed_pin', 'missed_skewer', 'missed_discovered', 'missed_free_material', 'missed_mate', 'missed_tactic', 'missed_advantage']);
const DEFENCE = new Set(['hanging_pieces', 'missed_threat', 'missed_mating_threat', 'no_blunder_check', 'back_rank', 'king_safety']);
const user = (g: GameRecord) => g.analysis!.moves.filter((m) => m.color === g.userColor);
const pov = (g: GameRecord, cp: number) => (g.userColor === 'w' ? cp : -cp);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const bad = (m: MoveAnalysis) => m.cls === 'blunder' || m.cls === 'mistake' || m.cls === 'miss';

export function diagnose(gamesIn: GameRecord[], attempts: Attempt[], profile: Profile, rating: number, target = 2000): Diagnosis {
  const games = gamesIn.filter((g) => g.analysis).sort((a, b) => a.date - b.date).slice(-30);
  const n = games.length;
  const enough = n >= 3;
  const per = (f: (g: GameRecord) => number) => avg(games.map(f));

  // ---- measurements
  const blunders = per((g) => g.analysis!.counts[g.userColor].blunder);
  const mistakes = per((g) => g.analysis!.counts[g.userColor].mistake + g.analysis!.counts[g.userColor].miss);
  const accuracy = per((g) => g.analysis!.accuracy[g.userColor]);
  const phaseAcc = (ph: 'opening' | 'middlegame' | 'endgame') => avg(games.filter((g) => g.analysis!.phases[ph].moves >= 3).map((g) => g.analysis!.phases[ph].accuracy));
  const acc = { opening: phaseAcc('opening'), middlegame: phaseAcc('middlegame'), endgame: phaseAcc('endgame') };
  // Winning positions (>= +3 for you at some point) and how many you won.
  const winning = games.filter((g) => user(g).some((m) => pov(g, m.evalAfter) >= 300));
  const converted = winning.filter((g) => scoreFor(g) === 1).length;
  const conversion = winning.length >= 2 ? converted / winning.length : null;
  // Out of the opening: your eval after move 12.
  const afterOpening = games.map((g) => { const m = g.analysis!.moves.find((x) => x.ply >= 23); return m ? Math.max(-600, Math.min(600, pov(g, m.evalAfter))) : null; }).filter((v): v is number => v !== null);
  const openingEval = afterOpening.length >= 3 ? avg(afterOpening) : null;
  // Errors on fast moves vs how often you move fast.
  const timed = games.flatMap((g) => user(g).filter((m) => m.timeMs !== undefined));
  const fastShare = timed.length >= 40 ? timed.filter((m) => m.timeMs! < 5000).length / timed.length : null;
  const errs = timed.filter(bad);
  const fastErrShare = errs.length >= 4 ? errs.filter((m) => m.timeMs! < 5000).length / errs.length : null;
  // Offence vs defence.
  const tagged = games.flatMap((g) => user(g).filter((m) => bad(m) && m.tags[0]));
  const off = tagged.filter((m) => OFFENCE.has(m.tags[0].key)).length;
  const def = tagged.filter((m) => DEFENCE.has(m.tags[0].key)).length;
  // First serious error (full move number).
  const firstErr = games.map((g) => user(g).find(bad)).filter(Boolean).map((m) => Math.floor(m!.ply / 2) + 1).sort((a, b) => a - b);
  const medianFirst = firstErr.length ? firstErr[Math.floor(firstErr.length / 2)] : null;
  // Colour split.
  const scoreAs = (c: 'w' | 'b') => { const gs = games.filter((g) => g.userColor === c && scoreFor(g) !== null); return gs.length >= 3 ? gs.reduce((a, g) => a + scoreFor(g)!, 0) / gs.length : null; };
  const sw = scoreAs('w'), sb = scoreAs('b');
  const tactical = attempts.filter((a) => a.kind === 'tactic' || a.kind === 'own_mistake');
  const tacticsRating = tactical.length >= 15 ? overallTrainingRating(tactical, rating) : null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const B = (key: string, label: string, you: number | null, tgt: number, better: 'up' | 'down', fmt: (v: number) => string, note: string): Benchmark =>
    ({ key, label, you, target: tgt, better, fmt, note, ok: you === null ? null : better === 'up' ? you >= tgt : you <= tgt });
  const benchmarks: Benchmark[] = [
    B('blunders', 'Blunders per game', blunders, 0.3, 'down', (v) => v.toFixed(2), 'At 2000 a blunder is rare: most games have none.'),
    B('mistakes', 'Mistakes per game', mistakes, 1.0, 'down', (v) => v.toFixed(1), 'Mistakes (and missed chances) about once a game.'),
    B('accuracy', 'Accuracy', accuracy, 85, 'up', (v) => `${v.toFixed(0)}%`, 'Engine accuracy, not a rating.'),
    B('opening', 'Opening accuracy', acc.opening, 88, 'up', (v) => `${v.toFixed(0)}%`, 'Coming out of the opening without damage.'),
    B('middlegame', 'Middlegame accuracy', acc.middlegame, 82, 'up', (v) => `${v.toFixed(0)}%`, 'Where tactics and plans decide.'),
    B('endgame', 'Endgame accuracy', acc.endgame, 85, 'up', (v) => `${v.toFixed(0)}%`, 'Technique: converting and holding.'),
    B('conversion', 'Winning positions converted', conversion, 0.85, 'up', pct, 'Once you are +3, a 2000 player almost always wins.'),
    B('tactics', 'Tactics training rating', tacticsRating, 1900, 'up', (v) => `${Math.round(v)}`, 'Puzzle strength from your exercises.'),
  ];

  // ---- findings
  const findings: Finding[] = [];
  const lessons = (keys: string[]) => principlesFor(keys).slice(0, 1).map((p) => ({ label: `Lesson: ${p.title}`, path: `principles/lesson/${p.id}` }));
  const train = (key: string) => ({ label: `Train: ${WEAKNESS[key]?.label ?? key}`, path: `training/session/weakness/${key}` });
  if (enough && blunders !== null && blunders > 0.3) {
    const defensive = def >= off;
    findings.push({
      key: 'blunders', weight: Math.min(1, blunders / 1.5),
      title: defensive ? 'You lose pieces to things your opponent can do' : 'Your blunders come from rushing your own ideas',
      detail: `${blunders.toFixed(1)} blunders per game (a 2000 player: about 0.3). Of your tagged errors, ${def} were about missing THEIR threats and ${off} about missing YOUR chances. ${defensive ? 'The fix is a blunder check before every move: their checks, captures and threats.' : 'The fix is calculation discipline: forcing moves first, then check their best reply.'}${medianFirst ? ` Your first serious error usually comes around move ${medianFirst}.` : ''}`,
      actions: [...lessons([defensive ? 'no_blunder_check' : 'poor_calculation']), train(defensive ? 'hanging_pieces' : 'missed_tactic')],
    });
  }
  const phases = (['opening', 'middlegame', 'endgame'] as const).filter((ph) => acc[ph] !== null);
  if (enough && phases.length >= 2) {
    const worst = phases.reduce((a, b) => (acc[a]! <= acc[b]! ? a : b));
    const best = phases.reduce((a, b) => (acc[a]! >= acc[b]! ? a : b));
    if (acc[best]! - acc[worst]! >= 5) {
      const act = worst === 'opening' ? [{ label: 'Openings: learn the plans', path: 'openings' }, ...lessons(['opening_unfamiliar'])]
        : worst === 'endgame' ? [{ label: 'Endgame training', path: 'training/session/endgame' }, ...lessons(['king_activity', 'rook_endgames'])]
        : [{ label: 'Tactics training', path: 'training/session/tactics' }, ...lessons(['missed_tactic'])];
      findings.push({ key: 'phase', weight: Math.min(1, (acc[best]! - acc[worst]!) / 20), title: `Your ${worst} is your weakest phase`,
        detail: `Accuracy: ${phases.map((p) => `${p} ${acc[p]!.toFixed(0)}%`).join(', ')}. Points lost in the ${worst} are the cheapest to win back.`, actions: act });
    }
  }
  if (conversion !== null && conversion < 0.85) {
    findings.push({ key: 'conversion', weight: (0.85 - conversion) * 1.5, title: 'You let winning positions slip',
      detail: `You reached a winning position (+3 or more) in ${winning.length} games and won ${converted}. Each thrown win is a full point; a 2000 player converts about 85-90%. Typical causes: rushing, allowing counterplay, trading pawns instead of pieces.`,
      actions: [...lessons(['conversion']), train('conversion')] });
  }
  if (fastShare !== null && fastErrShare !== null && fastErrShare > fastShare * 1.4 && fastErrShare >= 0.35) {
    findings.push({ key: 'fast', weight: 0.6, title: 'Your mistakes come on quick moves',
      detail: `${pct(fastErrShare)} of your mistakes were played in under 5 seconds, although only ${pct(fastShare)} of your moves are that fast. Slow down when pieces are in contact (captures, checks, threats).`,
      actions: [...lessons(['moving_fast']), train('moving_fast')] });
  }
  if (openingEval !== null && openingEval < -60) {
    findings.push({ key: 'opening_eval', weight: Math.min(1, -openingEval / 200), title: 'You leave the opening worse',
      detail: `After move 12 you are on average ${(openingEval / 100).toFixed(1)} (your point of view). Learn the ideas of 1-2 openings per colour so you reach a playable middlegame every game.`,
      actions: [{ label: 'Openings', path: 'openings' }, ...lessons(['opening_unfamiliar'])] });
  }
  if (sw !== null && sb !== null && Math.abs(sw - sb) >= 0.25) {
    const weak = sw < sb ? 'White' : 'Black';
    findings.push({ key: 'colour', weight: Math.abs(sw - sb), title: `You score much worse with ${weak}`,
      detail: `Score with White ${pct(sw)}, with Black ${pct(sb)}. Look at your ${weak} openings in the Openings performance tab.`, actions: [{ label: 'Opening performance', path: 'openings' }] });
  }
  if (tacticsRating !== null && tacticsRating < 1800) {
    findings.push({ key: 'tactics', weight: Math.min(1, (1900 - tacticsRating) / 600), title: 'Tactics are the biggest lever',
      detail: `Your exercise rating is about ${tacticsRating}. Below 2000, games are won and lost on tactics more than anything else: 20-30 focused puzzles a day, solved slowly and calculated to the end, move the needle fastest.`,
      actions: [{ label: 'Tactics training', path: 'training/session/tactics' }] });
  }
  for (const w of profile.top.slice(0, 2)) {
    if (findings.some((f) => f.actions.some((a) => a.path.endsWith(w.key)))) continue;
    findings.push({ key: 'w_' + w.key, weight: Math.min(0.9, w.priority / 3), title: `Recurring: ${w.label.toLowerCase()}`,
      detail: `${w.incidents} times in ${w.gamesAffected} games${w.inLosses ? `, ${w.inLosses} of them in games you lost` : ''}. ${WEAKNESS[w.key]?.lesson ?? ''}`, actions: [...lessons([w.key]), train(w.key)] });
  }
  findings.sort((a, b) => b.weight - a.weight);

  // ---- headline and a 7-day sprint
  const gap = Math.max(0, target - rating);
  const first = findings[0], second = findings[1];
  const headline = !enough
    ? `Play or import at least 3 games and I'll measure you against a 2000 player. For now: one lesson and 15 exercises a day.`
    : gap === 0 ? `You're at ${rating}: you've reached the target. Keep the habits, raise the goal.`
    : `You're about ${gap} points from ${target}. ${first ? `The fastest gain for you: ${first.title.toLowerCase()}.` : 'No single big leak: keep training broadly.'}${second ? ` After that: ${second.title.toLowerCase()}.` : ''}`;
  const focus = findings.slice(0, 2);
  const plan: Diagnosis['plan'] = [
    { day: 'Day 1', tasks: [focus[0]?.actions[0]?.label ?? 'Lesson: Checks, captures, threats', '15 exercises on your #1 weakness', 'One game at your recommended level, then review its critical moment'] },
    { day: 'Day 2', tasks: ['Daily challenge', focus[0]?.actions[1]?.label ?? 'Tactics: 20 puzzles, calculated to the end', 'Replay yesterday\'s mistakes (spaced repetition)'] },
    { day: 'Day 3', tasks: [focus[1]?.actions[0]?.label ?? 'Lesson: Improve your worst piece', 'Two games: before every move, do the blunder check', 'Review both games: read the "why it\'s better" for each mistake and play it out'] },
    { day: 'Day 4', tasks: ['Endgame: one theory position played out vs Stockfish', 'Daily challenge', 'Openings: practise one line of each repertoire opening'] },
    { day: 'Day 5', tasks: [focus[1]?.actions[1]?.label ?? 'Weakness training: your #2 priority', 'One longer game (15+10 or slower)', 'Review: find the moment you could have stopped their plan'] },
    { day: 'Day 6', tasks: ['Mixed tactics, slower: no move until you have checked their best reply', 'A lesson you haven\'t done yet', 'Your mistakes from this week'] },
    { day: 'Day 7', tasks: ['Two games', 'Check "Is it working?" on the dashboard: fewer blunders per game is the number to watch', 'Rest from puzzles; read the takeaways of this week\'s lessons'] },
  ];
  return { games: n, enough, rating, gap, benchmarks, findings: findings.slice(0, 5), headline, plan };
}
