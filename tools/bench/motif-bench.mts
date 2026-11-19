// Benchmark des détecteurs sur les solutions des puzzles Lichess : rappel et précision (borne basse) par motif.
import { Chess } from 'chess.js';
import { parseFen, sqIdx } from '../../src/coach/geometry';
import { moveMotifs, verifyOnLine, type MotifKey } from '../../src/coach/motifs';
const applyU = (fen: string, u: string) => { try { const c = new Chess(fen); c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c.fen(); } catch { return null; } };
const isMate = (fen: string) => new Chess(fen).isCheckmate();
import { loadCorpus } from './corpus.mts';
export const MAP: Partial<Record<MotifKey, string>> = {
  fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discoveredAttack', discoveredCheck: 'discoveredCheck', doubleCheck: 'doubleCheck',
  backRankMate: 'backRankMate', smotheredMate: 'smotheredMate', hangingCapture: 'hangingPiece', trappedPiece: 'trappedPiece',
  capturingDefender: 'capturingDefender', promotion: 'promotion', mate: 'mate',
};
export function detectOnSolution(p: { f: string; m: string }, firstOnly = false, verify = true): Set<MotifKey> {
  const ch = new Chess(p.f); const ms = p.m.split(' '); const found = new Set<MotifKey>();
  for (let k = 0; k < ms.length; k++) {
    const u = ms[k];
    if (k % 2 === 1 && (!firstOnly || k === 1)) {
      const fen0 = ch.fen(); const pos = parseFen(fen0);
      ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      let mm = moveMotifs(pos, { from: sqIdx(u.slice(0, 2)), to: sqIdx(u.slice(2, 4)), promo: (u[4] as any) || undefined }, ch.isCheckmate());
      if (k > 1) mm = mm.filter((x) => x.key !== 'hangingCapture');
      if (verify) mm = verifyOnLine(mm, fen0, ms.slice(k), applyU, isMate).verified;
      for (const x of mm) found.add(x.key);
    } else ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  }
  return found;
}
export function runMotifBench(max = 400, verify = true) {
  const C = loadCorpus(max); const res: Record<string, { tp: number; fp: number; fn: number; n: number }> = {};
  const t0 = Date.now();
  for (const p of C) {
    const got = detectOnSolution(p, false, verify);
    for (const [k, theme] of Object.entries(MAP)) {
      const r = (res[theme!] ||= { tp: 0, fp: 0, fn: 0, n: 0 }); const lab = p.t.includes(theme!); const det = got.has(k as MotifKey) || (k === 'discoveredAttack' && got.has('discoveredCheck'));
      if (lab) r.n++; if (lab && det) r.tp++; else if (det) r.fp++; else if (lab) r.fn++;
    }
  }
  const table = Object.entries(res).map(([k, r]) => ({ motif: k, labelled: r.n, recall: +(r.tp / Math.max(1, r.tp + r.fn)).toFixed(3), precision: +(r.tp / Math.max(1, r.tp + r.fp)).toFixed(3) }));
  return { puzzles: C.length, ms: Date.now() - t0, table };
}
if (process.argv[1]?.endsWith('motif-bench.mts')) { const r = runMotifBench(+(process.argv[2] || 400), process.argv[3] !== 'raw'); console.log(r.puzzles, 'puzzles', r.ms, 'ms'); console.table(r.table); }
