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
