// Client du coach (fil principal) : orchestre Stockfish (multi-PV) puis délègue le calcul au Worker du coach.
import { Chess } from 'chess.js';
import { engine, type PvLine } from '../lib/engine';
import type { CoachReview, GameInput } from './pipeline';
import type { Line, Explanation } from './explain';
import { explainMove } from './explain';
import { classifyMove } from './classify';
import { expectedStm } from './winprob';
import { hintsFor, nullMoveFen, type Hint } from './hints';

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
export interface ReviewOpts { depth?: number; elo: number; user: 'w' | 'b'; oppElo: number; gameId?: string; onProgress?: (p: number) => void; signal?: { cancelled: boolean } }
/** Analyse complète d'une partie (SAN) : Stockfish multi-PV 3 sur chaque position, puis pipeline du coach. */
export async function coachReview(startFen: string, sans: string[], o: ReviewOpts): Promise<CoachReview> {
  const ch = new Chess(startFen); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const s of sans) { const m = ch.move(s); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  const lines: Line[][] = [];
  for (let i = 0; i < fens.length; i++) {
    if (o.signal?.cancelled) throw new Error('cancelled');
    const c = new Chess(fens[i]);
    if (c.isGameOver()) { lines.push([]); continue; }
    const r = await engine.analyse(fens[i], { depth: o.depth ?? 12, multipv: 3 });
    lines.push(r.lines.map(toLine)); o.onProgress?.((i + 1) / fens.length * 0.95);
  }
  const r = await runReview({ startFen, moves: ucis, lines, elo: o.elo, user: o.user, oppElo: o.oppElo, gameId: o.gameId });
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
  return r.ex;
}
/** Indices gradués pour la position courante. */
export async function coachHints(fen: string, depth = 11): Promise<Hint[]> {
  const r = await engine.analyse(fen, { depth, multipv: 2 });
  const nf = nullMoveFen(fen); let t: Line | null = null;
  if (nf) { try { const x = await engine.analyse(nf, { depth: Math.max(8, depth - 3), multipv: 1 }); t = x.lines[0] ? toLine(x.lines[0]) : null; } catch { t = null; } }
  return hintsFor(fen, r.lines.map(toLine), t);
}
