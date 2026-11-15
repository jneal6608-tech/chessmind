// UCI protocol client for Stockfish. Transport-agnostic: a Web Worker in the
// browser, a child process in Node (tests and build scripts).
export interface EvalLine {
  /** Centipawns from the side to move's point of view (absent when mate is set). */
  cp?: number;
  /** Mate in N (positive: side to move mates; negative: gets mated). */
  mate?: number;
  pv: string[];
  depth: number;
}
export interface AnalyzeOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  searchmoves?: string[];
  onInfo?: (lines: EvalLine[]) => void;
}
export interface AnalyzeResult {
  lines: EvalLine[];
  bestmove: string | null;
  /** First move of the main line at each completed depth (how early the engine "sees" it). */
  depthTrail: string[];
}
export interface Transport {
  post(cmd: string): void;
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

/** One number for a line: centipawns, with mates mapped near +/-10000. Side to move's view. */
export function scoreOf(l: EvalLine | undefined): number {
  if (!l) return 0;
  if (l.mate !== undefined) return l.mate > 0 ? 10000 - l.mate * 10 : l.mate < 0 ? -10000 - l.mate * 10 : -10000;
  return Math.max(-9000, Math.min(9000, l.cp ?? 0));
}
/** Winning chances in percent (0-100) for a centipawn score: the Lichess logistic model. */
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-2000, Math.min(2000, cp)))) - 1);
}
export function formatScore(cpWhite: number): string {
  if (Math.abs(cpWhite) >= 9000) {
    const n = Math.max(1, Math.round((10000 - Math.abs(cpWhite)) / 10));
    return (cpWhite > 0 ? '+' : '-') + 'M' + n;
  }
  const v = cpWhite / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

export class EngineCancelled extends Error { constructor() { super('cancelled'); } }

export class UciEngine {
  private t: Transport | null = null;
  private ready: Promise<void> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private handler: ((line: string) => void) | null = null;
  private generation = 0;
  private opts: Record<string, string> = {};
  public name = '';
  constructor(private make: () => Transport) {}

  get running() { return this.t !== null; }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let t: Transport;
      try { t = this.make(); } catch (e) { reject(e); return; }
      this.t = t;
      const timer = setTimeout(() => reject(new Error('Stockfish did not start within 30 seconds')), 30000);
      let stage = 0;
      t.onLine((line) => {
        if (stage === 0) {
          if (line.startsWith('id name')) this.name = line.slice(8);
          if (line === 'uciok') { stage = 1; t.post('setoption name Hash value 32'); t.post('isready'); }
        } else if (stage === 1) {
          if (line === 'readyok') { stage = 2; clearTimeout(timer); resolve(); }
        } else this.handler?.(line);
      });
      t.post('uci');
    });
    this.ready.catch(() => { this.ready = null; this.t = null; });
    return this.ready;
  }

  private setOption(name: string, value: string | number) {
    const v = String(value);
    if (this.opts[name] === v) return;
    this.opts[name] = v;
    this.t!.post(`setoption name ${name} value ${v}`);
  }

  /** Search one position. Calls are queued; each resolves when the engine reports bestmove. */
  analyze(fen: string, o: AnalyzeOptions = {}): Promise<AnalyzeResult> {
    const gen = this.generation;
    const run = async (): Promise<AnalyzeResult> => {
      if (gen !== this.generation) throw new EngineCancelled();
      await this.init();
      if (gen !== this.generation) throw new EngineCancelled();
      const t = this.t!;
      this.setOption('MultiPV', o.multipv ?? 1);
      const lines: EvalLine[] = [];
      const depthTrail: string[] = [];
      return new Promise<AnalyzeResult>((resolve) => {
        this.handler = (line) => {
          if (line.startsWith('info') && line.includes(' pv ')) {
            const info = parseInfo(line);
            if (!info) return;
            lines[info.idx] = info.line;
            if (info.idx === 0) depthTrail[info.line.depth] = info.line.pv[0];
            o.onInfo?.(lines.filter(Boolean));
          } else if (line.startsWith('bestmove')) {
            this.handler = null;
            const bm = line.split(' ')[1];
            resolve({ lines: lines.filter(Boolean), bestmove: !bm || bm === '(none)' ? null : bm, depthTrail });
          }
        };
        t.post(`position fen ${fen}`);
        let go = 'go';
        if (o.depth) go += ` depth ${o.depth}`;
        if (o.movetime) go += ` movetime ${o.movetime}`;
        if (!o.depth && !o.movetime) go += ' depth 12';
        if (o.searchmoves?.length) go += ` searchmoves ${o.searchmoves.join(' ')}`;
        t.post(go);
      });
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  /** Ask the current search to finish now (its promise resolves with what it has). */
  stop() { this.t?.post('stop'); }
  /** Drop every queued search and stop the running one. */
  cancelAll() { this.generation++; this.stop(); }
  newGame() { if (this.t) { this.t.post('ucinewgame'); } }
  terminate() {
    this.generation++;
    try { this.t?.post('quit'); } catch { /* already gone */ }
    this.t?.terminate();
    this.t = null; this.ready = null; this.handler = null; this.opts = {};
    this.chain = Promise.resolve();
  }
}

function parseInfo(line: string): { idx: number; line: EvalLine } | null {
  if (line.includes('upperbound') || line.includes('lowerbound')) return null;
  const tok = line.split(' ');
  let depth = 0, idx = 0, cp: number | undefined, mate: number | undefined, pv: string[] = [];
  for (let i = 1; i < tok.length; i++) {
    const k = tok[i];
    if (k === 'depth') depth = Number(tok[++i]);
    else if (k === 'multipv') idx = Number(tok[++i]) - 1;
    else if (k === 'score') { const kind = tok[++i]; const v = Number(tok[++i]); if (kind === 'cp') cp = v; else mate = v; }
    else if (k === 'pv') { pv = tok.slice(i + 1); break; }
  }
  if (!pv.length) return null;
  return { idx, line: { cp, mate, pv, depth } };
}
