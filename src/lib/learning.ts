// Pilier 2 (cahier GOAT) : enregistrement, sans charger le coach, des résultats d'exercices par notion et des erreurs
// à revoir. Le modèle (coach/model.ts, sync) consomme ces évènements ; la carte SRS (FSRS) est créée ici.
import { pushCoach, type State } from './store';
import { newItem } from './srs';
import { conceptsOfStep } from '../data/concepts';
import type { Step } from '../data/lessons/types';

export const MAX_LESSON_MISTAKES = 60;
/** Résultat d'un exercice (une observation par notion de l'étape). */
export function recordStep(s: State, o: { lessonId: string; step: Step; ok: boolean; hint: number; firstTry: boolean; fen?: string; interleaved?: boolean; t?: number }) {
  const ids = conceptsOfStep(o.lessonId, o.step); if (!ids.length) return;
  pushCoach(s, { k: 'concept', t: o.t ?? Date.now(), ids, ok: o.ok, h: o.hint, f: o.firstTry, fen: o.fen, il: o.interleaved, src: o.lessonId.startsWith('partie-') || o.lessonId.includes(':') ? 'course' : 'lesson' });
}
/** Erreur de leçon ou d'exercice : une carte « erreur » (position avant le coup, solution) qui revient dans le fil. */
export function recordExerciseMistake(s: State, o: { lessonId: string; stepIdx: number; step: Step; fen: string; sol: string[]; played: string; headline: string; concept?: string; t?: number; course?: boolean }) {
  const t = o.t ?? Date.now(); const id = `x:${o.lessonId}:${o.stepIdx}`;
  if (!o.sol.length) return;
  const concept = o.concept || conceptsOfStep(o.lessonId, o.step)[0];
  const prompt = (o.step.type === 'exercise' ? o.step.prompt : '') || o.headline;
  if (!s.srs[id]) { s.srs[id] = { ...newItem(id, 'mistake', t), concept }; }
  pushCoach(s, { k: 'mistake', t, id, fen: o.fen, sol: o.sol, played: o.played, concept, prompt: prompt.replace(/\*\*/g, ''), src: o.course ? 'course' : 'lesson' });
  // borne : les plus anciennes erreurs de leçon disparaissent de la file (les erreurs de parties ne sont pas touchées)
  const ks = Object.keys(s.srs).filter((k) => k.startsWith('x:')); if (ks.length > MAX_LESSON_MISTAKES) for (const k of ks.sort((a, b) => s.srs[a].added - s.srs[b].added).slice(0, ks.length - MAX_LESSON_MISTAKES)) delete s.srs[k];
}
