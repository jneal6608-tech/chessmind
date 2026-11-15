// Builds src/data/openings.json from the Lichess chess-openings tables (CC0):
// position key (FEN without move counters) -> [eco, name, ply count, uci moves].
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
const out = {};
for (const f of 'abcde') {
  const rows = readFileSync(`data-src/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const c = new Chess();
    c.loadPgn(pgn);
    const uci = c.history({ verbose: true }).map((m) => m.lan);
    const key = c.fen().split(' ').slice(0, 4).join(' ');
    if (!out[key] || out[key][2] > uci.length) out[key] = [eco, name, uci.length, uci.join(' ')];
  }
}
writeFileSync('src/data/openings.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'positions');
