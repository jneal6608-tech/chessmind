// Engine-backed facts about one position, shared by the built-in coach and the
// optional Claude coach (which may only cite these facts).
import { Chess } from 'chess.js';
import type { UciEngine } from '../engine/uci';
import { scoreOf, formatScore } from '../engine/uci';
import { pvToSan, formatLine, nullMoveFen, phaseOf, material, pawnInfo, findKing, kingShield, colorName, pieces, isDefended, VAL, PIECE_NAME } from '../chess/util';
import { detectLineMotifs, detectMotifs } from '../chess/motifs';
import { lookupOpening } from '../openings/identify';

export interface PositionFacts {
  fen: string;
  turn: string;
  phase: string;
  evalWhite: number;
  evalText: string;
  depth: number;
  bestMoves: { san: string; uci: string; eval: string; line: string; ideas: string[] }[];
  threat?: { san: string; ideas: string[]; gain: string };
  loosePieces: string[];
  material: string;
  pawns: string;
  kingSafety: string;
  opening?: string;
  status?: string;
}

export async function positionFacts(engine: UciEngine, fen: string, depth = 14): Promise<PositionFacts> {
  const c = new Chess(fen);
  const turn = c.turn();
  const facts: PositionFacts = {
    fen, turn: colorName(turn), phase: phaseOf(fen), evalWhite: 0, evalText: '', depth, bestMoves: [], loosePieces: [], material: '', pawns: '', kingSafety: '',
  };
  if (c.isGameOver()) {
    facts.status = c.isCheckmate() ? `Checkmate: ${colorName(turn === 'w' ? 'b' : 'w')} has won.` : 'The game is drawn (stalemate, repetition, or insufficient material).';
    return facts;
  }
  const r = await engine.analyze(fen, { depth, multipv: 3 });
  const sign = turn === 'w' ? 1 : -1;
  facts.evalWhite = scoreOf(r.lines[0]) * sign;
  facts.evalText = formatScore(facts.evalWhite);
  facts.bestMoves = r.lines.map((l) => {
    const sans = pvToSan(fen, l.pv, 8);
    return { san: sans[0], uci: l.pv[0], eval: formatScore(scoreOf(l) * sign), line: formatLine(fen, sans), ideas: detectLineMotifs(fen, l.pv).motifs.map((m) => m.text) };
  });
  const nm = nullMoveFen(fen);
  if (nm) {
    const t = (await engine.analyze(nm, { depth: Math.min(12, depth) })).lines[0];
    if (t) {
      const gain = scoreOf(t) + scoreOf(r.lines[0]);
      if (gain >= 120) facts.threat = { san: pvToSan(nm, [t.pv[0]])[0], ideas: detectMotifs(nm, t.pv[0]).map((m) => m.text), gain: (gain / 100).toFixed(1) };
    }
  }
  for (const p of pieces(c)) {
    if (p.type === 'k' || p.type === 'p') continue;
    const attacked = c.attackers(p.square, p.color === 'w' ? 'b' : 'w').length > 0;
    if (attacked && !isDefended(c, p.square, p.color)) facts.loosePieces.push(`${colorName(p.color)} ${PIECE_NAME[p.type]} on ${p.square} is attacked and undefended`);
  }
  const m = material(c);
  const diff = m.w - m.b;
  facts.material = diff === 0 ? 'Material is level.' : `${diff > 0 ? 'White' : 'Black'} is up ${Math.abs(diff)} point${Math.abs(diff) === 1 ? '' : 's'} of material.`;
  const pw = pawnInfo(c, 'w'), pb = pawnInfo(c, 'b');
  const desc = (n: string, p: typeof pw) => `${n}: ${p.islands} pawn island${p.islands === 1 ? '' : 's'}${p.doubled ? `, ${p.doubled} doubled` : ''}${p.isolated ? `, ${p.isolated} isolated` : ''}${p.passed.length ? `, passed pawn${p.passed.length > 1 ? 's' : ''} on ${p.passed.join(', ')}` : ''}`;
  facts.pawns = `${desc('White', pw)}. ${desc('Black', pb)}.`;
  facts.kingSafety = `White king on ${findKing(c, 'w')} (${kingShield(c, 'w')} shield pawns), Black king on ${findKing(c, 'b')} (${kingShield(c, 'b')} shield pawns).`;
  facts.opening = lookupOpening(fen)?.name;
  void VAL;
  return facts;
}

export function factsToText(f: PositionFacts): string {
  if (f.status) return `${f.status} FEN: ${f.fen}`;
  const lines = [
    `FEN: ${f.fen}`, `${f.turn} to move. Phase: ${f.phase}.${f.opening ? ` Opening: ${f.opening}.` : ''}`,
    `Stockfish (depth ${f.depth}) evaluation: ${f.evalText} (White's view, pawns).`,
    ...f.bestMoves.map((b, i) => `Engine choice ${i + 1}: ${b.san} (${b.eval}). Line: ${b.line}.${b.ideas.length ? ' Detected ideas: ' + b.ideas.join('; ') + '.' : ''}`),
    f.threat ? `Threat if ${f.turn} passed: ${f.threat.san} (worth about ${f.threat.gain} pawns).${f.threat.ideas.length ? ' ' + f.threat.ideas.join('; ') + '.' : ''}` : 'No major threat from the opponent right now.',
    f.loosePieces.length ? `Loose pieces: ${f.loosePieces.join('; ')}.` : 'No attacked undefended pieces.',
    f.material, `Pawns: ${f.pawns}`, `Kings: ${f.kingSafety}`,
  ];
  return lines.join('\n');
}
