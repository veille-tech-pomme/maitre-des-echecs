// Fil « Pour toi » : le coach EST l'algorithme. Pas de second système de recommandation :
// les cartes sont classées par le gain d'apprentissage du curriculum (faiblesse × importance × zone proximale),
// plus les erreurs dues (répétition espacée), les coups de maîtres et une mini-étape de la leçon en cours.
// Le fil a une fin quotidienne (DAILY_CARDS) : pas de puits sans fond.
import type { State, FeedState, FeedStat } from '../lib/store';
import { today, pushCoach } from '../lib/store';
import { isDue } from '../lib/srs';
import { nextLesson } from '../lib/plan';
import type { Lesson, Step } from '../data/lessons';
import { SKILL, MOTIF_SKILL, type SkillId } from './skills';
import { activities, zpdDifficulty } from './curriculum';
import { skillOf, globalRating, levelIdx, weaknesses, type CoachModel } from './model';

export type CardKind = 'puzzle' | 'mate1' | 'threat' | 'master' | 'mistake' | 'lesson';
export interface FeedCard {
  /** identifiant de la source (une même source peut revenir plusieurs fois par jour, avec un contenu différent) */
  id: string; kind: CardKind; skill: SkillId | null; gain: number;
  /** phrase du coach (« pourquoi ? ») et preuve éventuelle */
  why: string; evidence?: string;
  /** difficulté visée (zone proximale) et thème Lichess pour les puzzles */
  d: number; theme?: string;
  /** référence : id SRS (m:… / p:…) ou leçon:étape */
  ref?: string;
}
export const DAILY_CARDS = 12;
export const KIND_LABEL: Record<CardKind, string> = { puzzle: 'Puzzle', mate1: 'Mat en 1', threat: 'Quelle est la menace ?', master: 'Le coup du maître', mistake: 'Rejoue ta gaffe', lesson: 'Mini-leçon' };

export function feedToday(s: State, now = Date.now()): FeedState {
  const d = today(new Date(now)); const f = s.feed;
  if (f && f.date === d) return f;
  return { date: d, served: [], kinds: f?.kinds || {}, lessonStep: f?.lessonStep || {} };
}
const stat = (f: FeedState, k: string): FeedStat => f.kinds[k] || { n: 0, ok: 0, fail: 0, skip: 0, ab: 0, ms: 0 };
/** Pénalité apprise des passes et abandons par type de carte (lissage bayésien : 3 cartes fictives à 15 % de passes). */
export function kindFactor(f: FeedState, k: CardKind) {
  const st = stat(f, k); const rate = (st.skip + 0.7 * st.ab + 0.45) / (st.n + 3);
  const avgMs = st.n ? st.ms / st.n : 25000;
  return Math.max(0.35, 1 - 0.9 * Math.max(0, rate - 0.15)) * (avgMs > 60000 ? 0.85 : 1);
}
const EXERCISE_KINDS = new Set(['quiz', 'any', 'mate', 'check', 'line', 'select', 'stars']);
/** Étapes d'une leçon jouables en 15–60 s dans le fil (exercice court, avec la notion qui précède comme « pourquoi »). */
export function lessonCardSteps(l: Lesson): number[] {
  const out: number[] = [];
  l.steps.forEach((st: Step, i) => {
    if (st.type !== 'exercise' || !EXERCISE_KINDS.has(st.goal.kind)) return;
    if (st.goal.kind === 'line' && st.goal.moves.length > 5) return;
    out.push(i);
  });
  return out;
}
function skillGain(s: State, m: CoachModel, k: SkillId, now: number) {
  const g = globalRating(m); const lv = levelIdx(g); const st = skillOf(m, k, now);
  const gp = 1 / (1 + Math.exp(-(g - st.r) / 200)) + 0.25 * st.rd / 350;
  return { G: Math.sqrt(SKILL[k].importance[lv]) * gp, d: zpdDifficulty(st.r, st.rd) };
}
/** Toutes les cartes candidates, avec leur gain attendu (avant diversité et nouveauté). */
export function feedCandidates(s: State, m: CoachModel, now = Date.now(), pending: FeedCard[] = []): FeedCard[] {
  const out: FeedCard[] = []; const g = globalRating(m); const lv = levelIdx(g);
  const acts = activities(s, m, now);
  // 1. erreurs dues : positions de tes parties, puis puzzles ratés
  const due = Object.values(s.srs).filter((x) => isDue(x, now) && ((x.kind === 'mistake' && m.mistakes[x.id]) || x.kind === 'puzzle')).sort((a, b) => a.due - b.due);
  due.slice(0, 6).forEach((x, i) => {
    const mk = x.kind === 'mistake' ? m.mistakes[x.id] : null;
    out.push({ id: 'mk:' + x.id, kind: 'mistake', skill: mk ? (mk.motif && MOTIF_SKILL[mk.motif]) || 'vigilance' : null, ref: x.id, d: g, gain: (mk ? 1.3 : 1.05) - 0.04 * i,
      why: mk ? 'Cette position vient de ta partie. La revoir au bon moment, c’est ce qui évite de refaire la même faute.' : 'Tu avais raté ce puzzle. Le revoir aujourd’hui le grave en mémoire.', evidence: mk ? `Tu avais joué un coup faible : « ${mk.prompt} »` : undefined });
  });
  // 2. puzzles ciblés : exactement le gain du curriculum par compétence
  for (const a of acts) {
    if (a.kind !== 'puzzles' || !a.skill) continue;
    const th = SKILL[a.skill].theme!;
    out.push({ id: 'pz:' + a.skill, kind: a.skill === 'mate1' ? 'mate1' : 'puzzle', skill: a.skill, theme: th, d: a.difficulty ?? zpdDifficulty(g, 200), gain: a.gain, why: a.why, evidence: a.evidence });
  }
  // 3. « quelle est la menace ? » : vigilance (voir ce que prépare l'adversaire)
  { const { G, d } = skillGain(s, m, 'vigilance', now); out.push({ id: 'th', kind: 'threat', skill: 'vigilance', d, gain: 0.55 * G + 0.2, why: 'Avant chaque coup, demande-toi ce que veut ton adversaire. Le coach t’entraîne à le voir au premier coup d’œil.' }); }
  // 4. « trouve le coup du maître » : calcul et coups forts en partie réelle
  { const k: SkillId = lv === 0 ? 'freePiece' : 'calculation'; const { G } = skillGain(s, m, k, now);
    out.push({ id: 'ms', kind: 'master', skill: 'calculation', d: Math.max(800, Math.min(2300, zpdDifficulty(g, 150) + 100)), gain: 0.4 * G + 0.25, why: 'Un moment clé d’une vraie partie de maître : un seul coup tenait l’avantage. Chercher comme eux, c’est muscler ton calcul.' }); }
  // 5. mini-étape de la leçon en cours
  const nl = nextLesson(s);
  if (nl) {
    const steps = lessonCardSteps(nl); const f = feedToday(s, now);
    const pos = Math.max(f.lessonStep?.[nl.id] ?? -1, ...pending.filter((c) => c.ref?.startsWith(nl.id + ':')).map((c) => +c.ref!.split(':')[1]));
    const next = steps.find((i) => i > pos) ?? steps[0];
    if (next != null) {
      const la = acts.find((a) => a.id === 'lesson:' + nl.id);
      out.push({ id: 'ls:' + nl.id, kind: 'lesson', skill: la?.skill ?? null, ref: `${nl.id}:${next}`, d: g, gain: la ? Math.max(0.5, la.gain) : lv === 0 ? 0.9 : 0.55,
        why: `Un exercice de ta leçon en cours, « ${nl.title} ». Le fil t’en donne un avant-goût ; la leçon complète t’attend dans Apprendre.` });
    }
  }
  return out;
}
/** Prochaines cartes du jour : gain du coach × nouveauté × diversité × préférence apprise (passes). [] = programme du jour terminé. */
export function nextFeedCards(s: State, m: CoachModel, n = 2, now = Date.now(), pending: FeedCard[] = []): FeedCard[] {
  // pending : cartes déjà préparées mais pas encore jouées (préchargement de la carte N+1)
  const f = feedToday(s, now); const left = DAILY_CARDS - f.served.length - pending.length;
  if (left <= 0) return [];
  const cands = feedCandidates(s, m, now, pending); const hist = [...f.served, ...pending].map((x) => ({ id: x.id, kind: x.kind as CardKind, skill: x.skill as SkillId | null }));
  const out: FeedCard[] = [];
  for (let k = 0; k < Math.min(n, left); k++) {
    let best: FeedCard | null = null; let bs = -1;
    const prev = hist[hist.length - 1], prev2 = hist[hist.length - 2];
    for (const c of cands) {
      const times = hist.filter((h) => h.id === c.id).length;
      if (c.kind === 'mistake' && times) continue; // une erreur donnée : une fois par jour
      if (c.kind === 'lesson' && times >= 2) continue;
      let sc = c.gain * Math.pow(c.kind === 'puzzle' || c.kind === 'mate1' ? 0.7 : 0.5, times) * kindFactor(f, c.kind);
      if (prev && prev.kind === c.kind) sc *= c.kind === 'puzzle' ? 0.75 : 0.45;
      if (c.skill && (prev?.skill === c.skill || prev2?.skill === c.skill)) sc *= 0.55;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) break;
    out.push(best); hist.push({ id: best.id, kind: best.kind, skill: best.skill });
  }
  return out;
}
export type FeedOutcome = 'ok' | 'fail' | 'skip' | 'abandon';
/** Enregistre un signal du fil (dans un brouillon setState). `counted` : la réussite/l'échec est déjà passé par recordPuzzle. */
export function recordFeed(s: State, c: FeedCard, out: FeedOutcome, ms: number, counted = false, now = Date.now()) {
  const f = (s.feed = feedToday(s, now));
  if (out !== 'abandon') f.served.push({ id: c.id, kind: c.kind, skill: c.skill, out });
  const st = (f.kinds[c.kind] ||= { n: 0, ok: 0, fail: 0, skip: 0, ab: 0, ms: 0 });
  st.n++; st[out === 'abandon' ? 'ab' : out]++; st.ms += Math.min(ms, 120000);
  if (c.kind === 'lesson' && c.ref && out !== 'abandon') { const [lid, i] = c.ref.split(':'); (f.lessonStep ||= {})[lid] = +i; }
  pushCoach(s, { k: 'feed', t: now, id: c.ref || c.id, card: c.kind, sk: c.skill, d: c.d, out, ms: Math.round(ms), counted });
}
/** Ce que le coach garde pour demain (écran de fin du jour). */
export function tomorrowTeaser(s: State, m: CoachModel, now = Date.now()): string {
  const end = new Date(now); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() + 1);
  const due = Object.values(s.srs).filter((x) => (x.kind === 'mistake' || x.kind === 'puzzle') && x.due <= end.getTime()).length;
  const w = weaknesses(m, 1)[0];
  const parts: string[] = [];
  if (due) parts.push(`${due} de tes erreurs à revoir`);
  if (w) parts.push(`des positions sur « ${w.label.toLowerCase()} »`);
  if (!parts.length) parts.push('un coup de maître et de nouveaux puzzles à ta mesure');
  return `Demain, je te garde ${parts.join(' et ')}.`;
}
export function feedProgress(s: State, now = Date.now()) { const f = feedToday(s, now); return { done: f.served.length, total: DAILY_CARDS, ok: f.served.filter((x) => x.out === 'ok').length }; }
