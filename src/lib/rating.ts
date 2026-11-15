// Classement adaptatif type Glicko simplifié pour les puzzles.
export function expected(r: number, opp: number) { return 1 / (1 + Math.pow(10, (opp - r) / 400)); }
/** Met à jour le classement : K décroît avec le nombre de puzzles joués (convergence rapide au début). */
export function updateRating(r: number, opp: number, win: boolean, games: number) {
  const k = games < 10 ? 60 : games < 30 ? 40 : games < 100 ? 28 : 20;
  const delta = Math.round(k * ((win ? 1 : 0) - expected(r, opp)));
  return { rating: Math.max(100, r + delta), delta };
}
