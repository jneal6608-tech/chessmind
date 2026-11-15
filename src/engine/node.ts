// Stockfish as a child process, for tests and the puzzle generator.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { UciEngine, type Transport } from './uci';

export function nodeEngine(): UciEngine {
  return new UciEngine((): Transport => {
    const require = createRequire(import.meta.url);
    const path = require.resolve('stockfish/bin/stockfish-19-lite-single.js');
    const child = spawn(process.execPath, [path], { stdio: ['pipe', 'pipe', 'ignore'] });
    let cb: (l: string) => void = () => undefined;
    let buf = '';
    child.stdout.on('data', (d: Buffer) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) cb(line); }
    });
    return { post: (c) => { child.stdin.write(c + '\n'); }, onLine: (f) => { cb = f; }, terminate: () => child.kill() };
  });
}
