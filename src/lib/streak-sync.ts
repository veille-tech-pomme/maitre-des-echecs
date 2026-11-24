// Série souple (R4c) : rapprochement au lancement et au retour sur l'app (jours manqués → vacances, gel ou pause),
// et trace locale dans le journal (streak_saved, streak_broken, streak_milestone, vacation). Rien ne quitte l'appareil.
import { getState, setState, today, onEvent } from './store';
import { reconcile, streakHooks, type StreakNote } from './streak';
import { log } from './events';

function logNotes(notes: StreakNote[]) {
  for (const n of notes) {
    if (n.k === 'freeze') log('streak_saved', { via: 'freeze', day: n.day, freezes: getState().streak.freezes });
    else if (n.k === 'broken') log('streak_broken', { prev: n.prev, repair: n.repair });
    else if (n.k === 'repaired') log('streak_saved', { via: 'repair', count: n.count });
  }
}
export function syncStreak() {
  let notes: StreakNote[] = [];
  const st = getState().streak;
  const pending = JSON.stringify(st);
  setState((s) => { notes = reconcile(s.streak, today()); });
  if (notes.length) logNotes(notes);
  return pending !== JSON.stringify(getState().streak) ? notes : [];
}
let started = false;
export function startStreakSync() {
  if (started) return; started = true;
  syncStreak();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) syncStreak(); });
  onEvent((e) => {
    if (e.type !== 'streak') return;
    const { r } = e; const via = /Série sauvée/.test(e.reason) ? 'mission' : 'play';
    log('streak_saved', { via, count: r.count, earned: !!r.earned });
    if (r.milestone) log('streak_milestone', { n: r.milestone });
  });
  // la réparation se valide dans recordFeed (objectif du jour atteint)
  streakHooks.repaired = (count) => setTimeout(() => log('streak_saved', { via: 'repair', count }), 0);
}
/** notes affichées (Pour toi) puis effacées */
export function clearStreakNotes() { setState((s) => { s.streak.notes = []; }); }
export function vacationLog(days: number | null) { log('vacation', days == null ? { end: true } : { days }); }
