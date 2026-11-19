// Bench des explications positionnelles : catégorie de la raison donnée vs catégories annotées.
// npx -y tsx tools/bench/positional-bench.mts   (DBG=1 pour le détail)
import fs from 'node:fs';
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from '../uci.mjs';
import { explainMove, trace } from '../../src/coach/explain';
import { classifyMove } from '../../src/coach/classify';
import { expectedStm } from '../../src/coach/winprob';
import { POSITIONAL, HELDOUT, type Cat, type PosCase } from './positional-corpus';
export function catOf(tag: string): Cat | 'generic' | 'other' {
  tag = tag.replace(/^good:/, '');
  if (/^(king:|opening:fpawn|opening:king|allowedMate|threat:mate|threat:checks|strat:king)/.test(tag)) return 'kingSafety';
  if (/^(pawns:|strat:pawns)/.test(tag)) return 'pawnStructure';
  if (/^(pieces:|opening:rim|strat:activity)/.test(tag)) return 'activity';
  if (/^(opening:development|opening:queen|opening:tempo|strat:development)/.test(tag)) return 'development';
  if (/^(space:|center:|strat:space)/.test(tag)) return 'space';
  if (/^(prophylaxis|strat:prophylaxis)/.test(tag)) return 'prophylaxis';
  if (/^(allowed:|ignored:threat|threat:)/.test(tag)) return 'threat';
  if (tag === 'positional' || tag === '') return 'generic';
  return 'other';
}
export async function runPositionalBench(depth = 16, set: PosCase[] = POSITIONAL, minLoss = 0) {
  const e = new Uci(); await e.init(); const rows: any[] = []; const excluded: string[] = []; let hit = 0, generic = 0, n = 0;
  for (const c of set) {
    const ch = new Chess(c.fen || undefined); const hist: string[] = [];
    if (c.seq) for (const m of c.seq.split(' ')) hist.push(ch.move(m).san);
    const fen = ch.fen(); const mv = ch.move(c.move); const uci = mv.from + mv.to + (mv.promotion || '');
    const rb = await e.analyse(fen, { depth, multipv: 3 }); const ra = await e.analyse(ch.fen(), { depth, multipv: 1 });
    const lossCp = (rb.lines[0].mate != null ? 1000 : rb.lines[0].cp) - (ra.lines[0].mate != null ? (ra.lines[0].mate > 0 ? 1000 : -1000) : -ra.lines[0].cp);
    if (lossCp < minLoss) { if (process.env.DBG) console.error('skip', c.id, lossCp); continue; }
    // positionnel = la réfutation ne gagne pas de matériel dans les 8 demi-coups (sinon c'est une faute tactique)
    const tr = trace(fen, [uci, ...ra.lines[0].pv], fen.split(' ')[1] as any, 9);
    if (tr.net <= -1 || ra.lines[0].mate != null) { excluded.push(c.id); if (process.env.DBG) console.error('tactique', c.id, tr.lostNet.join('')); continue; }
    const lines = rb.lines.map((l: any) => ({ move: l.move, pv: l.pv, cp: l.cp, mate: l.mate }));
    const reply = ra.lines[0] ? { move: ra.lines[0].move, pv: ra.lines[0].pv, cp: ra.lines[0].cp, mate: ra.lines[0].mate } : null;
    const elo = 1500; const eBest = expectedStm({ cp: lines[0]?.cp ?? 0, mate: lines[0]?.mate ?? null }, elo);
    let ePlayed = reply ? 1 - expectedStm({ cp: reply.cp, mate: reply.mate }, elo) : 0.5; const inM = lines.find((l: any) => l.move === uci); if (inM) ePlayed = Math.min(eBest, expectedStm(inM, elo));
    const dE = Math.max(0, eBest - ePlayed);
    const cls = classifyMove({ dE, eBest, ePlayed, eBefore: eBest, isBest: lines[0]?.move === uci, book: false, sacrifice: false, gap12: null, mate: false, elo });
    const ply = c.seq ? c.seq.split(' ').length : 2 * (+fen.split(' ')[5] - 1) + (fen.split(' ')[1] === 'b' ? 1 : 0);
    const ex = explainMove({ fenBefore: fen, uci, cls, dE, eBefore: eBest, ePlayed, eBest, lines, reply, elo, ply, history: hist, mine: true });
    const cat = catOf(ex.tags.find((t) => t.startsWith('good:')) || ex.tags[0] || ''); n++; const ok = c.expect.includes(cat as Cat); if (ok) hit++; if (cat === 'generic') generic++;
    rows.push({ id: c.id, lossCp, cls, dE: +dE.toFixed(3), expect: c.expect.join('/'), got: cat, tag: ex.tags[0], headline: ex.headline, why: ex.why, plan: ex.plan });
    if (process.env.DBG) console.error(ok ? '✓' : '✗', c.id, cls, cat, '|', ex.headline, '|', ex.why, '|', ex.plan || '');
  }
  e.quit();
  return { cases: n, excludedTactical: excluded, depth, categoryAccuracy: +(hit / n).toFixed(3), genericFallback: +(generic / n).toFixed(3), rows };
}
if (process.argv[1]?.endsWith('positional-bench.mts')) (async () => { const dev = await runPositionalBench(); const held = await runPositionalBench(16, HELDOUT, 40); const strip = ({ rows, ...s }: any) => s; console.log(JSON.stringify({ dev: strip(dev), heldOut: strip(held) })); if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ dev, heldOut: held }, null, 1)); })();
