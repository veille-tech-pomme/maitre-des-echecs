import type { IconName } from '../components/Icon';
/** Correspondances visuelles (icônes vectorielles, couleurs système) pour les données métier. */
export const LEVEL_VIS: Record<string, { icon: IconName; color: string }> = {
  debutant: { icon: 'sprout', color: '#30A46C' },
  intermediaire: { icon: 'swords', color: '#0A84FF' },
  avance: { icon: 'castle', color: '#BF5AF2' },
  expert: { icon: 'crown', color: '#F2B544' },
};
export const levelColor = (id: string) => LEVEL_VIS[id]?.color || '#8E8E93';
export function planIcon(id: string): { icon: IconName; color: string } {
  const k = id.split(':')[0];
  return ({
    srs: { icon: 'repeat', color: '#5E5CE6' },
    lesson: { icon: 'learn', color: '#30A46C' },
    weak: { icon: 'target', color: '#FF453A' },
    puzzles: { icon: 'puzzle', color: '#FF9F0A' },
    daily: { icon: 'calendar', color: '#0A84FF' },
    review: { icon: 'microscope', color: '#64D2FF' },
    play: { icon: 'play', color: '#BF5AF2' },
  } as Record<string, { icon: IconName; color: string }>)[k] || { icon: 'star', color: '#8E8E93' };
}
export const BADGE_ICON: Record<string, { icon: IconName; color: string }> = {
  'first-lesson': { icon: 'learn', color: '#30A46C' }, debutant: { icon: 'sprout', color: '#30A46C' }, intermediaire: { icon: 'swords', color: '#0A84FF' },
  avance: { icon: 'castle', color: '#BF5AF2' }, expert: { icon: 'crown', color: '#F2B544' }, 'puzzle-10': { icon: 'puzzle', color: '#FF9F0A' },
  'puzzle-100': { icon: 'brain', color: '#FF9F0A' }, 'puzzle-500': { icon: 'gem', color: '#64D2FF' }, 'rating-1200': { icon: 'trend', color: '#30D158' },
  'rating-1600': { icon: 'mountain', color: '#30D158' }, 'rating-2000': { icon: 'sparkles', color: '#F2B544' }, 'streak-3': { icon: 'flame', color: '#FF9F0A' },
  'streak-7': { icon: 'calendar', color: '#FF9F0A' }, 'streak-30': { icon: 'trophy', color: '#F2B544' }, 'puzzle-streak-10': { icon: 'bolt', color: '#FFD60A' },
  'rush-15': { icon: 'timer', color: '#FF9F0A' }, 'first-win': { icon: 'medal', color: '#F2B544' }, 'beat-ines': { icon: 'user', color: '#BF5AF2' },
  'beat-victor': { icon: 'award', color: '#FF453A' }, reviewer: { icon: 'microscope', color: '#64D2FF' }, 'accuracy-90': { icon: 'target', color: '#FF453A' },
  endgames: { icon: 'flag', color: '#5E5CE6' }, openings: { icon: 'book', color: '#30A46C' }, 'srs-20': { icon: 'repeat', color: '#5E5CE6' },
};
export const badgeVis = (id: string) => BADGE_ICON[id] || { icon: 'badge' as IconName, color: '#F2B544' };
