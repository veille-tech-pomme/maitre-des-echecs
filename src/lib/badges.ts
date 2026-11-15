// Succès / badges.
import type { State } from './store';
import { LESSONS } from '../data/lessons';
export interface Badge { id: string; icon: string; name: string; desc: string; test: (s: State) => boolean }
const lessonsDone = (s: State, lvl?: string) => LESSONS.filter((l) => (!lvl || l.level === lvl) && s.lessons[l.id]?.done).length;
const allOf = (s: State, lvl: string) => LESSONS.filter((l) => l.level === lvl).every((l) => s.lessons[l.id]?.done);
export const BADGES: Badge[] = [
  { id: 'first-lesson', icon: '🎓', name: 'Premier pas', desc: 'Termine ta première leçon.', test: (s) => lessonsDone(s) >= 1 },
  { id: 'debutant', icon: '🌱', name: 'Les règles n’ont plus de secret', desc: 'Termine le niveau Débutant.', test: (s) => allOf(s, 'debutant') },
  { id: 'intermediaire', icon: '⚔️', name: 'Tacticien', desc: 'Termine le niveau Intermédiaire.', test: (s) => allOf(s, 'intermediaire') },
  { id: 'avance', icon: '🏰', name: 'Stratège', desc: 'Termine le niveau Avancé.', test: (s) => allOf(s, 'avance') },
  { id: 'expert', icon: '👑', name: 'Maître', desc: 'Termine le niveau Expert.', test: (s) => allOf(s, 'expert') },
  { id: 'puzzle-10', icon: '🧩', name: 'Résolveur', desc: 'Résous 10 puzzles.', test: (s) => s.puzzle.solved >= 10 },
  { id: 'puzzle-100', icon: '🧠', name: 'Cerveau d’acier', desc: 'Résous 100 puzzles.', test: (s) => s.puzzle.solved >= 100 },
  { id: 'puzzle-500', icon: '💎', name: 'Machine à puzzles', desc: 'Résous 500 puzzles.', test: (s) => s.puzzle.solved >= 500 },
  { id: 'rating-1200', icon: '📈', name: 'Cap des 1200', desc: 'Atteins 1200 au classement puzzles.', test: (s) => s.puzzle.rating >= 1200 },
  { id: 'rating-1600', icon: '🚀', name: 'Cap des 1600', desc: 'Atteins 1600 au classement puzzles.', test: (s) => s.puzzle.rating >= 1600 },
  { id: 'rating-2000', icon: '🌟', name: 'Cap des 2000', desc: 'Atteins 2000 au classement puzzles.', test: (s) => s.puzzle.rating >= 2000 },
  { id: 'streak-3', icon: '🔥', name: 'En feu', desc: '3 jours d’affilée.', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', icon: '📅', name: 'Une semaine parfaite', desc: '7 jours d’affilée.', test: (s) => s.streak.best >= 7 },
  { id: 'streak-30', icon: '🏆', name: 'Discipline de champion', desc: '30 jours d’affilée.', test: (s) => s.streak.best >= 30 },
  { id: 'puzzle-streak-10', icon: '⚡', name: 'Sans faute', desc: '10 puzzles réussis d’affilée.', test: (s) => s.puzzle.bestStreak >= 10 },
  { id: 'rush-15', icon: '⏱️', name: 'Sprinteur', desc: 'Score de 15 en Course contre la montre.', test: (s) => s.rush.best3 >= 15 || s.rush.best5 >= 15 },
  { id: 'first-win', icon: '🥇', name: 'Première victoire', desc: 'Bats un bot.', test: (s) => s.games.some((g) => (g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b')) },
  { id: 'beat-ines', icon: '👩‍🏫', name: 'L’élève dépasse le maître', desc: 'Bats la Professeure Inès (1400).', test: (s) => s.games.some((g) => g.botId === 'ines' && ((g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b'))) },
  { id: 'beat-victor', icon: '🦁', name: 'Tombeur de GM', desc: 'Bats le GM Victor (2400).', test: (s) => s.games.some((g) => g.botId === 'victor' && ((g.result === '1-0' && g.color === 'w') || (g.result === '0-1' && g.color === 'b'))) },
  { id: 'reviewer', icon: '🔬', name: 'Autocritique', desc: 'Fais le bilan de 5 parties.', test: (s) => s.games.filter((g) => g.reviewed).length >= 5 },
  { id: 'accuracy-90', icon: '🎯', name: 'Précision chirurgicale', desc: 'Joue une partie à plus de 90 % de précision.', test: (s) => s.games.some((g) => (g.accuracy || 0) >= 90 && g.moves.length >= 30) },
  { id: 'endgames', icon: '♔', name: 'Technicien', desc: 'Réussis 5 exercices de finale.', test: (s) => Object.values(s.endgames).filter((e) => e.done).length >= 5 },
  { id: 'openings', icon: '📖', name: 'Théoricien', desc: 'Réussis 10 lignes d’ouverture.', test: (s) => Object.values(s.openings).filter((o) => o.ok > 0).length >= 10 },
  { id: 'srs-20', icon: '🔁', name: 'Mémoire d’éléphant', desc: 'Maîtrise 20 éléments en révision espacée.', test: (s) => Object.values(s.srs).filter((x) => x.interval >= 21).length >= 20 },
];
export function newBadges(s: State): Badge[] { return BADGES.filter((b) => !s.badges[b.id] && b.test(s)); }
