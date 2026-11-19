// Bilan adaptatif (théorie → recherche minimale, passage rapide d−3, approfondissement des positions critiques)
// contre bilan complet à profondeur d : accord des classifications et des explications, et nombre de nœuds.
// npx -y tsx tools/bench/adaptive-bench.mts
import fs from 'node:fs';
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from '../uci.mjs';
import { buildReview } from '../../src/coach/pipeline';
import { isBookFen } from '../../src/data/openings';
const D = 14, D0 = 11;
const seed = JSON.parse(fs.readFileSync('tools/tmp/coach-seed.json', 'utf8'));
const games: string[][] = [...seed.state.games.map((g: any) => g.moves), fs.readFileSync('tools/tmp/long-game.txt', 'utf8').trim().split(' ')];
const e = new Uci(); await e.init();
const toL = (l: any) => ({ move: l.move, pv: l.pv, cp: l.cp, mate: l.mate });
const winStm = (l: any) => (!l ? 0.5 : l.mate != null ? (l.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.00368208 * (l.cp ?? 0))));
let agreeCls = 0, agreeTag = 0, n = 0, nodesFull = 0, nodesAd = 0;
for (const sans of games) {
  const ch = new Chess(); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const s of sans) { const m = ch.move(s); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  const over = fens.map((f) => new Chess(f).isGameOver()); const book = ucis.map((_, i) => i < 20 && isBookFen(fens[i + 1]));
  const A = async (f: string, d: number, mpv: number) => { const r = await e.analyse(f, { depth: d, multipv: mpv }); return { lines: r.lines.map(toL), nodes: r.nodes || 0 }; };
  const full: any[][] = [], ad: any[][] = [];
  for (let i = 0; i < fens.length; i++) { if (over[i]) { full.push([]); ad.push([]); continue; } const a = await A(fens[i], D, 3); full.push(a.lines); nodesFull += a.nodes;
    const bo = book[i] && (i === 0 || book[i - 1]); const b = await A(fens[i], bo ? 6 : D0, bo ? 1 : 3); ad.push(b.lines); nodesAd += b.nodes; }
  for (let i = 0; i < ucis.length; i++) { if (book[i] || over[i]) continue; const wb = winStm(ad[i][0]), wa = 1 - winStm(ad[i + 1]?.[0]); const loss = wb - wa; const flip = (wb - 0.5) * (wa - 0.5) < 0; const nb = ad[i][0]?.move !== ucis[i];
    if (loss >= 0.03 || flip || (nb && loss >= 0.015) || ad[i][0]?.mate != null || ad[i + 1]?.[0]?.mate != null) for (const j of [i, i + 1]) if (j < fens.length && !over[j] && !(ad[j] as any).deep) { const a = await A(fens[j], D, 3); ad[j] = a.lines; (ad[j] as any).deep = 1; nodesAd += a.nodes; } }
  const inp = (L: any[][]) => ({ startFen: fens[0], moves: ucis, lines: L, elo: 1200, user: 'w' as const, oppElo: 1200, book: isBookFen });
  const rf = buildReview(inp(full)), ra = buildReview(inp(ad));
  for (let i = 0; i < rf.moves.length; i++) { n++; if (rf.moves[i].cls === ra.moves[i].cls) agreeCls++; if ((rf.moves[i].ex?.tags[0] || '') === (ra.moves[i].ex?.tags[0] || '')) agreeTag++; }
}
e.quit();
const out = { games: games.length, moves: n, depthFull: D, depthFirstPass: D0, classAgreement: +(agreeCls / n).toFixed(3), explanationTagAgreement: +(agreeTag / n).toFixed(3), nodesRatio: nodesFull ? +(nodesAd / nodesFull).toFixed(3) : null };
console.log(JSON.stringify(out)); fs.writeFileSync('bench/adaptive-bench.json', JSON.stringify(out, null, 1));
