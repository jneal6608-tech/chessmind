// Optional conversational coach powered by Claude. The model never evaluates
// positions on its own: it must call the local Stockfish tools, and the system
// prompt forbids evaluations that did not come from them. Without an API key
// the built-in coach (assistant.ts) is used instead.
import Anthropic from '@anthropic-ai/sdk';
import { Chess } from 'chess.js';
import type { UciEngine } from '../engine/uci';
import { scoreOf, formatScore } from '../engine/uci';
import { positionFacts, factsToText } from './position';
import { pvToSan, formatLine, fenAfter, sanOf, isSanePosition } from '../chess/util';
import { detectMotifs } from '../chess/motifs';
import { extractMove } from './assistant';
import type { CoachLevel } from './explain';

export interface LlmTurn { role: 'user' | 'assistant'; text: string }
export interface LlmContext { fen: string; level: CoachLevel; rating: number; profileText: string; gameText?: string }

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'analyze_position',
    description: 'Run Stockfish on a position (FEN). Returns the evaluation, the top 3 moves with lines, detected tactical ideas, threats, loose pieces, material, pawn structure and king safety. Use it for every claim about evaluation or best moves.',
    input_schema: { type: 'object', properties: { fen: { type: 'string', description: 'Position in FEN' } }, required: ['fen'], additionalProperties: false },
  },
  {
    name: 'evaluate_move',
    description: 'Evaluate one specific move (SAN like "Nf3" or UCI like "g1f3") in a position with Stockfish: evaluation after it, the best reply line, and how it compares to the best move.',
    input_schema: { type: 'object', properties: { fen: { type: 'string' }, move: { type: 'string' } }, required: ['fen', 'move'], additionalProperties: false },
  },
];

function systemPrompt(ctx: LlmContext) {
  const style = ctx.level === 'beginner'
    ? 'The player is about 1250 rated. Use plain words, short sentences and concrete squares. Avoid jargon; if you use a term (pin, fork, outpost), explain it in a few words.'
    : ctx.level === 'intermediate' ? 'The player is an intermediate club player (about 1500-1800). You may use standard chess terms and slightly longer variations.'
      : 'The player is an advanced club player (1850+). Discuss plans, prophylaxis and concrete variations.';
  return [
    'You are ChessMind, a patient chess coach. Your job is to help this player understand why moves are good or bad and how to recognise the patterns in their own games.',
    style,
    'Ground rules: every evaluation, best move or variation you state must come from a tool result in this conversation. Call analyze_position or evaluate_move before making such claims, and never invent numbers. If the tools do not settle a question, say so. Strategic explanations are welcome, but present them as general principles, not engine verdicts.',
    'Write SAN moves (e.g. Nf3, exd5). Keep answers focused: usually 2-6 short paragraphs or a short list. End with one concrete habit or question the player can use in their next game when it fits.',
    `Player's estimated strength: ${ctx.rating}.`,
    ctx.profileText ? `Their recurring weaknesses from analysed games:\n${ctx.profileText}` : '',
    ctx.gameText ? `Game context:\n${ctx.gameText}` : '',
  ].filter(Boolean).join('\n\n');
}

async function runTool(engine: UciEngine, name: string, input: Record<string, string>): Promise<string> {
  let fen = input.fen;
  if (!isSanePosition(fen)) return 'Error: invalid or illegal FEN.';
  fen = new Chess(fen).fen();
  if (name === 'analyze_position') return factsToText(await positionFacts(engine, fen, 14));
  if (name === 'evaluate_move') {
    const c = new Chess(fen);
    const uci = extractMove(c, input.move);
    if (!uci) return `Error: ${input.move} is not a legal move in this position. Legal moves: ${c.moves().join(' ')}`;
    const after = fenAfter(fen, uci)!;
    const sign = c.turn() === 'w' ? 1 : -1;
    const r0 = await engine.analyze(fen, { depth: 14, multipv: 1 });
    const best = r0.lines[0];
    if (new Chess(after).isGameOver()) return `${sanOf(fen, uci)} ends the game (${new Chess(after).isCheckmate() ? 'checkmate' : 'draw'}).`;
    const r = await engine.analyze(after, { depth: 14 });
    const v = -scoreOf(r.lines[0]) * sign;
    const bv = scoreOf(best) * sign;
    const reply = pvToSan(after, r.lines[0]?.pv ?? [], 6);
    return [
      `Move: ${sanOf(fen, uci)}. Evaluation after it (White's view): ${formatScore(v)}.`,
      `Best move: ${pvToSan(fen, [best.pv[0]])[0]} at ${formatScore(bv)} (difference ${(Math.abs(bv - v) / 100).toFixed(2)} pawns).`,
      `Best reply line: ${formatLine(after, reply)}.`,
      `Ideas of the move: ${detectMotifs(fen, uci).map((m) => m.text).join('; ') || 'none detected'}.`,
      `Ideas of the reply: ${r.lines[0]?.pv[0] ? detectMotifs(after, r.lines[0].pv[0]).map((m) => m.text).join('; ') || 'none detected' : 'n/a'}.`,
    ].join('\n');
  }
  return 'Unknown tool.';
}

export async function askClaude(apiKey: string, model: string, engine: UciEngine, ctx: LlmContext, history: LlmTurn[], question: string): Promise<string> {
  // The key stays in this browser and goes only to the Anthropic API.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.text }));
  messages.push({ role: 'user', content: `Current board position (FEN): ${ctx.fen}\n\n${question}` });
  const system = systemPrompt(ctx);
  for (let round = 0; round < 8; round++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model, max_tokens: 8000, system, tools: TOOLS, messages,
        output_config: { effort: 'medium' },
        // Server-side fallback: if a request is declined, the API retries on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('The API key was rejected. Check it in Settings.');
      if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the API. Try again in a minute.');
      if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach the Anthropic API (offline?). The built-in coach still works.');
      if (e instanceof Anthropic.APIError) throw new Error(`API error ${e.status}: ${e.message}`);
      throw e;
    }
    if (res.stop_reason === 'refusal') return 'The AI coach declined to answer that. Try rephrasing, or switch to the built-in coach.';
    messages.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) {
      return res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim() || '(no answer)';
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      try { results.push({ type: 'tool_result', tool_use_id: u.id, content: await runTool(engine, u.name, u.input as Record<string, string>) }); }
      catch (err) { results.push({ type: 'tool_result', tool_use_id: u.id, content: `Error: ${(err as Error).message}`, is_error: true }); }
    }
    messages.push({ role: 'user', content: results });
  }
  return 'The coach needed too many engine calls for this question; try asking something more specific.';
}
