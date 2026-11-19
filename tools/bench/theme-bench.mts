// Benchmark des thèmes lus sur la ligne (src/coach/themes.ts) contre les étiquettes des puzzles Lichess.
// npx -y tsx tools/bench/theme-bench.mts [maxParBande] [motif à détailler]
import fs from 'node:fs';
import { lineThemes, type ThemeKey } from '../../src/coach/themes';
import { loadCorpus } from './corpus.mts';
const KEYS: ThemeKey[] = ['fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'hangingPiece', 'trappedPiece', 'backRankMate', 'deflection', 'attraction', 'xRayAttack', 'capturingDefender'];
export function runThemeBench(max = 400) {
  const C = loadCorpus(max); const res: Record<string, { tp: number; fp: number; fn: number; n: number; fpIds: string[]; fnIds: string[] }> = {}; const t0 = Date.now();
  for (const p of C) {
    const got = new Set(lineThemes(p.f, p.m.split(' ')).map((t) => t.key));
    for (const k of KEYS) {
      const r = (res[k] ||= { tp: 0, fp: 0, fn: 0, n: 0, fpIds: [], fnIds: [] }); const lab = p.t.includes(k); const det = got.has(k);
      if (lab) r.n++; if (lab && det) r.tp++; else if (det) { r.fp++; r.fpIds.push(p.i); } else if (lab) { r.fn++; r.fnIds.push(p.i); }
    }
  }
  const table = Object.entries(res).map(([k, r]) => ({ motif: k, labelled: r.n, recall: +(r.tp / Math.max(1, r.tp + r.fn)).toFixed(3), precision: +(r.tp / Math.max(1, r.tp + r.fp)).toFixed(3) }));
  return { puzzles: C.length, ms: Date.now() - t0, table, res };
}
if (process.argv[1]?.endsWith('theme-bench.mts')) {
  const r = runThemeBench(+(process.argv[2] || 400)); console.log(r.puzzles, 'puzzles', r.ms, 'ms'); console.table(r.table);
  const k = process.argv[3]; if (k) console.log('FP', r.res[k].fpIds.slice(0, 12).join(' '), '\nFN', r.res[k].fnIds.slice(0, 12).join(' '));
  if (!k) fs.writeFileSync('bench/theme-bench.json', JSON.stringify({ puzzles: r.puzzles, table: r.table }, null, 1));
}
