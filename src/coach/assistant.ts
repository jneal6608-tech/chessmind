// The built-in coach: answers common questions about a position from engine
// facts, with no external service. Unknown questions get the full summary.
import { Chess } from 'chess.js';
import type { UciEngine } from '../engine/uci';
import { scoreOf, formatScore } from '../engine/uci';
import { positionFacts, type PositionFacts } from './position';
import { sanOf, pvToSan, formatLine, colorName, fenAfter } from '../chess/util';
import { detectMotifs } from '../chess/motifs';
import { verdictWords, type CoachLevel } from './explain';

export interface CoachReply { text: string; arrows?: { from: string; to: string; color: string }[]; facts?: PositionFacts }

export async function answer(engine: UciEngine, fen: string, question: string, level: CoachLevel): Promise<CoachReply> {
  const q = question.toLowerCase();
  const c = new Chess(fen);
  const facts = await positionFacts(engine, fen, 14);
  if (facts.status) return { text: facts.status, facts };
  const side = c.turn();
  const best = facts.bestMoves[0];
  const arrows = [{ from: best.uci.slice(0, 2), to: best.uci.slice(2, 4), color: 'green' }];
  // "Why is Nf3 bad / what about Nf3 / is Nf3 good"
  const moveAsked = extractMove(c, question);
  if (moveAsked) {
    const uci = moveAsked;
    const san = sanOf(fen, uci);
    const after = fenAfter(fen, uci)!;
    const r = await engine.analyze(after, { depth: 14, multipv: 1 });
    const sign = side === 'w' ? 1 : -1;
    const v = -scoreOf(r.lines[0]) * sign; // white view
    const bestV = facts.evalWhite;
    const loss = (bestV - v) * sign;
    const reply = pvToSan(after, r.lines[0]?.pv ?? [], 6);
    const motifs = detectMotifs(fen, uci).map((m) => m.text);
    const refute = r.lines[0]?.pv[0] ? detectMotifs(after, r.lines[0].pv[0]).map((m) => m.text) : [];
    let t = `${san}: the engine gives ${formatScore(v)} after it, so ${verdictWords(v, side)}. `;
    if (best.uci === uci) t += 'That is the engine\'s top choice. ';
    else if (loss < 30) t += `That is about as good as the top choice ${best.san} (${best.eval}). `;
    else t += `The top choice ${best.san} is ${(loss / 100).toFixed(1)} pawns better (${best.eval}). `;
    if (motifs.length) t += `What ${san} does: ${motifs.join('; ')}. `;
    if (reply.length && loss >= 30) t += `The best reply is ${formatLine(after, reply.slice(0, level === 'beginner' ? 3 : 6))}${refute.length ? `: ${refute.join('; ')}` : ''}.`;
    arrows.push({ from: uci.slice(0, 2), to: uci.slice(2, 4), color: loss >= 100 ? 'red' : 'blue' });
    return { text: t.trim(), arrows, facts };
  }
  if (/threat|threaten|danger|attack(ing)? me|what does .* want/.test(q)) {
    if (!facts.threat) return { text: `There is no serious threat right now: if ${colorName(side)} passed, the opponent would gain less than a pawn. ${facts.loosePieces.length ? 'But watch: ' + facts.loosePieces.join('; ') + '.' : ''}`, facts };
    return { text: `The threat is ${facts.threat.san}${facts.threat.ideas.length ? ': ' + facts.threat.ideas.join('; ') : ''}. It would be worth about ${facts.threat.gain} pawns. The engine deals with it by ${best.san}.`, arrows, facts };
  }
  if (/plan|idea|strateg|what should i do|how (do|should) i (continue|play)/.test(q)) {
    const t = [`${verdictWords(facts.evalWhite, side)[0].toUpperCase()}${verdictWords(facts.evalWhite, side).slice(1)} (${facts.evalText}).`];
    if (facts.threat) t.push(`First, handle the threat ${facts.threat.san}.`);
    t.push(`Engine's main line: ${best.line}.`);
    if (best.ideas.length) t.push(`The idea: ${best.ideas.join('; ')}.`);
    t.push(`Structure: ${facts.pawns}`);
    t.push(planHints(facts, side));
    return { text: t.join(' '), arrows, facts };
  }
  if (/eval|who is (better|winning)|score/.test(q)) {
    return { text: `Stockfish at depth ${facts.depth}: ${facts.evalText}. ${verdictWords(facts.evalWhite, side)[0].toUpperCase() + verdictWords(facts.evalWhite, side).slice(1)}. ${facts.material}`, facts };
  }
  // Default: best move with reasons
  const alts = facts.bestMoves.slice(1).map((b) => `${b.san} (${b.eval})`).join(', ');
  let t = `Best is ${best.san} (${best.eval})${best.ideas.length ? ': ' + best.ideas.join('; ') : ''}. Line: ${best.line}.`;
  if (alts) t += ` Alternatives: ${alts}.`;
  if (facts.threat) t += ` Your opponent threatens ${facts.threat.san}.`;
  if (facts.loosePieces.length) t += ` Loose pieces: ${facts.loosePieces.join('; ')}.`;
  return { text: t, arrows, facts };
}

function planHints(f: PositionFacts, side: 'w' | 'b'): string {
  if (f.phase === 'opening') return 'Opening priorities: develop the remaining pieces, castle, connect the rooks.';
  if (f.phase === 'endgame') return 'Endgame priorities: activate the king, create or push passed pawns, put rooks behind passed pawns.';
  const mine = side === 'w' ? 'White' : 'Black';
  return `Middlegame: improve your least active piece and look for pawn breaks; keep ${mine}'s king safe.`;
}

/** Finds a move written in the question ("Nf3", "e4", "Bxf7+", "e2e4"). */
export function extractMove(c: Chess, text: string): string | null {
  const legal = c.moves({ verbose: true });
  const tokens = text.replace(/[?!.,]/g, ' ').split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const clean = t.replace(/[+#]/g, '');
    const m = legal.find((x) => x.san.replace(/[+#]/g, '') === clean || x.lan === clean.toLowerCase());
    if (m && clean.length >= 2) return m.lan;
  }
  return null;
}
