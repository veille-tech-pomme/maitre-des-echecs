// Curriculum adaptatif : choisit les activités au plus fort gain d'apprentissage attendu
// G = importance × écart × préparation × zpd(p) × nouveauté, objectifs hebdomadaires et erreurs personnelles.
import type { State } from '../lib/store';
import { today } from '../lib/store';
import { isDue, newItem } from '../lib/srs';
import { isUnlocked, recommendedBot } from '../lib/plan';
import { LESSONS } from '../data/lessons';
import { SKILLS, SKILL, type SkillId } from './skills';
import { newModel, sync, skillOf, globalRating, levelIdx, pSuccess, weaknesses, evidenceFor, confidence, applyGame, type CoachModel, type WeekGoals } from './model';
import type { CoachReview } from './pipeline';

export interface Activity { id: string; kind: 'mistakes' | 'review' | 'lesson' | 'puzzles' | 'play' | 'endgame' | 'diag'; skill: SkillId | null; title: string; why: string; evidence?: string; route: string; minutes: number; gain: number; difficulty?: number }
const sig = (x: number) => 1 / (1 + Math.exp(-x));
export const zpd = (p: number) => Math.exp(-(((p - 0.75) / 0.15) ** 2));
const LESSON_D: Record<string, number> = { debutant: 600, intermediaire: 1100, avance: 1500, expert: 1900 };

/** Note de départ : classement puzzles s'il est fiable, sinon niveau choisi à l'accueil. */
export const baseOf = (s: State) => (s.coach?.diag ? s.coach.diag.r : s.puzzle.rating || 800);
/** Crée/actualise le modèle à partir de la file d'évènements. Mutation du brouillon `s` (dans setState). */
export function ensureModel(s: State): CoachModel {
  const m = (s.coach ||= newModel(baseOf(s)));
  sync(m, s.coachQ, s.coach.diag ? undefined : s.puzzle.games >= 10 ? s.puzzle.rating : undefined);
  return m;
}
export function gap(m: CoachModel, k: SkillId, g: number) { const st = skillOf(m, k); return sig((g - st.r) / 200) + 0.25 * st.rd / 350; }

export function activities(s: State, m: CoachModel, now = Date.now()): Activity[] {
  const g = globalRating(m); const lv = levelIdx(g); const out: Activity[] = [];
  const doneToday = s.plan.date === today() ? s.plan.done : [];
  const novelty = (id: string) => (doneToday.includes(id) ? 0.25 : 1);
  const weak = weaknesses(m, 6); const wk = new Map(weak.map((w) => [w.skill, w]));
  // 1. tes erreurs à revoir (répétition espacée)
  const dueMist = Object.values(s.srs).filter((x) => x.kind === 'mistake' && isDue(x, now)).length;
  if (dueMist) out.push({ id: 'mistakes', kind: 'mistakes', skill: null, title: `Rejoue ${dueMist} de tes erreurs`, why: 'Des positions tirées de tes parties, revues au bon moment pour ne plus refaire la même faute.', route: '#/review/mistakes', minutes: Math.min(10, 2 * dueMist), gain: (0.95 + 0.03 * Math.min(dueMist, 8)) * novelty('mistakes') });
  // 2. bilan de la dernière partie
  const unrev = s.games.slice().reverse().find((x) => !x.reviewed && x.moves.length >= 10 && now - x.date < 7 * 86400000);
  if (unrev) out.push({ id: 'review:' + unrev.id, kind: 'review', skill: null, title: 'Fais le bilan de ta dernière partie', why: 'Le coach y trouve les moments clés et en tire trois leçons.', route: `#/game/${unrev.id}`, minutes: 4, gain: 1.05 });
  // 3. compétences : puzzles ciblés ou leçon
  for (const sk of SKILLS) {
    const st = skillOf(m, sk.id, now); const imp = Math.sqrt(sk.importance[lv]); const gp = gap(m, sk.id, g);
    const w = wk.get(sk.id); const ev = w?.evidence[0];
    if (sk.theme) {
      const d = zpdDifficulty(st.r, st.rd); // p ≈ 0,75, un peu plus facile si la note est incertaine
      const id = 'weak:' + sk.theme; const G = imp * gp * zpd(pSuccess(st.r, d)) * novelty(id) * (w ? 1.25 : 1);
      out.push({ id, kind: 'puzzles', skill: sk.id, title: `Puzzles : ${sk.label.toLowerCase()}`, why: w ? 'C’est ton point faible prioritaire.' : st.rd > 220 ? 'Le coach connaît encore mal ce domaine chez toi.' : 'Pour consolider ce domaine.', evidence: ev, route: `#/puzzles/theme/${sk.theme}`, minutes: 6, gain: G, difficulty: d });
    }
    if (sk.lesson && !s.lessons[sk.lesson]?.done && LESSONS.some((l) => l.id === sk.lesson)) {
      const L = LESSONS.find((l) => l.id === sk.lesson)!; const ready = isUnlocked(s, L.id) ? 1 : 0.15;
      const p = pSuccess(st.r, LESSON_D[L.level] ?? 1100); const id = 'lesson:' + L.id;
      const G = imp * gp * ready * Math.max(0.3, zpd(Math.min(0.9, p))) * novelty(id) * (w ? 1.15 : 0.9);
      out.push({ id, kind: 'lesson', skill: sk.id, title: `Leçon : ${L.title}`, why: w ? `Pour corriger : ${sk.label.toLowerCase()}.` : 'La prochaine notion utile pour toi.', evidence: ev, route: `#/lesson/${L.id}`, minutes: L.minutes, gain: G });
    }
    if (sk.family === 'endgame' && sk.id !== 'technique' && w) out.push({ id: 'eg:' + sk.id, kind: 'endgame', skill: sk.id, title: 'Entraînement aux finales', why: `Pour progresser en ${sk.label.toLowerCase()}.`, evidence: ev, route: '#/endgames', minutes: 8, gain: imp * gp * 0.9 * novelty('eg:' + sk.id) });
  }
  // 4. partie contre un bot (mise en pratique), plus utile si peu de parties récentes
  const recent = s.games.filter((x) => now - x.date < 3 * 86400000).length;
  const b = recommendedBot(s);
  out.push({ id: 'play', kind: 'play', skill: null, title: 'Joue une partie', why: recent ? 'Mets en pratique ce que tu viens de travailler.' : 'Le coach a besoin de te voir jouer pour mieux t’aider.', route: `#/play/${b}`, minutes: 10, gain: (recent ? 0.35 : 0.75) * novelty('play') });
  // 5. test de placement s'il n'a jamais été fait et que le modèle est vide
  if (!m.diag && m.ev.length < 15) out.push({ id: 'diag', kind: 'diag', skill: null, title: 'Test de niveau (2 min)', why: '6 positions pour que le coach cerne tes forces et tes faiblesses.', route: '#/coach/test', minutes: 2, gain: 1.2 });
  return out.sort((a, b2) => b2.gain - a.gain);
}
/** Plan du jour du coach : 3 à 4 activités variées (pas deux fois la même compétence ni le même type). */
export function coachPlan(s: State, m: CoachModel, n = 4): Activity[] {
  const acts = activities(s, m); const out: Activity[] = []; const kinds: Record<string, number> = {};
  for (const a of acts) {
    if (out.length >= n) break;
    if (a.skill && out.some((x) => x.skill === a.skill)) continue;
    if ((kinds[a.kind] || 0) >= (a.kind === 'puzzles' ? 2 : 1)) continue;
    out.push(a); kinds[a.kind] = (kinds[a.kind] || 0) + 1;
  }
  return out;
}
// ——— objectifs de la semaine ———
export function weekStart(d = new Date()) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return today(x); }
export function ensureWeek(s: State, m: CoachModel): WeekGoals {
  const ws = weekStart();
  if (m.week?.start === ws) return m.week;
  const focus = weaknesses(m, 1)[0]?.skill || coachPlan(s, m).find((a) => a.skill)?.skill || null;
  const goals: WeekGoals['goals'] = [];
  if (focus && SKILL[focus].theme) goals.push({ id: 'focus', label: `15 puzzles « ${SKILL[focus].label.toLowerCase()} »`, target: 15, done: 0, route: `#/puzzles/theme/${SKILL[focus].theme}` });
  goals.push({ id: 'reviews', label: 'Analyser 3 parties avec le coach', target: 3, done: 0, route: '#/play' });
  goals.push({ id: 'mistakes', label: 'Rejouer 5 de tes erreurs', target: 5, done: 0, route: '#/review/mistakes' });
  goals.push({ id: 'days', label: 'T’entraîner 5 jours', target: 5, done: 0, route: '#/' });
  m.week = { start: ws, focus, goals }; return m.week;
}
/** Progrès des objectifs, recalculé à partir des preuves et de l'activité. */
export function weekProgress(s: State, m: CoachModel): WeekGoals | null {
  const w = m.week; if (!w) return null; const t0 = new Date(w.start + 'T00:00:00').getTime();
  const ev = m.ev.filter((e) => e.t >= t0);
  const done = (id: string) => {
    if (id === 'focus') return ev.filter((e) => e.src === 'puzzle' && e.k === w.focus).length;
    if (id === 'reviews') return new Set(ev.filter((e) => e.src === 'game').map((e) => e.ref?.split('#')[0])).size;
    if (id === 'mistakes') return Object.values(s.srs).filter((x) => x.kind === 'mistake' && x.reps > 0 && x.due - x.interval * 86400000 >= t0).length;
    if (id === 'days') return Object.entries(s.activity).filter(([d, xp]) => d >= w.start && xp > 0).length;
    return 0;
  };
  return { ...w, goals: w.goals.map((g) => ({ ...g, done: Math.min(g.target, done(g.id)) })) };
}
// ——— erreurs personnelles → puzzles en répétition espacée ———
export function addMistakes(s: State, m: CoachModel, r: CoachReview, gameId: string, now = Date.now()) {
  let n = 0;
  for (const x of r.retries) {
    const mv = r.moves[x.ply]; if (!mv || mv.dE < 0.1) continue;
    const id = 'm:' + gameId + ':' + x.ply;
    if (m.mistakes[id]) continue;
    m.mistakes[id] = { fen: x.fen, sol: x.solution, motif: x.motif, game: gameId, ply: x.ply, prompt: mv.ex?.headline || x.prompt, at: now };
    s.srs[id] = newItem(id, 'mistake', now); n++;
  }
  const ids = Object.keys(m.mistakes); if (ids.length > 120) for (const k of ids.slice(0, ids.length - 120)) { delete m.mistakes[k]; delete s.srs[k]; }
  return n;
}
/** Difficulté visée pour p ≈ 0,75 (zone proximale), un peu plus facile quand la note est incertaine. */
export const zpdDifficulty = (r: number, rd: number) => Math.round(r - 191 - 0.25 * Math.max(0, rd - 80));
/** Difficulté de puzzle visée pour un thème, d'après la note de la compétence correspondante (null si le coach ne la connaît pas). */
export function themeTarget(s: State, theme: string): number | null {
  const sk = SKILLS.find((x) => x.theme === theme); if (!sk || !s.coach) return null;
  const st = skillOf(s.coach, sk.id); return st.n ? zpdDifficulty(st.r, st.rd) : null;
}
/** Intègre une partie analysée : observations du modèle + erreurs personnelles. */
export function ingestReview(s: State, r: CoachReview, gameId: string) {
  const m = ensureModel(s); const fresh = applyGame(m, gameId, r.events); if (fresh) addMistakes(s, m, r, gameId); return fresh;
}
/** Phrase d'accroche de la carte « Ton coach ». */
export function coachHeadline(s: State, m: CoachModel): { title: string; text: string } {
  const w = weaknesses(m, 1)[0]; const nGames = m.games;
  if (!m.ev.length) return { title: 'Faisons connaissance', text: 'Fais le test de niveau ou joue une partie : je repérerai tes forces et tes faiblesses.' };
  if (w) return { title: `Priorité : ${w.label.toLowerCase()}`, text: w.evidence[0] || 'C’est là que tu peux gagner le plus de points.' };
  const known = Object.values(m.skills).filter((x) => x && confidence(x.rd) > 0.4).length;
  return { title: 'Rien d’alarmant', text: nGames ? `Pas de faiblesse nette sur ${known} compétences suivies. On consolide et on élargit.` : 'Analyse une partie pour que je voie ton jeu en situation réelle.' };
}
export { evidenceFor };
