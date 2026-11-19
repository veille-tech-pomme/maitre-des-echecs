// Exactitude des explications : dans chaque puzzle Lichess, le coup de l'adversaire est une gaffe connue.
// On l'explique avec Stockfish (natif) et on vérifie que chaque affirmation est soutenue par le moteur.
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from '../uci.mjs';
import { explainMove } from '../../src/coach/explain';
import { classifyMove } from '../../src/coach/classify';
import { expectedStm } from '../../src/coach/winprob';
import { loadCorpus } from './corpus.mts';

const THEMES_OF: Record<string, string[]> = {
  fork: ['fork'], pin: ['pin'], skewer: ['skewer', 'xRayAttack'], discoveredAttack: ['discoveredAttack'], discoveredCheck: ['discoveredAttack', 'discoveredCheck'], doubleCheck: ['doubleCheck', 'discoveredAttack'],
  trappedPiece: ['trappedPiece'], capturingDefender: ['capturingDefender', 'deflection', 'attraction'], overload: ['deflection', 'overloading'], hanging: ['hangingPiece'],
};
export async function runExplainBench(n = 200, depth = 12, seed = 7) {
  const C = loadCorpus(60); const sample: typeof C = [];
  let h = seed; for (const p of C) { h = (h * 1103515245 + 12345) & 0x7fffffff; if (h % Math.max(1, Math.floor(C.length / n)) === 0) sample.push(p); if (sample.length >= n) break; }
  const e = new Uci(); await e.init();
  const st = { n: 0, flaggedBad: 0, specific: 0, tacticClaims: 0, tacticAgree: 0, mateClaims: 0, mateAgree: 0, materialClaims: 0, materialSupported: 0, unsupported: 0, refutationMatches: 0, examples: [] as any[] };
  for (const p of sample) {
    const ms = p.m.split(' '); const fen = p.f; const blunder = ms[0];
    const ch = new Chess(fen); let after: string; try { ch.move({ from: blunder.slice(0, 2), to: blunder.slice(2, 4), promotion: blunder[4] }); after = ch.fen(); } catch { continue; }
    const rb = await e.analyse(fen, { depth, multipv: 3 }); const ra = await e.analyse(after, { depth, multipv: 1 });
    const lines = rb.lines.map((l: any) => ({ move: l.move, pv: l.pv, cp: l.cp, mate: l.mate }));
    const reply = ra.lines[0] ? { move: ra.lines[0].move, pv: ra.lines[0].pv, cp: ra.lines[0].cp, mate: ra.lines[0].mate } : null;
    const elo = 1500; const eBest = expectedStm({ cp: lines[0]?.cp ?? 0, mate: lines[0]?.mate ?? null }, elo);
    let ePlayed = reply ? 1 - expectedStm({ cp: reply.cp, mate: reply.mate }, elo) : 0.5; const inM = lines.find((l: any) => l.move === blunder); if (inM) ePlayed = Math.min(eBest, expectedStm(inM, elo));
    const dE = Math.max(0, eBest - ePlayed);
    const cls = classifyMove({ dE, eBest, ePlayed, eBefore: eBest, isBest: lines[0]?.move === blunder, book: false, sacrifice: false, gap12: null, mate: false, elo });
    const ex = explainMove({ fenBefore: fen, uci: blunder, cls, dE, eBefore: eBest, ePlayed, eBest, lines, reply, elo, ply: 30, history: [], mine: true });
    st.n++; if (!['best', 'excellent', 'good', 'great', 'brilliant', 'book'].includes(cls)) st.flaggedBad++;
    if (reply && reply.move === ms[1]) st.refutationMatches++;
    const tag = ex.tags[0] || '';
    if (!['positional', ''].includes(tag) && !tag.startsWith('opening')) st.specific++;
    if (tag.startsWith('allowedMate')) { st.mateClaims++; if (reply?.mate != null && reply.mate > 0 && p.t.includes('mate')) st.mateAgree++; else st.unsupported++; }
    if (tag.startsWith('allowed:') && !['allowed:material', 'allowed:hanging', 'allowed:threat'].some((x) => tag.startsWith(x))) {
      st.tacticClaims++; const motif = tag.split(':')[1]; if ((THEMES_OF[motif] || []).some((t) => p.t.includes(t))) st.tacticAgree++; else if (process.env.DBG) console.error('DIS', p.i, motif, p.t.join(','), ex.why);
    }
    const lostFact = ex.facts.find((f: any) => Array.isArray(f.lost)) as any;
    if (lostFact) {
      st.materialClaims++;
      const pts = typeof lostFact.net === 'number' ? -lostFact.net : (lostFact.lost as string[]).reduce((s, r) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as any)[r], 0);
      const cpDrop = reply && reply.cp != null && lines[0]?.cp != null ? lines[0].cp + reply.cp : null; // perte de cp pour le joueur
      const ok = reply && (reply.mate != null && reply.mate > 0 || (cpDrop != null && cpDrop >= 60 * pts) || dE >= 0.15);
      if (ok) st.materialSupported++; else { st.unsupported++; if (process.env.DBG) console.error('UNS', p.i, p.t.join(','), ex.headline, '|', ex.why, cpDrop, dE); }
    }
    const tk = (ex.tags[0] || 'none').split(':').slice(0, 2).join(':'); if (st.examples.filter((x: any) => x.tag === tk).length < 1 && ex.headline) st.examples.push({ tag: tk, ...{ id: p.i, themes: p.t.join(','), headline: ex.headline, why: ex.why, plan: ex.plan, tip: ex.tip } });
  }
  e.quit();
  const r = (a: number, b: number) => +(a / Math.max(1, b)).toFixed(3);
  return { positions: st.n, depth, flaggedAsError: r(st.flaggedBad, st.n), specificReason: r(st.specific, st.n), tacticMotifAgreement: r(st.tacticAgree, st.tacticClaims), tacticClaims: st.tacticClaims, mateClaimsCorrect: r(st.mateAgree, st.mateClaims), mateClaims: st.mateClaims, materialClaimsSupported: r(st.materialSupported, st.materialClaims), materialClaims: st.materialClaims, unsupportedClaims: st.unsupported, engineAgreesWithLichessRefutation: r(st.refutationMatches, st.n), examples: st.examples };
}
if (process.argv[1]?.endsWith('explain-bench.mts')) runExplainBench(+(process.argv[2] || 100)).then((r) => console.log(JSON.stringify(r, null, 1)));
