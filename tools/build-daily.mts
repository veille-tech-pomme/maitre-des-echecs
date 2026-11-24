// Calendrier FIGÉ du Coup du jour (plan §2.2) : public/daily/<année>.json, une entrée par jour
// {n, date, puzzleId, fen, moves, rating, theme}. Source : puzzles Lichess (CC0) déjà validés au moteur
// (tools/data/core_valid.jsonl + extra_valid.jsonl), Popularity ≥ 90, ≥ 1000 parties, RD ≤ 80, 2 à 4 coups du joueur,
// thème spectaculaire (mat, sacrifice, coup tranquille…). Difficulté de la semaine : lundi ≈ 1000 → dimanche ≈ 1900.
// APPEND-ONLY : une année déjà publiée n'est jamais réécrite (sinon le n° ne désignerait plus la même position).
// Usage : npx -y tsx tools/build-daily.mts [annéeFin=2028] [--force]
import fs from 'node:fs';
import readline from 'node:readline';
import { Chess } from 'chess.js';
import { DAILY_EPOCH, dateOf, numberOf, weekdayTarget, type DailyEntry } from '../src/lib/daily';

const END = +(process.argv.find((a) => /^\d{4}$/.test(a)) || 2028), FORCE = process.argv.includes('--force');
const D = 'tools/data/', OUT = 'public/daily/';
const SPEC = ['smotheredMate', 'doubleCheck', 'sacrifice', 'quietMove', 'deflection', 'attraction', 'clearance', 'interference', 'xRayAttack'];
const MATES = ['mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5'];
const primary = (t: string[]) => MATES.find((m) => t.includes(m)) || SPEC.find((s) => t.includes(s)) || '';
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const valid = new Map<string, any>();
for (const f of ['core_valid.jsonl', 'extra_valid.jsonl']) for (const l of fs.readFileSync(D + f, 'utf8').split('\n')) if (l) { const o = JSON.parse(l); valid.set(o.i, o); }
const pool: any[] = [];
const rl = readline.createInterface({ input: fs.createReadStream(D + 'puzzles_big.csv') });
let head = true;
for await (const line of rl) {
  if (head) { head = false; continue; }
  const c = line.split(','); const o = valid.get(c[0]); if (!o) continue;
  const [rd, pop, plays] = [+c[4], +c[5], +c[6]];
  const pm = Math.floor(o.m.split(' ').length / 2);
  if (pop < 90 || plays < 1000 || rd > 80 || pm < 2 || pm > 4) continue;
  const th = primary(o.t); if (!th) continue;
  pool.push({ ...o, th });
}
console.error('candidats', pool.length);
// déjà publiés : jamais réécrits, et leurs puzzles ne reviennent pas
const used = new Set<string>(); const published = new Map<number, DailyEntry[]>();
for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) { const y = +f.slice(0, 4); const list: DailyEntry[] = JSON.parse(fs.readFileSync(OUT + f, 'utf8')); published.set(y, list); list.forEach((e) => used.add(e.puzzleId)); }
let prevTheme = '';
for (let y = +DAILY_EPOCH.slice(0, 4); y <= END; y++) {
  if (published.has(y) && !FORCE) { prevTheme = published.get(y)!.at(-1)!.theme; console.error(y, 'déjà publié, conservé'); continue; }
  const out: DailyEntry[] = [];
  const start = y === +DAILY_EPOCH.slice(0, 4) ? DAILY_EPOCH : `${y}-01-01`;
  for (let n = numberOf(start); dateOf(n).startsWith(String(y)); n++) {
    const date = dateOf(n); const target = weekdayTarget(date);
    let w = 40, cands: any[] = [];
    while (!cands.length) { cands = pool.filter((p) => !used.has(p.i) && Math.abs(p.r - target) <= w && p.th !== prevTheme); w += 40; }
    cands.sort((a, b) => hash('jour-' + date + a.i) - hash('jour-' + date + b.i));
    const p = cands[0];
    const ch = new Chess(p.f); for (const u of p.m.split(' ')) ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); // lève une erreur si illégal
    used.add(p.i); prevTheme = p.th;
    out.push({ n, date, puzzleId: p.i, fen: p.f, moves: p.m, rating: p.r, theme: p.th });
  }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + y + '.json', JSON.stringify(out));
  console.error(y, out.length, 'jours', out[0].n, '→', out.at(-1)!.n);
}
