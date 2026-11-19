// Classification des coups (théorie → gaffe) calibrée par l'Elo, et détection des moments critiques.
export type MoveClass = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
export const CLASSES: Record<MoveClass, { label: string; symbol: string; color: string; good: boolean }> = {
  book: { label: 'Théorie', symbol: '≡', color: '#A88865', good: true },
  brilliant: { label: 'Brillant', symbol: '!!', color: '#1BADA6', good: true },
  great: { label: 'Coup unique', symbol: '!', color: '#5C8BB0', good: true },
  best: { label: 'Meilleur coup', symbol: '★', color: '#81B64C', good: true },
  excellent: { label: 'Excellent', symbol: '✓', color: '#81B64C', good: true },
  good: { label: 'Bon', symbol: '✓', color: '#95B776', good: true },
  inaccuracy: { label: 'Imprécision', symbol: '?!', color: '#F7C045', good: false },
  mistake: { label: 'Erreur', symbol: '?', color: '#E58F2A', good: false },
  miss: { label: 'Occasion manquée', symbol: '✕', color: '#EE6B55', good: false },
  blunder: { label: 'Gaffe', symbol: '??', color: '#CA3431', good: false },
};
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** Seuils de perte de score attendu, plus indulgents sous 1500 Elo. */
export function thresholds(elo: number) {
  const f = 1 + 0.35 * clamp((1500 - elo) / 1000, -0.5, 1);
  return { inaccuracy: 0.05 * f, mistake: 0.1 * f, blunder: 0.2 * f };
}
export interface ClassifyIn {
  dE: number; eBest: number; ePlayed: number; eBefore: number; isBest: boolean; book: boolean;
  sacrifice: boolean; gap12: number | null; mate: boolean; elo: number;
}
export function classifyMove(x: ClassifyIn): MoveClass {
  const t = thresholds(x.elo);
  if (x.book) return 'book';
  if (x.mate) return 'best';
  if (x.sacrifice && x.dE <= 0.02 && x.eBefore < 0.9 && x.ePlayed >= 0.5) return 'brilliant';
  if (x.isBest && x.gap12 != null && x.gap12 >= 0.15 && x.eBefore < 0.95) return 'great';
  if (x.isBest || x.dE < 0.01) return 'best';
  if (x.eBest >= 0.8 && x.ePlayed < 0.6 && x.dE < t.blunder * 1.75) return 'miss';
  if (x.dE < 0.03) return 'excellent';
  if (x.dE < t.inaccuracy) return 'good';
  if (x.dE < t.mistake) return 'inaccuracy';
  if (x.dE < t.blunder) return 'mistake';
  return 'blunder';
}
export interface Criticality { ply: number; score: number; reason: 'error' | 'onlyMove' | 'swing' }
/** Moments critiques : grosses pertes, positions à coup unique, bascules ; espacés d'au moins `gap` demi-coups. */
export function criticalMoments(items: { ply: number; dE: number; gap12: number | null; swing: number; mine: boolean }[], n = 3, gap = 4): Criticality[] {
  const sc = items.filter((x) => x.mine).map((x) => {
    const a = x.dE, b = x.gap12 != null && x.gap12 >= 0.15 ? x.gap12 * 0.8 : 0, c = x.swing * 0.6;
    const score = Math.max(a, b, c);
    return { ply: x.ply, score, reason: (score === a ? 'error' : score === b ? 'onlyMove' : 'swing') as Criticality['reason'] };
  }).filter((x) => x.score >= 0.08).sort((p, q) => q.score - p.score);
  const out: Criticality[] = [];
  for (const x of sc) { if (out.length >= n) break; if (out.every((o) => Math.abs(o.ply - x.ply) >= gap)) out.push(x); }
  return out.sort((p, q) => p.ply - q.ply);
}
