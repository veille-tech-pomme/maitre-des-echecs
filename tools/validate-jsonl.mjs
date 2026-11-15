// Valide un fichier JSONL de puzzles : légalité chess.js + chaque coup de la solution confirmé par Stockfish.
// Usage : node tools/validate-jsonl.mjs entrée.jsonl sortie.jsonl [profondeur] [workers]   (reprise possible)
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { Uci, score } from './uci.mjs';
const [, , IN, OUT, D = '12', W = '7'] = process.argv; const DEPTH = +D, N = +W;
const all = fs.readFileSync(IN, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const doneIds = new Set();
for (const f of [OUT, OUT + '.rejected']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) doneIds.add(JSON.parse(l).i);
const todo = all.filter((p) => !doneIds.has(p.i));
console.log(`${all.length} puzzles, ${todo.length} à valider (profondeur ${DEPTH}, ${N} workers)`);
const okOut = fs.createWriteStream(OUT, { flags: 'a' }), koOut = fs.createWriteStream(OUT + '.rejected', { flags: 'a' });
let done = 0, rejected = 0; const t0 = Date.now();
function legal(p) {
  try { const ch = new Chess(p.f); for (const u of p.m.split(' ')) if (!ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) return false; return true; } catch { return false; }
}
async function check(e, p) {
  const ch = new Chess(p.f); const ms = p.m.split(' ');
  const mv = (u) => ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  mv(ms[0]);
  for (let j = 1; j < ms.length; j += 2) {
    const sol = ms[j];
    const tmp = new Chess(ch.fen()); tmp.move({ from: sol.slice(0, 2), to: sol.slice(2, 4), promotion: sol[4] });
    if (!tmp.isCheckmate()) {
      const r = await e.analyse(ch.fen(), { depth: DEPTH, multipv: 2 });
      const best = r.lines[0]; let s = r.lines.find((l) => l.move === sol);
      if (!best) return false;
      if (best.move !== sol) {
        if (!s) { const r2 = await e.analyse(ch.fen(), { depth: DEPTH, searchmoves: [sol] }); s = r2.lines[0]; }
        if (!s) return false;
        const ok = (best.mate > 0 && s.mate > 0) || score(best) - score(s) < 60;
        if (!ok) return false;
      }
    }
    mv(sol); if (ms[j + 1]) mv(ms[j + 1]);
  }
  return true;
}
let next = 0;
async function worker() {
  const e = new Uci(); await e.init();
  while (next < todo.length) {
    const p = todo[next++];
    const ok = legal(p) && (await check(e, p));
    (ok ? okOut : koOut).write(JSON.stringify(ok ? p : { i: p.i }) + '\n'); if (!ok) rejected++;
    if (++done % 2000 === 0) console.log(`${done}/${todo.length} (${rejected} rejetés) ${((Date.now() - t0) / 1000) | 0}s`);
  }
  e.quit();
}
await Promise.all([...Array(N)].map(worker));
okOut.end(); koOut.end();
console.log(`Terminé : ${done} traités, ${rejected} rejetés`);
