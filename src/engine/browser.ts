// Stockfish WebAssembly in a Web Worker (single-threaded "lite" build: works on
// any static host and on Chromebooks, no cross-origin isolation headers needed).
import { UciEngine, type Transport } from './uci';

function workerTransport(): Transport {
  const url = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;
  const w = new Worker(url);
  let cb: (l: string) => void = () => undefined;
  w.onmessage = (e) => {
    const d = typeof e.data === 'string' ? e.data : String(e.data ?? '');
    for (const line of d.split('\n')) if (line) cb(line.trim());
  };
  return { post: (c) => w.postMessage(c), onLine: (f) => { cb = f; }, terminate: () => w.terminate() };
}

/** Independent engines, so nothing waits behind something else:
 *  play (opponent and endgame play-outs), analysis (background game reviews),
 *  coach (live lines, questions, exercise checking). Each starts on first use. */
export const playEngine = new UciEngine(workerTransport);
export const analysisEngine = new UciEngine(workerTransport);
export const coachEngine = new UciEngine(workerTransport);
export const allEngines = [playEngine, analysisEngine, coachEngine];
