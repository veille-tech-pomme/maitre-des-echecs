// Enregistrement des résultats (puzzles, badges) et mise à jour du profil.
import { getState, setState, emit, addXp, today, pushCoach } from './store';
import { newBadges } from './badges';
import { updateRating } from './rating';
import { newItem, review } from './srs';
import type { Puzzle } from './puzzles';

export function checkBadges() {
  const b = newBadges(getState());
  if (!b.length) return;
  setState((s) => { for (const x of b) s.badges[x.id] = Date.now(); });
  for (const x of b) emit({ type: 'badge', id: `${x.icon} ${x.name}` });
}
/** mode : rated (classé), theme, daily, rush, review (SRS), lesson */
export function recordPuzzle(p: Puzzle, success: boolean, mode: 'rated' | 'theme' | 'daily' | 'rush' | 'review') {
  let delta = 0;
  setState((s) => {
    if (mode === 'rated' || mode === 'theme' || mode === 'daily') {
      const r = updateRating(s.puzzle.rating, p.r, success, s.puzzle.games); delta = r.delta;
      s.puzzle.rating = r.rating; s.puzzle.games++; s.puzzle.history.push({ t: Date.now(), r: r.rating }); if (s.puzzle.history.length > 500) s.puzzle.history.shift();
    }
    if (success) { s.puzzle.solved++; s.puzzle.streak++; s.puzzle.bestStreak = Math.max(s.puzzle.bestStreak, s.puzzle.streak); } else { s.puzzle.failed++; s.puzzle.streak = 0; }
    if (!s.puzzle.seen.includes(p.i)) { s.puzzle.seen.push(p.i); if (s.puzzle.seen.length > 2000) s.puzzle.seen.shift(); }
    for (const t of p.t) { const ts = (s.themes[t] ||= { ok: 0, ko: 0 }); success ? ts.ok++ : ts.ko++; }
    const key = 'p:' + p.i;
    if (mode === 'review' && s.srs[key]) s.srs[key] = review(s.srs[key], success ? 2 : 0);
    else if (!success && !s.srs[key]) s.srs[key] = newItem(key, 'puzzle');
    if (mode === 'daily' && success) s.daily[today()] = true;
    if (mode !== 'rush') pushCoach(s, { k: 'puzzle', t: Date.now(), id: p.i, r: p.r, th: p.t, ok: success, plies: p.m.split(' ').length - 1 });
  });
  if (success) addXp(mode === 'rush' ? 2 : mode === 'daily' ? 20 : 8, mode === 'daily' ? 'Puzzle du jour' : 'Puzzle résolu');
  checkBadges();
  return delta;
}
