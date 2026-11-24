// FSRS (ts-fsrs, MIT) derrière la façade SrsItem / review() de srs.ts (pilier 2). Chargé à la demande, juste après
// le premier affichage (hors du premier chargement). Un élément SM-2 existant est converti en carte FSRS à sa
// première révision (migration sans perte : répétitions, oublis, échéance et intervalle conservés).
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { SrsItem } from './srs';

const DAY = 86400000;
/** rétention visée : 90 % (par défaut FSRS) ; pas de flou aléatoire, pour des tests reproductibles */
export const RETENTION = 0.9;
const F = fsrs(generatorParameters({ request_retention: RETENTION, enable_fuzz: false, enable_short_term: true, maximum_interval: 3650 }));
export interface FsrsState { s: number; d: number; st: number; lr: number | null; sd: number; ls: number; rp: number; lp: number }
/** SM-2 → état FSRS initial : stabilité ≈ intervalle (rétention 90 %), difficulté depuis la facilité (2,5 → 5 ; 1,3 → 9). */
export function fromSm2(it: SrsItem): Card {
  const c = createEmptyCard(new Date(it.added || Date.now()));
  if (!it.reps && !it.lapses) return { ...c, due: new Date(it.due) };
  const st = it.reps > 0 ? State.Review : State.Relearning;
  const last = it.reps > 0 ? it.due - it.interval * DAY : it.due - 10 * 60000;
  return { ...c, due: new Date(it.due), stability: Math.max(0.5, it.interval || 0.5), difficulty: Math.min(10, Math.max(1, 5 + (2.5 - (it.ease || 2.5)) * (4 / 1.2))), state: st, reps: it.reps, lapses: it.lapses, last_review: new Date(last), scheduled_days: it.interval, learning_steps: 0, elapsed_days: 0 } as Card;
}
export function toCard(it: SrsItem): Card {
  const f = it.f; if (!f) return fromSm2(it);
  return { ...createEmptyCard(new Date(it.added)), due: new Date(it.due), stability: f.s, difficulty: f.d, state: f.st as State, last_review: f.lr != null ? new Date(f.lr) : undefined, scheduled_days: f.sd, learning_steps: f.ls, reps: f.rp, lapses: f.lp, elapsed_days: 0 } as Card;
}
const GRADE: Record<0 | 1 | 2 | 3, Grade> = { 0: Rating.Again, 1: Rating.Hard, 2: Rating.Good, 3: Rating.Easy };
/** grade : 0 = raté, 1 = difficile, 2 = bon, 3 = facile */
export function fsrsReview(it: SrsItem, grade: 0 | 1 | 2 | 3, now = Date.now()): SrsItem {
  const r = F.next(toCard(it), new Date(now), GRADE[grade]); const c = r.card;
  const interval = Math.max(0, Math.round((c.due.getTime() - now) / DAY));
  return { ...it, due: c.due.getTime(), interval, reps: c.reps, lapses: c.lapses, ease: it.ease,
    f: { s: Math.round(c.stability * 1e4) / 1e4, d: Math.round(c.difficulty * 1e4) / 1e4, st: c.state, lr: c.last_review ? c.last_review.getTime() : now, sd: c.scheduled_days, ls: c.learning_steps, rp: c.reps, lp: c.lapses } };
}
/** probabilité de s'en souvenir maintenant (rétention FSRS) */
export function retrievability(it: SrsItem, now = Date.now()): number { return (F as any).get_retrievability ? (F as any).get_retrievability(toCard(it), new Date(now), false) : (F as any).retrievability?.(toCard(it), new Date(now)); }
