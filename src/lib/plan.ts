// Plan d'apprentissage personnalisé : détecte les faiblesses (puzzles + parties) et propose les prochaines actions.
import type { State } from './store';
import { today } from './store';
import { LESSONS, LEVELS } from '../data/lessons';
import { themeName } from '../data/themes';
import { isDue } from './srs';

export interface Weakness { key: string; label: string; score: number; evidence: string; lesson?: string; theme?: string; route: string }
export interface PlanItem { id: string; icon: string; title: string; why: string; route: string; done: boolean }

const TAG_MAP: Record<string, { label: string; theme?: string; lesson: string }> = {
  hanging: { label: 'Pièces laissées en prise', theme: 'hangingPiece', lesson: 'i-materiel' },
  tacticAllowed: { label: 'Tactiques adverses non vues', theme: 'defensiveMove', lesson: 'i-calcul' },
  missedMate: { label: 'Mats manqués', theme: 'mateIn2', lesson: 'i-calcul' },
  allowedMate: { label: 'Sécurité du roi', theme: 'backRankMate', lesson: 'i-couloir' },
  'missed:fork': { label: 'Fourchettes manquées', theme: 'fork', lesson: 'i-fourchette' },
  'missed:pin': { label: 'Clouages manqués', theme: 'pin', lesson: 'i-clouage' },
  'missed:skewer': { label: 'Enfilades manquées', theme: 'skewer', lesson: 'i-enfilade' },
  'missed:discoveredAttack': { label: 'Découvertes manquées', theme: 'discoveredAttack', lesson: 'i-decouverte' },
  'missed:freePiece': { label: 'Pièces gratuites non prises', theme: 'hangingPiece', lesson: 'i-materiel' },
  missedTactic: { label: 'Occasions tactiques manquées', theme: 'fork', lesson: 'i-calcul' },
  opening: { label: 'Principes d’ouverture', lesson: 'i-principes' },
  endgame: { label: 'Technique de finale', theme: 'pawnEndgame', lesson: 'a-opposition' },
};
const THEME_LESSON: Record<string, string> = { fork: 'i-fourchette', pin: 'i-clouage', skewer: 'i-enfilade', discoveredAttack: 'i-decouverte', doubleCheck: 'i-decouverte', hangingPiece: 'i-materiel', backRankMate: 'i-couloir', mateIn1: 'd-mat', mateIn2: 'i-calcul', smotheredMate: 'i-mats-typiques', pawnEndgame: 'a-opposition', rookEndgame: 'e-finales-tours', zugzwang: 'e-finales-complexes', defensiveMove: 'e-prophylaxie', quietMove: 'e-plans', mateIn3: 'e-calcul' };

export function isUnlocked(s: State, lessonId: string): boolean {
  const idx = LESSONS.findIndex((l) => l.id === lessonId); if (idx <= 0) return true;
  const l = LESSONS[idx];
  const sameLevel = LESSONS.filter((x) => x.level === l.level);
  const pos = sameLevel.indexOf(l);
  // première leçon d'un niveau : débloquée si le niveau précédent est fait à 70 % (ou test de niveau)
  if (pos === 0) {
    const li = LEVELS.findIndex((x) => x.id === l.level); const prev = LEVELS[li - 1]; if (!prev) return true;
    const pl = LESSONS.filter((x) => x.level === prev.id); return pl.filter((x) => s.lessons[x.id]?.done).length >= Math.ceil(pl.length * 0.7) || !!s.lessons['unlock-' + l.level];
  }
  // sinon : la leçon précédente du niveau est faite (ou n'importe quelle leçon après elle)
  return !!s.lessons[sameLevel[pos - 1].id]?.done || !!s.lessons['unlock-' + l.level] || sameLevel.slice(pos).some((x) => s.lessons[x.id]?.done);
}
export function nextLesson(s: State) { return LESSONS.find((l) => !s.lessons[l.id]?.done && isUnlocked(s, l.id)); }

export function weaknesses(s: State): Weakness[] {
  const out: Weakness[] = [];
  for (const [t, st] of Object.entries(s.themes)) {
    const n = st.ok + st.ko; if (n < 3 || ['middlegame', 'endgame', 'mate', 'opening'].includes(t)) continue;
    const fail = (st.ko + 1) / (n + 2);
    if (fail > 0.4) out.push({ key: 'theme:' + t, label: themeName(t), score: fail * Math.min(1, n / 8), evidence: `${st.ko} échec${st.ko > 1 ? 's' : ''} sur ${n} puzzles`, theme: t, lesson: THEME_LESSON[t], route: `#/puzzles/theme/${t}` });
  }
  const tags: Record<string, number> = {}; const recent = s.games.filter((g) => g.weaknesses?.length).slice(-10);
  for (const g of recent) for (const t of g.weaknesses || []) tags[t] = (tags[t] || 0) + 1;
  for (const [t, c] of Object.entries(tags)) {
    const m = TAG_MAP[t]; if (!m) continue;
    const ex = out.find((w) => w.theme && w.theme === m.theme);
    const sc = Math.min(1, c / Math.max(2, recent.length)) * 0.9 + 0.1;
    if (ex) { ex.score += sc; ex.evidence += ` · ${c}× dans tes parties`; }
    else out.push({ key: 'tag:' + t, label: m.label, score: sc, evidence: `${c}× dans tes ${recent.length} dernières parties analysées`, theme: m.theme, lesson: m.lesson, route: m.theme ? `#/puzzles/theme/${m.theme}` : `#/lesson/${m.lesson}` });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}
export function recommendedBot(s: State) {
  const r = s.puzzle.games >= 10 ? s.puzzle.rating - 250 : 300 + LESSONS.filter((l) => s.lessons[l.id]?.done).length * 35;
  const ids = [['paulette', 250], ['leo', 500], ['odette', 800], ['hugo', 1100], ['ines', 1400], ['comte', 1700], ['morgane', 2000], ['victor', 2400], ['max', 3000]] as const;
  let best: string = ids[0][0]; for (const [id, e] of ids) if (e <= r + 150) best = id; return best;
}
export function dailyPlan(s: State): PlanItem[] {
  const d = today(); const done = s.plan.date === d ? s.plan.done : [];
  const items: PlanItem[] = [];
  const due = Object.values(s.srs).filter((x) => isDue(x)).length;
  if (due) items.push({ id: 'srs', icon: '🔁', title: `Réviser ${due} élément${due > 1 ? 's' : ''}`, why: 'La répétition espacée ancre durablement ce que tu as raté.', route: '#/review', done: done.includes('srs') });
  const nl = nextLesson(s);
  if (nl) items.push({ id: 'lesson:' + nl.id, icon: nl.icon, title: `Leçon : ${nl.title}`, why: 'Prochaine étape de ton parcours.', route: `#/lesson/${nl.id}`, done: done.includes('lesson:' + nl.id) });
  const w = weaknesses(s)[0];
  if (w?.theme) items.push({ id: 'weak:' + w.theme, icon: '🎯', title: `5 puzzles « ${themeName(w.theme)} »`, why: `Point faible détecté : ${w.evidence}.`, route: `#/puzzles/theme/${w.theme}`, done: done.includes('weak:' + w.theme) });
  else items.push({ id: 'puzzles', icon: '🧩', title: '5 puzzles classés', why: 'Entretiens ta vision tactique.', route: '#/puzzles/rated', done: done.includes('puzzles') });
  items.push({ id: 'daily', icon: '📅', title: 'Coup du jour', why: 'La même position pour tout le monde, chaque jour.', route: '#/jour', done: !!s.daily[d] });
  const unrev = s.games.slice().reverse().find((g) => !g.reviewed && g.moves.length >= 10);
  if (unrev) items.push({ id: 'review:' + unrev.id, icon: '🔬', title: 'Fais le bilan de ta dernière partie', why: 'Comprendre ses erreurs est le moyen le plus rapide de progresser.', route: `#/game/${unrev.id}`, done: false });
  else { const b = recommendedBot(s); items.push({ id: 'play', icon: '♟️', title: 'Joue une partie', why: 'Mets en pratique contre un adversaire de ton niveau.', route: `#/play/${b}`, done: done.includes('play') }); }
  return items.slice(0, 5);
}
export function markPlanDone(s: State, id: string) { const d = today(); if (s.plan.date !== d) s.plan = { date: d, done: [] }; if (!s.plan.done.includes(id)) s.plan.done.push(id); }
