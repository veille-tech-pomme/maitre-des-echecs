// Ce qui est gratuit (la progression) et ce qui est Premium (confort et profondeur).
import { getEnt } from './entitlements';
import { getState, setState, today } from './store';
export const FREE_REVIEWS_PER_DAY = 3;
export type Feature = 'lessons.expert' | 'review.unlimited' | 'review.deep' | 'repertoire.builder' | 'stats.advanced' | 'cosmetics.extra' | 'cloud.sync';
export const PREMIUM_FEATURES: { id: Feature; icon: string; title: string; desc: string }[] = [
  { id: 'lessons.expert', icon: '👑', title: 'Niveau Expert', desc: 'Calcul, prophylaxie, plans, finales complexes et parties légendaires commentées (Morphy, Anderssen, Fischer).' },
  { id: 'review.unlimited', icon: '♾️', title: 'Bilans illimités', desc: 'Analyse toutes tes parties, sans limite quotidienne.' },
  { id: 'review.deep', icon: '🧑‍🏫', title: 'Coach approfondi', desc: 'Variantes complètes, menaces adverses, principes et chances de gain coup par coup.' },
  { id: 'repertoire.builder', icon: '📚', title: 'Répertoire personnel', desc: 'Construis tes propres lignes d’ouverture et révise-les en répétition espacée.' },
  { id: 'stats.advanced', icon: '📊', title: 'Statistiques avancées', desc: 'Précision par phase de jeu, thèmes faibles, évolution détaillée.' },
  { id: 'cosmetics.extra', icon: '🎨', title: 'Thèmes et pièces exclusifs', desc: '4 jeux de pièces et 4 échiquiers supplémentaires.' },
  { id: 'cloud.sync', icon: '☁️', title: 'Synchronisation', desc: 'Retrouve ta progression sur iPhone et PC (sauvegarde chiffrée).' },
];
export function can(f: Feature): boolean { return getEnt().premium; }
export function reviewsLeft(): number {
  if (getEnt().premium) return Infinity;
  const s = getState(); const used = s.reviews.date === today() ? s.reviews.count : 0;
  return Math.max(0, FREE_REVIEWS_PER_DAY - used);
}
export function consumeReview() { setState((s) => { if (s.reviews.date !== today()) s.reviews = { date: today(), count: 0 }; s.reviews.count++; }); }
