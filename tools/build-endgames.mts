// Vérifie les nouvelles finales (tablebases Lichess ≤ 7 pièces, Stockfish au-delà), génère des séries d'entraînement,
// et écrit src/data/endgames-extra.json. Cache : tools/data/tb-cache.json.
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { DRAFTS, type Draft } from './content/endgames-new';
// @ts-ignore
import { Uci, score } from './uci.mjs';
const CACHE = 'tools/data/tb-cache.json';
const cache: Record<string, any> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tb(fen: string) {
  if (cache[fen]) return cache[fen];
  for (let t = 0; t < 5; t++) {
    const r = await fetch('https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(fen));
    if (r.status === 429) { await sleep(60000); continue; }
    if (r.status === 400) { cache[fen] = { category: 'invalide' }; return cache[fen]; }
    if (!r.ok) { console.log('tb', r.status, fen); await sleep(3000); continue; }
    const j = await r.json(); cache[fen] = { category: j.category, dtm: j.dtm, dtz: j.dtz, best: j.moves?.[0]?.san }; await sleep(350); return cache[fen];
  }
  throw new Error('tablebase injoignable');
}
const pieces = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
const uci = new Uci(); await uci.init();
const out: any[] = []; const dropped: string[] = [];
function want(goal: string) { return goal === 'draw' ? ['draw', 'blessed-loss', 'cursed-win'] : ['win']; }
async function verify(d: Draft): Promise<{ ok: boolean; info: any }> {
  try { new Chess(d.fen); } catch { return { ok: false, info: 'FEN illégale' }; }
  const c = new Chess(d.fen); if (c.isGameOver()) return { ok: false, info: 'partie terminée' };
  if (pieces(d.fen) <= 7) { const t = await tb(d.fen); return { ok: want(d.goal).includes(t.category), info: { src: 'tablebase', ...t } }; }
  const a = await uci.analyse(d.fen, { depth: 22 }); const sc = score(a.lines[0]);
  return { ok: d.goal === 'draw' ? Math.abs(sc) < 100 : sc > 400, info: { src: 'stockfish', cp: sc } };
}
function maxMovesFor(d: Draft, info: any) {
  if (d.maxMoves) return d.maxMoves;
  if (d.goal === 'draw') return 15;
  const dtm = Math.abs(info?.dtm ?? 0); const dtz = Math.abs(info?.dtz ?? 0);
  if (d.goal === 'mate') return Math.min(60, Math.max(8, Math.ceil(dtm / 2) + 12));
  return Math.min(40, Math.max(8, Math.ceil(dtz / 2) + 12));
}
for (const d of DRAFTS) {
  const v = await verify(d);
  if (v.ok) out.push({ id: d.id, title: d.title, icon: d.icon, fen: d.fen, goal: d.goal, level: d.level, cat: d.cat, desc: d.desc, tip: d.tip, maxMoves: maxMovesFor(d, v.info), verified: v.info.src });
  else dropped.push(`${d.id} (${JSON.stringify(v.info)})`);
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}
// — Séries générées —
let seed = 7; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const sq = (i: number) => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1);
function place(spec: [string, number[]?][]): string | null {
  const board: (string | null)[] = Array(64).fill(null);
  for (const [p, allowed] of spec) { const pool = (allowed || [...Array(64).keys()]).filter((i) => !board[i]); if (!pool.length) return null; board[pool[rnd(pool.length)]] = p; }
  let fen = ''; for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = board[r * 8 + f]; if (p) { if (e) fen += e; e = 0; fen += p; } else e++; } if (e) fen += e; if (r) fen += '/'; }
  return fen;
}
const ALL = [...Array(64).keys()]; const CENTER = ALL.filter((i) => { const f = i % 8, r = Math.floor(i / 8); return f >= 2 && f <= 5 && r >= 2 && r <= 5; });
const PAWNR = (lo: number, hi: number, files = [1, 2, 3, 4, 5, 6]) => ALL.filter((i) => files.includes(i % 8) && Math.floor(i / 8) >= lo && Math.floor(i / 8) <= hi);
interface Series { key: string; title: string; icon: string; cat: string; level: 1 | 2 | 3; goal: Draft['goal']; n: number; spec: [string, number[]?][]; stm: 'w' | 'b'; dtm?: [number, number]; desc: string; tip: string }
const SERIES: Series[] = [
  { key: 'kq-k', title: 'Mat Dame', icon: '👸', cat: 'Mats élémentaires', level: 1, goal: 'mate', n: 6, spec: [['k', CENTER], ['K'], ['Q']], stm: 'w', dtm: [13, 21], desc: 'Série : mate avec la dame depuis une position aléatoire.', tip: 'Réduis la boîte du roi avec la dame, approche ton roi, évite le pat.' },
  { key: 'kr-k', title: 'Mat Tour', icon: '🗼', cat: 'Mats élémentaires', level: 1, goal: 'mate', n: 6, spec: [['k', CENTER], ['K'], ['R']], stm: 'w', dtm: [21, 35], desc: 'Série : mate avec la tour depuis une position aléatoire.', tip: 'Coupe, opposition, échec ; coup d’attente de la tour si nécessaire.' },
  { key: 'kbb-k', title: 'Mat deux fous', icon: '⛪', cat: 'Mats élémentaires', level: 2, goal: 'mate', n: 4, spec: [['k', CENTER], ['K'], ['B', ALL.filter((i) => ((i % 8) + Math.floor(i / 8)) % 2 === 0)], ['B', ALL.filter((i) => ((i % 8) + Math.floor(i / 8)) % 2 === 1)]], stm: 'w', dtm: [25, 41], desc: 'Série : mate avec les deux fous.', tip: 'Fous côte à côte, roi en soutien, vers n’importe quel coin.' },
  { key: 'kbn-k', title: 'Mat fou + cavalier', icon: '🐴', cat: 'Mats élémentaires', level: 3, goal: 'mate', n: 3, spec: [['k', CENTER], ['K'], ['B'], ['N']], stm: 'w', dtm: [41, 61], desc: 'Série : le mat fou + cavalier.', tip: 'Coin de la couleur du fou ; manœuvre en W du cavalier.' },
  { key: 'kp-k-w', title: 'Pion : gagner', icon: '♙', cat: 'Finales de pions', level: 1, goal: 'promote', n: 8, spec: [['P', PAWNR(1, 4)], ['K'], ['k']], stm: 'w', desc: 'Série : roi et pion contre roi, position gagnante.', tip: 'Roi devant le pion, opposition, cases clés.' },
  { key: 'kp-k-d', title: 'Pion : annuler', icon: '🛡️', cat: 'Finales de pions', level: 2, goal: 'draw', n: 8, spec: [['P', PAWNR(1, 4)], ['K'], ['k']], stm: 'b', desc: 'Série : tu as les Noirs, empêche la promotion.', tip: 'Va devant le pion et garde l’opposition.' },
  { key: 'kq-kr-s', title: 'Dame contre tour', icon: '🥊', cat: 'Dame', level: 3, goal: 'mate', n: 3, spec: [['k', CENTER], ['K'], ['Q'], ['r']], stm: 'w', dtm: [25, 45], desc: 'Série : la dame bat la tour.', tip: 'Position de Philidor puis fourchette.' },
  { key: 'krp-kr-w', title: 'Tour + pion : gagner', icon: '🌉', cat: 'Finales de tours', level: 3, goal: 'promote', n: 4, spec: [['P', PAWNR(4, 5)], ['K', PAWNR(5, 7, [0, 1, 2, 3, 4, 5, 6, 7])], ['k'], ['R'], ['r']], stm: 'w', desc: 'Série : finale de tours gagnante (type Lucena).', tip: 'Coupe le roi adverse, construis le pont.' },
  { key: 'krp-kr-d', title: 'Tour + pion : annuler', icon: '🏯', cat: 'Finales de tours', level: 3, goal: 'draw', n: 4, spec: [['P', PAWNR(3, 4)], ['k', PAWNR(6, 7, [0, 1, 2, 3, 4, 5, 6, 7])], ['K'], ['R'], ['r']], stm: 'b', desc: 'Série : finale de tours nulle (type Philidor).', tip: 'Roi devant le pion, tour active sur la 6e rangée.' },
];
const fens = new Set(out.map((x) => x.fen));
for (const s of SERIES) {
  let got = 0, tries = 0;
  while (got < s.n && tries < 400) {
    tries++; const pl = place(s.spec); if (!pl) continue; const fen = `${pl} ${s.stm} - - 0 1`;
    let c: Chess; try { c = new Chess(fen); } catch { continue; }
    if (c.isGameOver() || c.inCheck() || fens.has(fen)) continue;
    // la position ne doit pas laisser l'adversaire en échec (chess.js le vérifie déjà), ni être triviale
    const t = await tb(fen); if (!want(s.goal).includes(t.category)) continue;
    if (s.dtm && (t.dtm == null || Math.abs(t.dtm) < s.dtm[0] || Math.abs(t.dtm) > s.dtm[1])) continue;
    if (s.goal === 'promote' && Math.abs(t.dtz ?? 0) < 5) continue;
    if (s.goal === 'draw') { // il doit exister au moins un coup perdant (sinon trop facile)
      const best = await uci.analyse(fen, { depth: 10, multipv: 8 }); if (!best.lines.some((l: any) => score(l) < -300)) continue;
    }
    got++; fens.add(fen);
    const d: Draft = { id: `${s.key}-${got}`, title: `${s.title} n° ${got}`, icon: s.icon, fen, goal: s.goal, level: s.level, cat: s.cat, desc: s.desc, tip: s.tip };
    out.push({ ...d, maxMoves: maxMovesFor(d, t), verified: 'tablebase', series: s.key });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
  }
  console.log(s.key, got, '/', s.n, 'essais', tries);
}
uci.quit();
fs.writeFileSync('src/data/endgames-extra.json', JSON.stringify(out));
console.log('finales :', out.length, 'rejetées :', dropped.length); for (const d of dropped) console.log('  ✗', d);
process.exit(0);
