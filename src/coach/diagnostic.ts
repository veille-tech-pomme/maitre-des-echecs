// Test de placement adaptatif (théorie de réponse aux items) : a posteriori bayésien sur une grille de notes,
// vraisemblance logistique Elo. Chaque item est posé à la note a posteriori moyenne (information maximale, p ≈ 0,5),
// sur des thèmes variés. A priori : le niveau déclaré à l'accueil (σ ≈ 300) ou la note puzzle si elle est établie,
// sinon N(1000, 450²). Longueur adaptative : au moins 6 positions, on s'arrête dès que σ < 125, au plus 8 (≈ 3 min).
import type { SkillEvent } from './pipeline';
import { skillsForPuzzle } from './skills';
import { pSuccess } from './model';

export const DIAG_THEMES = ['mateIn1', 'hangingPiece', 'fork', 'pin', 'mateIn2', 'endgame', 'skewer', 'discoveredAttack', 'backRankMate', 'deflection'];
export const DIAG_MIN = 6, DIAG_MAX = 8, DIAG_SD_STOP = 125;
export interface DiagItem { id: string; r: number; th: string[]; ok: boolean; ms: number; plies: number }
export interface DiagState { i: number; start: number; prior?: number; r: number; rd: number; items: DiagItem[] }
const GRID: number[] = []; for (let x = 200; x <= 2800; x += 10) GRID.push(x);
function posterior(start: number, prior: number, items: DiagItem[]) {
  const lw = GRID.map((x) => -(((x - start) / prior) ** 2) / 2 + items.reduce((s, it) => { const p = pSuccess(x, it.r); const sc = it.ok ? (it.ms > 45000 ? 0.8 : 1) : 0; return s + sc * Math.log(p) + (1 - sc) * Math.log(1 - p); }, 0));
  const mx = Math.max(...lw); const w = lw.map((l) => Math.exp(l - mx)); const z = w.reduce((a, b) => a + b, 0);
  const mean = GRID.reduce((s, x, i) => s + x * w[i], 0) / z; const v = GRID.reduce((s, x, i) => s + (x - mean) ** 2 * w[i], 0) / z;
  return { mean, sd: Math.sqrt(v) };
}
/** `prior` : écart-type de l'a priori (300 si le niveau a été déclaré, 450 sans information). */
export const diagStart = (start = 1000, prior = 450): DiagState => ({ i: 0, start, prior, r: start, rd: prior, items: [] });
export const diagDone = (s: DiagState) => s.i >= DIAG_MAX || (s.i >= DIAG_MIN && s.rd < DIAG_SD_STOP);
/** Nombre de positions prévu (pour l'indicateur de progression). */
export const diagPlanned = (s: DiagState) => (diagDone(s) ? s.i : s.i < DIAG_MIN ? DIAG_MIN : Math.min(DIAG_MAX, s.i + 1));
export function diagTarget(s: DiagState): { rating: number; theme: string } { return { rating: Math.round(Math.max(400, Math.min(2500, s.r))), theme: DIAG_THEMES[s.i % DIAG_THEMES.length] }; }
/** Réponse : réussite rapide = 1, lente (> 45 s) = 0,8, échec = 0. */
export function diagAnswer(s: DiagState, it: DiagItem): DiagState {
  const items = [...s.items, it]; const p = posterior(s.start, s.prior ?? 450, items);
  return { i: s.i + 1, start: s.start, prior: s.prior, r: p.mean, rd: p.sd, items };
}
export function diagResult(s: DiagState): { rating: number; rd: number; events: SkillEvent[] } {
  const events: SkillEvent[] = [];
  for (const it of s.items) for (const k of skillsForPuzzle(it.th, it.plies)) events.push({ skill: k, s: it.ok ? 1 : 0, d: it.r, w: 0.7, src: 'diag', ref: 'p:' + it.id });
  return { rating: Math.round(s.r), rd: Math.round(s.rd), events };
}

// Diagnostic unique (R2) : plus de niveau déclaré ni de test séparé. Le premier mat de l'accueil (très facile) est un
// premier indice faible, puis les FEED_DIAG premières cartes du fil « Pour toi » sont les positions du test.
export const FEED_DIAG = 4;
export const OB_ITEM: Omit<DiagItem, 'ok' | 'ms'> = { id: 'ob:berger', r: 600, th: ['mateIn1', 'opening'], plies: 1 };
export const DIAG_START = 900;
/** Nombre de positions du test faites dans le fil (sans le mat de l'accueil). */
export const feedDiagCount = (d?: DiagState) => (d ? d.items.filter((x) => !x.id.startsWith('ob:')).length : 0);
/** État du test : celui enregistré, sinon un départ (avec le mat de l'accueil s'il a été joué). */
export function placementOf(placement: DiagState | undefined, ob?: { ok: boolean; ms: number }, rating?: number): DiagState {
  if (placement) return placement;
  const d = diagStart(rating ?? DIAG_START, rating ? 250 : 450);
  return ob ? diagAnswer(d, { ...OB_ITEM, ok: ob.ok, ms: ob.ms }) : d;
}
