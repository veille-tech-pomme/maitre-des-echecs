// Client du coach (fil principal) : orchestre Stockfish (multi-PV) puis délègue le calcul au Worker du coach.
import { Chess } from 'chess.js';
import { engine, type PvLine } from '../lib/engine';
import type { CoachReview, GameInput } from './pipeline';
import type { Line, Explanation } from './explain';
import { explainMove } from './explain';
import { sanOf } from './lang';
import { MOTIF_LABEL, type MotifKey } from './motifs';
import { classifyMove } from './classify';
import { expectedStm } from './winprob';
import { hintsFor, nullMoveFen, type Hint } from './hints';
import { getState } from '../lib/store';
import { equivalence } from '../lib/judge-rule';
import { globalRating } from './model';
/** Note utilisée pour calibrer le coach (modèle du joueur, sinon classement puzzles). */
export const currentElo = () => { const s = getState(); return s.coach ? globalRating(s.coach) : s.puzzle.rating || 800; };

const toLine = (l: PvLine): Line => ({ move: l.move, pv: l.pv, cp: l.cp, mate: l.mate });
let worker: Worker | null = null; let seq = 0; const pending = new Map<number, (m: any) => void>();
function getWorker(): Worker | null {
  if (worker) return worker;
  try { worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); worker.onmessage = (e) => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); }; } catch { worker = null; }
  return worker;
}
async function runReview(input: Omit<GameInput, 'book'>): Promise<CoachReview> {
  const w = getWorker();
  if (!w) { const [{ buildReview }, { isBookFen }] = await Promise.all([import('./pipeline'), import('../data/openings')]); return buildReview({ ...input, book: isBookFen }); }
  return new Promise((res, rej) => { const id = ++seq; pending.set(id, (m) => (m.ok ? res(m.r) : rej(new Error(m.error)))); w.postMessage({ id, type: 'review', input }); });
}
export interface ReviewOpts { result?: '1-0' | '0-1' | '1/2-1/2' | '*'; depth?: number; elo: number; user: 'w' | 'b'; oppElo: number; gameId?: string; onProgress?: (p: number) => void; onPartial?: (r: CoachReview) => void; signal?: { cancelled: boolean } }

// ——— cache des analyses par position (mémoire, LRU) : une position déjà vue à profondeur ≥ d n'est pas recalculée ———
const CACHE = new Map<string, { depth: number; mpv: number; lines: Line[] }>(); const CACHE_MAX = 600;
const ckey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
export async function analyseCached(fen: string, depth: number, multipv: number): Promise<Line[]> {
  const k = ckey(fen); const c = CACHE.get(k);
  if (c && c.depth >= depth && c.mpv >= multipv) { CACHE.delete(k); CACHE.set(k, c); return c.lines.slice(0, Math.max(multipv, 1)); }
  const r = await engine.analyse(fen, { depth, multipv }); const lines = r.lines.map(toLine);
  CACHE.set(k, { depth, mpv: multipv, lines }); if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value!);
  return lines;
}
/** Chances (0–1) du camp au trait, échelle Lichess, pour le tri des coups à approfondir. */
const winStm = (l: Line | undefined) => { if (!l) return 0.5; if (l.mate != null) return l.mate > 0 ? 1 : 0; return 1 / (1 + Math.exp(-0.00368208 * (l.cp ?? 0))); };
/**
 * Analyse complète d'une partie (SAN), pensée pour un téléphone :
 * 1) coups de théorie (base d'ouvertures) : recherche minimale, seulement pour la courbe ;
 * 2) premier passage rapide (profondeur −3, multi-PV 3) avec résultats progressifs (`onPartial`) dès les premiers coups ;
 * 3) second passage à pleine profondeur uniquement sur les positions critiques (perte de chances ≥ 3 %, bascule de
 *    l'évaluation, coups où le joueur s'écarte du meilleur coup) ; 4) cache par position.
 */
export async function coachReview(startFen: string, sans: string[], o: ReviewOpts): Promise<CoachReview> {
  const ch = new Chess(startFen); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const s of sans) { const m = ch.move(s); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  const { isBookFen } = await import('../data/openings');
  const D = o.depth ?? 12; const D0 = Math.max(8, D - 3); const N = fens.length;
  const book = ucis.map((_, i) => i < 20 && isBookFen(fens[i + 1]));
  const over = fens.map((f) => new Chess(f).isGameOver());
  const lines: Line[][] = new Array(N).fill(null).map(() => []); const depthOf = new Array(N).fill(0);
  const input = (k: number) => ({ startFen, moves: ucis.slice(0, k), lines: lines.slice(0, k + 1), elo: o.elo, user: o.user, oppElo: o.oppElo, gameId: o.gameId, result: k >= ucis.length ? o.result : '*' as const });
  const total = N * 1 + 0.6 * N; let done = 0; const prog = () => o.onProgress?.(Math.min(0.95, done / total));
  let lastPartial = 0, lastT = Date.now();
  // passage 1
  for (let i = 0; i < N; i++) {
    if (o.signal?.cancelled) throw new Error('cancelled');
    if (!over[i]) {
      const bookOnly = book[i] && (i === 0 || book[i - 1]);
      const d = bookOnly ? 6 : D0; lines[i] = await analyseCached(fens[i], d, bookOnly ? 1 : 3); depthOf[i] = d;
    }
    done++; prog();
    // résultat progressif : toutes les ~6 demi-coups ou 1,5 s, sur le préfixe déjà analysé
    if (o.onPartial && i >= 2 && (i - lastPartial >= 6 || Date.now() - lastT > 1500) && i < N - 1) {
      lastPartial = i; lastT = Date.now(); runReview(input(i)).then((r) => { if (!o.signal?.cancelled) o.onPartial!(r); }).catch(() => {});
    }
  }
  // passage 2 : positions critiques à pleine profondeur
  if (D > D0) {
    const need = new Set<number>();
    for (let i = 0; i < ucis.length; i++) {
      if (book[i] || over[i]) continue;
      const wb = winStm(lines[i][0]); const wa = 1 - winStm(lines[i + 1]?.[0]); const loss = wb - wa;
      const flip = (wb - 0.5) * (wa - 0.5) < 0; const notBest = lines[i][0]?.move !== ucis[i];
      if (loss >= 0.03 || flip || (notBest && loss >= 0.015) || lines[i][0]?.mate != null || lines[i + 1]?.[0]?.mate != null) { need.add(i); if (i + 1 < N && !over[i + 1]) need.add(i + 1); }
    }
    const idx = [...need].sort((a, b) => a - b); const step = (0.6 * N) / Math.max(1, idx.length);
    for (const i of idx) { if (o.signal?.cancelled) throw new Error('cancelled'); lines[i] = await analyseCached(fens[i], D, 3); depthOf[i] = D; done += step; prog(); }
  }
  const r = await runReview(input(ucis.length));
  o.onProgress?.(1); return r;
}
/** Évaluation immédiate d'un coup joué (mode coach en partie). */
export function assessLive(fenBefore: string, uci: string, before: PvLine[], after: PvLine[], elo: number, ply: number, history: string[]): { cls: ReturnType<typeof classifyMove>; dE: number; ex: Explanation } {
  const L = before.map(toLine); const reply = after[0] ? toLine(after[0]) : null;
  const eBest = expectedStm({ cp: L[0]?.cp ?? 0, mate: L[0]?.mate ?? null }, elo);
  let ePlayed = reply ? 1 - expectedStm({ cp: reply.cp, mate: reply.mate }, elo) : 0.5;
  const mate = (() => { try { const c = new Chess(fenBefore); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return c.isCheckmate(); } catch { return false; } })();
  if (mate) ePlayed = 1;
  const inM = L.find((l) => l.move === uci); if (inM) ePlayed = Math.min(eBest, expectedStm(inM, elo));
  const isBest = L[0]?.move === uci; const dE = isBest ? 0 : Math.max(0, eBest - ePlayed);
  const gap12 = L[1] ? eBest - expectedStm(L[1], elo) : null;
  const cls = classifyMove({ dE, eBest, ePlayed, eBefore: eBest, isBest, book: false, sacrifice: false, gap12, mate, elo });
  return { cls, dE, ex: explainMove({ fenBefore, uci, cls, dE, eBefore: eBest, ePlayed, eBest, lines: L, reply, elo, ply, history, mine: true }) };
}
/** Explique un coup raté dans un puzzle : réponse du moteur + solution comme meilleure ligne. */
export async function explainPuzzleMiss(fen: string, wrong: string, solution: string[], elo: number): Promise<Explanation> {
  const after = (() => { const c = new Chess(fen); c.move({ from: wrong.slice(0, 2), to: wrong.slice(2, 4), promotion: wrong[4] }); return c.fen(); })();
  const [rb, ra] = await Promise.all([engine.analyse(fen, { depth: 12, multipv: 2 }), new Chess(after).isGameOver() ? Promise.resolve({ lines: [] as PvLine[] }) : engine.analyse(after, { depth: 12, multipv: 1 })]);
  const lines = rb.lines.map(toLine);
  if (!lines.length || lines[0].move !== solution[0]) lines.unshift({ move: solution[0], pv: solution, cp: lines[0]?.cp ?? 300, mate: lines[0]?.mate ?? null });
  const r = assessLive(fen, wrong, lines.map((l, i) => ({ ...l, depth: 12, multipv: i + 1 })), ra.lines, elo, 30, []);
  return noSpoil(r.ex, sanOf(fen, solution[0]));
}
/** Indices gradués pour la position courante. */
export async function coachHints(fen: string, depth = 11): Promise<Hint[]> {
  const r = await engine.analyse(fen, { depth, multipv: 2 });
  const nf = nullMoveFen(fen); let t: Line | null = null;
  if (nf) { try { const x = await engine.analyse(nf, { depth: Math.max(8, depth - 3), multipv: 1 }); t = x.lines[0] ? toLine(x.lines[0]) : null; } catch { t = null; } }
  return hintsFor(fen, r.lines.map(toLine), t);
}

/** Puzzle : on explique pourquoi le coup joué échoue, sans dévoiler la solution (gardée dans `plan`). */
export function noSpoil(ex: Explanation, solSan: string): Explanation {
  const t = ex.tags[0] || ''; const hide = (x: string) => x.split(solSan).join('le bon coup');
  if (t.startsWith('missedMate')) return { ...ex, headline: 'Il y a un mat dans cette position', why: 'Cherche les échecs : le roi adverse n’a presque plus de cases.' };
  if (t.startsWith('missed:')) { const k = t.split(':')[1] as MotifKey; const lab = MOTIF_LABEL[k]; return { ...ex, headline: lab ? `Une tactique t’échappe : ${lab.toLowerCase()}` : 'Il y a mieux à trouver', why: 'Ton coup laisse passer l’occasion. Repère les pièces adverses mal protégées et les coups forçants.' }; }
  if (!t.startsWith('allowed') && !t.startsWith('ignored')) return { ...ex, headline: 'Ce n’est pas le coup du puzzle', why: 'Ton coup n’est pas une faute grave, mais il y a beaucoup plus fort : cherche un coup forçant (échec, prise ou menace).' };
  return { ...ex, headline: hide(ex.headline), why: hide(ex.why) };
}

// ---------- Leçons : juger un coup différent de la solution prévue (audit P1) ----------
export type LessonJudge =
  | { accept: true; note: string; continuation: string[] }
  | { accept: false; headline: string; why: string; tip?: string; refutation: string[] };
/**
 * Coup joué ≠ coup prévu : on l'accepte s'il mate aussi vite (on continue alors contre la meilleure défense),
 * ou s'il est à moins de 30 cp du coup prévu ; sinon on explique pourquoi il échoue, avec la réfutation.
 */
export async function judgeLessonMove(fen: string, played: string, expected: string[], elo = currentElo()): Promise<LessonJudge> {
  const [re, rp] = await Promise.all([
    engine.analyse(fen, { depth: 16, movetime: 900, searchmoves: [expected[0]] }),
    engine.analyse(fen, { depth: 16, movetime: 900, searchmoves: [played] }),
  ]);
  const le = re.lines[0], lp = rp.lines[0]; const eq = equivalence(le, lp);
  const sanP = sanOf(fen, played), sanE = sanOf(fen, expected[0]);
  const expMate = le?.mate != null && le.mate > 0;
  if (eq === 'mate-equal') {
    return { accept: true, note: `${sanP} mate aussi vite que la solution prévue (${sanE}) : bien joué. Termine le mat.`, continuation: (lp!.pv || []).slice(1) };
  }
  if (eq === 'equal') {
    return { accept: true, note: `${sanP} est aussi bon selon le moteur. L’idée de la leçon était ${sanE}.`, continuation: [] };
  }
  const ex = await explainPuzzleMiss(fen, played, expected, elo);
  const refutation = (lp?.pv || []).slice(1, 3);
  const loss = expMate ? `Il y avait un mat ; après ${sanP}, ${lp?.mate != null && lp.mate > 0 ? `le mat est plus lent (${lp.mate} coups au lieu de ${le!.mate})` : 'il n’y en a plus'}.` : '';
  return { accept: false, headline: ex.headline, why: [ex.why, loss].filter(Boolean).join(' '), tip: ex.tip, refutation };
}
