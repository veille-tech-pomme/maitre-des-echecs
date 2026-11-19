// Test de placement adaptatif (théorie de réponse aux items) : a posteriori bayésien sur une grille de notes,
// a priori N(départ, 450²), vraisemblance logistique Elo. Chaque item est posé à la note a posteriori moyenne
// (information maximale, p ≈ 0,5), sur des thèmes variés ; 6 positions suffisent pour ±150 environ.
import type { SkillEvent } from './pipeline';
import { skillsForPuzzle } from './skills';
import { pSuccess } from './model';

export const DIAG_THEMES = ['mateIn1', 'hangingPiece', 'fork', 'pin', 'mateIn2', 'endgame'];
export interface DiagItem { id: string; r: number; th: string[]; ok: boolean; ms: number; plies: number }
export interface DiagState { i: number; start: number; r: number; rd: number; items: DiagItem[] }
const GRID: number[] = []; for (let x = 200; x <= 2800; x += 10) GRID.push(x);
function posterior(start: number, items: DiagItem[]) {
  const lw = GRID.map((x) => -(((x - start) / 450) ** 2) / 2 + items.reduce((s, it) => { const p = pSuccess(x, it.r); const sc = it.ok ? (it.ms > 45000 ? 0.8 : 1) : 0; return s + sc * Math.log(p) + (1 - sc) * Math.log(1 - p); }, 0));
  const mx = Math.max(...lw); const w = lw.map((l) => Math.exp(l - mx)); const z = w.reduce((a, b) => a + b, 0);
  const mean = GRID.reduce((s, x, i) => s + x * w[i], 0) / z; const v = GRID.reduce((s, x, i) => s + (x - mean) ** 2 * w[i], 0) / z;
  return { mean, sd: Math.sqrt(v) };
}
export const diagStart = (start = 1000): DiagState => ({ i: 0, start, r: start, rd: 450, items: [] });
export const diagDone = (s: DiagState) => s.i >= DIAG_THEMES.length;
export function diagTarget(s: DiagState): { rating: number; theme: string } { return { rating: Math.round(Math.max(400, Math.min(2500, s.r))), theme: DIAG_THEMES[s.i % DIAG_THEMES.length] }; }
/** Réponse : réussite rapide = 1, lente (> 45 s) = 0,8, échec = 0. */
export function diagAnswer(s: DiagState, it: DiagItem): DiagState {
  const items = [...s.items, it]; const p = posterior(s.start, items);
  return { i: s.i + 1, start: s.start, r: p.mean, rd: p.sd, items };
}
export function diagResult(s: DiagState): { rating: number; rd: number; events: SkillEvent[] } {
  const events: SkillEvent[] = [];
  for (const it of s.items) for (const k of skillsForPuzzle(it.th, it.plies)) events.push({ skill: k, s: it.ok ? 1 : 0, d: it.r, w: 0.7, src: 'diag', ref: 'p:' + it.id });
  return { rating: Math.round(s.r), rd: Math.round(s.rd), events };
}
