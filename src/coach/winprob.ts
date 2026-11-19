// Score attendu (probabilité de gain + ½ nulle) à partir de l'évaluation du moteur, calibré par l'Elo du joueur.
export interface Score { cp: number | null; mate: number | null }
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** Pente de la logistique : Lichess (0,00368) vers 2400, plus douce pour les débutants. */
export const kOf = (elo: number) => 0.00368208 * (0.55 + 0.45 * clamp((elo - 600) / 1800, 0, 1));
/** Niveau normalisé 0..1 (sert pour la « valeur » d'un mat lointain). */
export const skillOf = (elo: number) => clamp((elo - 400) / 2000, 0, 1);
/** Score attendu (0..1) pour le camp au trait, d'après un score UCI (point de vue du camp au trait). */
export function expectedStm(s: Score, elo = 1500): number {
  if (s.mate != null) {
    if (s.mate === 0) return 0;
    const n = Math.min(Math.abs(s.mate), 10); const e = 1 - 0.02 * n * (1 - skillOf(elo));
    return s.mate > 0 ? e : 1 - e;
  }
  return 1 / (1 + Math.exp(-kOf(elo) * (s.cp || 0)));
}
/** Même chose pour un camp donné, connaissant le camp au trait. */
export function expectedFor(s: Score, stm: 'w' | 'b', side: 'w' | 'b', elo = 1500) { const e = expectedStm(s, elo); return stm === side ? e : 1 - e; }
/** Précision d'un coup (courbe Lichess) à partir de la perte de score attendu (0..1). */
export const accuracyOf = (dE: number) => clamp(103.1668 * Math.exp(-4.354 * dE) - 3.1669, 0, 100);
/** Pourcentage lisible. */
export const pct = (e: number) => Math.round(e * 100);
