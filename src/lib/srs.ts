// Répétition espacée (SM-2 simplifié) pour les puzzles manqués et les lignes d'ouverture.
export interface SrsItem { id: string; kind: 'puzzle' | 'opening' | 'repertoire'; due: number; interval: number; ease: number; reps: number; lapses: number; added: number }
const DAY = 86400000;
export function newItem(id: string, kind: SrsItem['kind'], now = Date.now()): SrsItem {
  return { id, kind, due: now + 10 * 60000, interval: 0, ease: 2.5, reps: 0, lapses: 0, added: now };
}
/** grade : 0 = raté, 1 = difficile, 2 = bon, 3 = facile */
export function review(it: SrsItem, grade: 0 | 1 | 2 | 3, now = Date.now()): SrsItem {
  const n = { ...it };
  if (grade === 0) {
    n.reps = 0; n.lapses++; n.interval = 0; n.ease = Math.max(1.3, n.ease - 0.2); n.due = now + 10 * 60000;
    return n;
  }
  n.reps++;
  if (n.reps === 1) n.interval = grade === 3 ? 3 : 1;
  else if (n.reps === 2) n.interval = grade === 1 ? 2 : grade === 3 ? 7 : 4;
  else n.interval = Math.round(n.interval * (grade === 1 ? 1.2 : grade === 3 ? n.ease * 1.3 : n.ease));
  n.ease = Math.max(1.3, n.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
  n.due = now + n.interval * DAY;
  return n;
}
export const isDue = (it: SrsItem, now = Date.now()) => it.due <= now;
/** Un élément est « maîtrisé » quand l'intervalle dépasse 21 jours. */
export const isMastered = (it: SrsItem) => it.interval >= 21;
