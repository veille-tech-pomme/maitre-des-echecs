// Construit src/data/eco.json à partir du jeu de données Lichess chess-openings (CC0) avec noms français.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { openingFr } from '../src/data/opening-fr.ts';
const out = []; let bad = 0;
for (const f of 'abcde') {
  const rows = fs.readFileSync(`tools/data/openings/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
  for (const r of rows) {
    const [eco, name, pgn] = r.split('\t');
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
    const c = new Chess(); let ok = true;
    for (const s of sans) { try { c.move(s); } catch { ok = false; break; } }
    if (!ok) { bad++; continue; }
    out.push([eco, openingFr(name), sans.join(' ')]);
  }
}
out.sort((a, b) => a[2].localeCompare(b[2]));
fs.writeFileSync('src/data/eco.json', JSON.stringify(out));
console.log(out.length, 'lignes, rejetées', bad, (fs.statSync('src/data/eco.json').size / 1024).toFixed(0) + ' Ko');
