// Audit Magnus B7 : tournoi de calibration des bots affaiblis à la main (Elo < 1450) contre des ancres Stockfish UCI_Elo.
// Chaque bot rencontre ses voisins de niveau et, à partir de 900, l'ancre Stockfish UCI_Elo 1320 (temps fixe 100 ms).
// Les Elo sont estimés par maximum de vraisemblance (Bradley–Terry, ancre fixée). Les bots ≥ 1450 SONT Stockfish UCI_Elo
// (Stockfish calibre lui-même cette échelle). Résultat : src/data/bot-calibration.json (affiché dans l'app).
// Usage : STOCKFISH=/tmp/sf npx tsx tools/calibrate-bots.mts [parties par paire=8] [parallèle=8]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { BOTS, type Bot } from '../src/data/bots';
import { botMove } from '../src/lib/bot-move';
const SF = process.env.STOCKFISH || '/tmp/sf';
const PER = +(process.argv[2] || 8), PAR = +(process.argv[3] || 8), ANCHOR = 1320, ANCHOR_MS = 100;
class Uci {
  p = spawn(SF, [], { stdio: ['pipe', 'pipe', 'ignore'] }); buf = ''; w: { re: RegExp; res: (l: string[]) => void }[] = []; lines: string[] = []; key = '';
  constructor() { this.p.stdout.on('data', (d) => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const l = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); this.lines.push(l); for (const x of [...this.w]) if (x.re.test(l)) { this.w.splice(this.w.indexOf(x), 1); x.res(this.lines.splice(0)); } } }); }
  send(s: string) { this.p.stdin.write(s + '\n'); }
  wait(re: RegExp) { return new Promise<string[]>((res) => this.w.push({ re, res })); }
  async init() { this.send('uci'); await this.wait(/^uciok/); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 16'); this.send('isready'); await this.wait(/^readyok/); return this; }
  async analyse(fen: string, o: { depth?: number; movetime?: number; multipv?: number; elo?: number } = {}) {
    const k = `${o.multipv || 1}|${o.elo || 0}`;
    if (k !== this.key) { this.key = k; this.send(`setoption name MultiPV value ${o.multipv || 1}`); this.send(`setoption name UCI_LimitStrength value ${o.elo ? 'true' : 'false'}`); if (o.elo) this.send(`setoption name UCI_Elo value ${Math.max(1320, o.elo)}`); }
    this.send(`position fen ${fen}`); this.send(o.depth ? `go depth ${o.depth}` : `go movetime ${o.movetime || 100}`);
    const ls = await this.wait(/^bestmove/); const pv: Record<string, any> = {};
    for (const l of ls) { const m = l.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (\S+)/); if (m && !/(lower|upper)bound/.test(l)) pv[m[1]] = { move: m[4], pv: l.split(' pv ')[1].split(' '), cp: m[2] === 'cp' ? +m[3] : null, mate: m[2] === 'mate' ? +m[3] : null, depth: 0, multipv: +m[1] }; }
    return { best: ls[ls.length - 1].split(' ')[1], lines: Object.values(pv), fen } as any;
  }
}
type P = { id: string; bot?: Bot; anchor?: number };
const players: P[] = BOTS.filter((b) => b.elo < 1450).sort((a, b) => a.elo - b.elo).map((b) => ({ id: b.id, bot: b }));
const anchor: P = { id: `sf${ANCHOR}`, anchor: ANCHOR };
const pairs: [P, P][] = [];
players.forEach((p, i) => { for (const d of [1, 2, 3]) if (players[i + d]) pairs.push([p, players[i + d]]); if (p.bot!.elo >= 900) pairs.push([p, anchor]); });
async function moveOf(p: P, eng: Uci, ch: Chess, hist: string[]) {
  if (p.anchor) return (await eng.analyse(ch.fen(), { movetime: ANCHOR_MS, elo: p.anchor })).best;
  const b = { ...p.bot!, movetime: p.bot!.movetime ? Math.min(p.bot!.movetime, 200) : undefined };
  return botMove(b, ch.fen(), hist, eng as any);
}
async function game(w: P, b: P, ew: Uci, eb: Uci, judge: Uci): Promise<number> {
  const ch = new Chess(); const hist: string[] = [];
  while (!ch.isGameOver() && hist.length < 240) {
    const p = ch.turn() === 'w' ? w : b; const u = await moveOf(p, ch.turn() === 'w' ? ew : eb, ch, hist);
    let m; try { m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { m = null; }
    if (!m) m = ch.move(ch.moves()[0]); hist.push(m.san);
  }
  if (ch.isCheckmate()) return ch.turn() === 'w' ? 0 : 1;
  if (ch.isGameOver()) return 0.5;
  const r = await judge.analyse(ch.fen(), { depth: 12 }); const l = r.lines[0]; const s = l ? (l.mate != null ? Math.sign(l.mate) * 9999 : l.cp) * (ch.turn() === 'w' ? 1 : -1) : 0;
  return s > 400 ? 1 : s < -400 ? 0 : 0.5; // arbitrage après 120 coups
}
const results: { a: string; b: string; s: number }[] = [];
const jobs: (() => Promise<void>)[] = [];
for (const [x, y] of pairs) for (let g = 0; g < PER; g++) jobs.push(async () => {});
let next = 0; const total = pairs.length * PER; let done = 0;
async function worker() {
  const e1 = await new Uci().init(), e2 = await new Uci().init(), ej = await new Uci().init();
  while (true) {
    const k = next++; if (k >= total) break;
    const [x, y] = pairs[Math.floor(k / PER)]; const white = k % 2 === 0 ? x : y; const black = white === x ? y : x;
    const s = await game(white, black, e1, e2, ej); results.push({ a: white.id, b: black.id, s });
    if (++done % 20 === 0) console.log(`${done}/${total}`);
  }
  for (const e of [e1, e2, ej]) e.send('quit');
}
const t0 = Date.now();
await Promise.all(Array.from({ length: PAR }, worker));
// Bradley–Terry (Elo) par maximum de vraisemblance, ancre fixe, a priori faible (σ 350) autour de l'Elo affiché
const R: Record<string, number> = { [anchor.id]: ANCHOR }; for (const p of players) R[p.id] = p.bot!.elo;
const prior = (id: string) => players.find((p) => p.id === id)!.bot!.elo; const SIG = 350;
const E = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400));
for (let it = 0; it < 3000; it++) {
  for (const p of players) {
    let g = -(R[p.id] - prior(p.id)) / (SIG * SIG) * (400 / Math.LN10) ** 2 / 400, h = 0;
    for (const r of results) { if (r.a !== p.id && r.b !== p.id) continue; const me = r.a === p.id; const o = me ? r.b : r.a; const s = me ? r.s : 1 - r.s; const e = E(R[p.id], R[o]); g += s - e; h += e * (1 - e); }
    R[p.id] += 40 * g / Math.max(1, h);
  }
}
const out: Record<string, { elo: number; games: number; score: number; se: number }> = {};
for (const p of players) {
  const mine = results.filter((r) => r.a === p.id || r.b === p.id); const sc = mine.reduce((t, r) => t + (r.a === p.id ? r.s : 1 - r.s), 0);
  const info = mine.reduce((t, r) => { const o = r.a === p.id ? r.b : r.a; const e = E(R[p.id], R[o]); return t + e * (1 - e); }, 0) * (Math.LN10 / 400) ** 2 + 1 / SIG ** 2;
  out[p.id] = { elo: Math.round(R[p.id] / 10) * 10, games: mine.length, score: +(sc / mine.length).toFixed(2), se: Math.round(1 / Math.sqrt(info)) };
  console.log(p.id.padEnd(12), String(p.bot!.elo).padStart(5), '→', out[p.id].elo, `±${out[p.id].se}`, `(${mine.length} parties, ${Math.round(100 * sc / mine.length)} %)`);
}
const date = new Date().toISOString().slice(0, 10);
writeFileSync('src/data/bot-calibration.json', JSON.stringify({ date, method: `Tournoi : chaque bot contre ses 3 voisins de niveau et, dès 900, contre Stockfish 17.1 UCI_Elo ${ANCHOR} (${ANCHOR_MS} ms/coup) ; ${PER} parties par paire, couleurs alternées ; Elo par maximum de vraisemblance (ancre fixe). Échelle Stockfish (proche des listes moteurs), pas un classement FIDE.`, games: results.length, bots: out }, null, 1));
console.log('parties', results.length, 'en', Math.round((Date.now() - t0) / 1000), 's');
