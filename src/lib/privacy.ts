// Données locales vs publiques (R4a, plan §6.5). Rien n'est public aujourd'hui : tout reste sur l'appareil.
// Cette carte dit seulement ce qui POURRA devenir public plus tard (avec un compte, et sur choix du joueur),
// et ce qui restera privé par défaut. Le typage force à classer tout nouveau champ de l'état.
import type { State } from './store';

export type Visibility = 'private' | 'public-candidate' | 'mixed';
export const FIELD_VISIBILITY: Record<keyof State, Visibility> = {
  v: 'private', createdAt: 'private', deviceId: 'private', installDay: 'private', consent: 'private',
  xp: 'public-candidate', streak: 'public-candidate', badges: 'public-candidate',
  puzzle: 'mixed', settings: 'mixed',
  activity: 'private', lessons: 'private', themes: 'private', daily: 'private', jour: 'private', rush: 'private', srs: 'private', games: 'private',
  reviews: 'private', openings: 'private', repertoire: 'private', endgames: 'private', plan: 'private', onboarded: 'private',
  obMate: 'private', placement: 'private', trial: 'private', training: 'private', coach: 'private', coachQ: 'private',
  session: 'private', feed: 'private',
};
/** sous-champs publiables des champs « mixed » (pseudonyme, classement) ; le reste de ces champs est privé */
export const PUBLIC_SUBFIELDS: Record<string, string[]> = { settings: ['name'], puzzle: ['rating'] };
