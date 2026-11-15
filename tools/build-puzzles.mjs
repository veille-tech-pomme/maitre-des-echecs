// Construit src/data/puzzles.json à partir de la sélection Lichess (CC0) et valide chaque solution avec chess.js.
import { Chess } from 'chess.js';
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(new URL('./data/puzzles_selected.json', import.meta.url)));
const out = []; let rejected = 0;
for (const [id, fen, moves, rating, themes] of src) {
  const ch = new Chess(fen); const ms = moves.split(' '); let ok = true;
  for (const u of ms) {
    try { ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { ok = false; break; }
  }
  const th = themes.split(' ');
  if (ok && th.includes('mate') && !ch.isCheckmate()) ok = false;
  if (ok && ms.length % 2 !== 0) ok = false; // setup move + paires
  if (!ok) { rejected++; continue; }
  out.push({ i: id, f: fen, m: moves, r: rating, t: th.filter(x => !['short','long','veryLong','oneMove','master','masterVsMaster','superGM','crushing','advantage'].includes(x)) });
}
fs.writeFileSync(new URL('../src/data/puzzles.json', import.meta.url), JSON.stringify(out));
console.log(`puzzles: ${out.length} valides, ${rejected} rejetés`);
