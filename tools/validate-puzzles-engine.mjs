// Vérifie chaque puzzle avec Stockfish : chaque coup de la solution doit être (quasi) le meilleur coup.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Uci, score } from './uci.mjs';
const puzzles = JSON.parse(fs.readFileSync('src/data/puzzles.json'));
const N = +(process.env.WORKERS || 6); const DEPTH = +(process.env.DEPTH || 12);
const bad = []; let done = 0;
async function worker(k) {
  const e = new Uci(); await e.init();
  for (let i = k; i < puzzles.length; i += N) {
    const p = puzzles[i]; const ch = new Chess(p.f); const ms = p.m.split(' ');
    const mv = u => ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    mv(ms[0]);
    for (let j = 1; j < ms.length; j += 2) {
      const sol = ms[j];
      const r = await e.analyse(ch.fen(), { depth: DEPTH, multipv: 2 });
      const best = r.lines[0]; const solLine = r.lines.find(l => l.move === sol);
      let ok;
      if (best.move === sol) ok = true;
      else if (solLine) ok = (best.mate != null && best.mate > 0 && solLine.mate != null && solLine.mate > 0) || score(best) - score(solLine) < 60;
      else { const r2 = await e.analyse(ch.fen(), { depth: DEPTH, searchmoves: [sol] }); const s = r2.lines[0];
        ok = s && ((best.mate > 0 && s.mate > 0) || score(best) - score(s) < 60); }
      const tmp = new Chess(ch.fen()); tmp.move({ from: sol.slice(0, 2), to: sol.slice(2, 4), promotion: sol[4] });
      if (tmp.isCheckmate()) ok = true;
      if (!ok) { bad.push(p.i); break; }
      mv(sol); if (ms[j + 1]) mv(ms[j + 1]);
    }
    done++; if (done % 500 === 0) console.log(`${done}/${puzzles.length}…`);
  }
  e.quit();
}
await Promise.all([...Array(N)].map((_, k) => worker(k)));
console.log(`Validation Stockfish profondeur ${DEPTH}: ${puzzles.length - bad.length}/${puzzles.length} confirmés, ${bad.length} douteux`);
fs.writeFileSync('tools/data/puzzles_doubtful.json', JSON.stringify(bad));
if (process.argv.includes('--prune') && bad.length) {
  const kept = puzzles.filter(p => !bad.includes(p.i)); fs.writeFileSync('src/data/puzzles.json', JSON.stringify(kept)); console.log('retirés:', bad.length, '→', kept.length);
}
