// Éléments d'interface partagés du coach.
import { useEffect } from 'preact/hooks';
import { setState, type State } from '../../lib/store';
import { ensureModel, ensureWeek, weekStart } from '../curriculum';
import type { IconName } from '../../components/Icon';
import type { Activity } from '../curriculum';

export const ACT_ICON: Record<Activity['kind'], { icon: IconName; color: string }> = {
  mistakes: { icon: 'repeat', color: '#5E5CE6' }, review: { icon: 'microscope', color: '#64D2FF' }, lesson: { icon: 'book', color: '#30D158' },
  puzzles: { icon: 'target', color: '#FF453A' }, play: { icon: 'play', color: '#F2B544' }, endgame: { icon: 'king', color: '#BF5AF2' }, diag: { icon: 'gauge', color: '#FF9F0A' },
};
/** Synchronise le modèle (file d'évènements, semaine) une fois au montage si nécessaire. */
export function useCoachSync(s: State) {
  const need = !s.coach || (s.coachQ?.n || 0) !== s.coach.seenQ || s.coach.week?.start !== weekStart();
  useEffect(() => { if (need) setState((d) => { const m = ensureModel(d); ensureWeek(d, m); }); }, [need]);
  return !need;
}
