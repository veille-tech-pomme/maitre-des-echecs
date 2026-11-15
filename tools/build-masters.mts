// Sélection de parties de champions du monde pour « Devine le coup » (src/data/masters.json, chargé à la demande).
import fs from 'node:fs';
import { Chess } from 'chess.js';
const PLAYERS: [string, string][] = [['Morphy', 'Morphy'], ['Anderssen', 'Anderssen'], ['Steinitz', 'Steinitz'], ['Lasker', 'Lasker, Emanuel'], ['Capablanca', 'Capablanca'], ['Alekhine', 'Alekhine'], ['Rubinstein', 'Rubinstein'], ['Botvinnik', 'Botvinnik'], ['Tal', 'Tal, Mihail'], ['Petrosian', 'Petrosian'], ['Spassky', 'Spassky'], ['Fischer', 'Fischer'], ['Karpov', 'Karpov'], ['Kasparov', 'Kasparov'], ['Carlsen', 'Carlsen']];
let seed = 3; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const out: any[] = [];
for (const [file, name] of PLAYERS) {
  const txt = fs.readFileSync(`tools/data/pgn/${file}.pgn`, 'latin1');
  const games = txt.split(/\n(?=\[Event )/).map((g) => { const h: Record<string, string> = {}; for (const m of g.matchAll(/\[(\w+) "([^"]*)"\]/g)) h[m[1]] = m[2]; return { h, mv: g.slice(g.lastIndexOf(']') + 1) }; });
  const cands = games.filter(({ h }) => (h.Result === '1-0' && h.White?.includes(name)) || (h.Result === '0-1' && h.Black?.includes(name)));
  let got = 0; const used = new Set<number>();
  while (got < 6 && used.size < cands.length) {
    const k = rnd(cands.length); if (used.has(k)) continue; used.add(k);
    const { h, mv } = cands[k]; const toks = mv.replace(/\{[^}]*\}/g, '').replace(/\([^)]*\)/g, '').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter((t) => t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t));
    if (toks.length < 40 || toks.length > 110) continue;
    const c = new Chess(); const sans: string[] = []; let ok = true; for (const t of toks) { try { sans.push(c.move(t).san); } catch { ok = false; break; } }
    if (!ok) continue;
    const side = h.Result === '1-0' ? 'w' : 'b';
    out.push({ w: h.White, b: h.Black, y: (h.Date || '').slice(0, 4), ev: h.Event, res: h.Result, side, hero: file, m: sans.join(' ') });
    got++;
  }
}
fs.writeFileSync('src/data/masters.json', JSON.stringify(out));
console.log(out.length, 'parties', (fs.statSync('src/data/masters.json').size / 1024).toFixed(0), 'Ko');
