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
import { skillOf, globalRating, levelIdx, weaknesses, observe, type CoachModel } from './model';
import { ensureModel } from './curriculum';
import { MOTIF_CONCEPT, conceptsForThemes, conceptsOfLesson, CONCEPTS } from '../data/concepts';
import { diagTarget, diagAnswer, diagResult, placementOf, feedDiagCount, feedDiagDone, FEED_DIAG, FEED_DIAG_MAX, type DiagItem } from './diagnostic';

export type CardKind = 'puzzle' | 'mate1' | 'threat' | 'master' | 'mistake' | 'lesson' | 'diag';
export interface FeedCard {
  /** identifiant de la source (une même source peut revenir plusieurs fois par jour, avec un contenu différent) */
  id: string; kind: CardKind; skill: SkillId | null; gain: number;
  /** phrase du coach (« pourquoi ? ») et preuve éventuelle */
  why: string; evidence?: string;
  /** difficulté visée (zone proximale) et thème Lichess pour les puzzles */
  d: number; theme?: string;
  /** référence : id SRS (m:… / p:…) ou leçon:étape */
  ref?: string;
  /** notion travaillée (pilier 2) : entrelacement, jamais annoncée avant la réponse */
  concept?: string;
  /** P0 (journal) : score glouton de la carte retenue et nombre de candidates éligibles (évaluation hors ligne future) */
  score?: number; nCands?: number;
}
/** Au plus MAX_SAME_CONCEPT cartes de la même notion à la suite (CA2.3). */
export const MAX_SAME_CONCEPT = 2;
const conceptOfSkill = (k: SkillId | null) => (k ? CONCEPTS.find((c) => c.skill === k)?.id : undefined);
export const DAILY_CARDS = 12;
export const KIND_LABEL: Record<CardKind, string> = { puzzle: 'Puzzle', mate1: 'Mat en 1', threat: 'Quelle est la menace ?', master: 'Le coup du maître', mistake: 'Rejoue ta gaffe', lesson: 'Mini-leçon', diag: 'Découverte' };

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
    const fromLesson = mk?.src === 'lesson' || mk?.src === 'course';
    out.push({ id: 'mk:' + x.id, kind: 'mistake', skill: mk ? (mk.motif && MOTIF_SKILL[mk.motif]) || 'vigilance' : null, ref: x.id, d: g, gain: (mk ? 1.3 : 1.05) - 0.04 * i,
      concept: x.concept || mk?.concept || (mk?.motif ? MOTIF_CONCEPT[mk.motif] : undefined),
      why: mk ? (fromLesson ? 'Tu t’étais trompé ici pendant une leçon. La mémoire la ramène au moment où tu allais l’oublier (répétition espacée FSRS).' : 'Cette position vient de ta partie. La revoir au bon moment, c’est ce qui évite de refaire la même faute.') : 'Tu avais raté ce puzzle. Le revoir aujourd’hui le grave en mémoire.', evidence: mk ? (fromLesson ? `L’exercice : « ${mk.prompt} »` : `Tu avais joué un coup faible : « ${mk.prompt} »`) : undefined });
  });
  // 2. puzzles ciblés : exactement le gain du curriculum par compétence
  for (const a of acts) {
    if (a.kind !== 'puzzles' || !a.skill) continue;
    const th = SKILL[a.skill].theme!;
    out.push({ id: 'pz:' + a.skill, kind: a.skill === 'mate1' ? 'mate1' : 'puzzle', skill: a.skill, theme: th, concept: conceptsForThemes([th])[0] || conceptOfSkill(a.skill), d: a.difficulty ?? zpdDifficulty(g, 200), gain: a.gain, why: a.why, evidence: a.evidence });
  }
  // 3. « quelle est la menace ? » : vigilance (voir ce que prépare l'adversaire)
  { const { G, d } = skillGain(s, m, 'vigilance', now); out.push({ id: 'th', kind: 'threat', skill: 'vigilance', concept: 'threat', d, gain: 0.55 * G + 0.2, why: 'Avant chaque coup, demande-toi ce que veut ton adversaire. Le coach t’entraîne à le voir au premier coup d’œil.' }); }
  // 4. « trouve le coup du maître » : calcul et coups forts en partie réelle
  { const k: SkillId = lv === 0 ? 'freePiece' : 'calculation'; const { G } = skillGain(s, m, k, now);
    out.push({ id: 'ms', kind: 'master', skill: 'calculation', concept: 'calculation', d: Math.max(800, Math.min(2300, zpdDifficulty(g, 150) + 100)), gain: 0.4 * G + 0.25, why: 'Un moment clé d’une vraie partie de maître : un seul coup tenait l’avantage. Chercher comme eux, c’est muscler ton calcul.' }); }
  // 5. mini-étape de la leçon en cours
  const nl = nextLesson(s);
  if (nl) {
    const steps = lessonCardSteps(nl); const f = feedToday(s, now);
    const pos = Math.max(f.lessonStep?.[nl.id] ?? -1, ...pending.filter((c) => c.ref?.startsWith(nl.id + ':')).map((c) => +c.ref!.split(':')[1]));
    const next = steps.find((i) => i > pos) ?? steps[0];
    if (next != null) {
      const la = acts.find((a) => a.id === 'lesson:' + nl.id);
      const stp = nl.steps[next] as { concepts?: string[] };
      out.push({ id: 'ls:' + nl.id, kind: 'lesson', skill: la?.skill ?? null, ref: `${nl.id}:${next}`, concept: stp?.concepts?.[0] || conceptsOfLesson(nl.id)[0], d: g, gain: la ? Math.max(0.5, la.gain) : lv === 0 ? 0.9 : 0.55,
        why: `Un exercice de ta leçon en cours, « ${nl.title} ». Le fil t’en donne un avant-goût ; la leçon complète t’attend dans Apprendre.` });
    }
  }
  return out;
}
/** Prochaines cartes du jour : gain du coach × nouveauté × diversité × préférence apprise (passes). [] = programme du jour terminé. */
export function nextFeedCards(s: State, m: CoachModel, n = 2, now = Date.now(), pending: FeedCard[] = []): FeedCard[] {
  // pending : cartes déjà préparées mais pas encore jouées (préchargement de la carte N+1)
  // séance en cours : budget en temps (sessionOver) au lieu du plafond quotidien
  const f = feedToday(s, now); const left = (sessionActive(s, now) ? SESSION_MAX_CARDS : DAILY_CARDS) - (sessionActive(s, now) ? s.session!.n : f.served.length) - pending.length;
  if (left <= 0) return [];
  // diagnostic : les premières cartes du fil, adaptatives (la suivante dépend de la réponse : pas de préchargement)
  if (diagPending(s, m)) {
    if (pending.some((c) => c.kind === 'diag')) return [];
    const st = placementOf(s.placement, s.obMate); const tg = diagTarget(st); const i = feedDiagCount(st);
    return [{ id: 'dg:' + i, kind: 'diag', skill: null, d: tg.rating, theme: tg.theme, gain: 9,
      why: `Je découvre ton niveau : ${FEED_DIAG} à ${FEED_DIAG_MAX} positions qui s’adaptent à tes réponses. Pas de niveau à déclarer, tu joues et je mesure. Une seule tentative ; « Je ne sais pas » est une vraie réponse.` }];
  }
  const cands = feedCandidates(s, m, now, pending); const hist = [...f.served, ...pending].map((x) => ({ id: x.id, kind: x.kind as CardKind, skill: x.skill as SkillId | null, concept: x.concept }));
  const out: FeedCard[] = [];
  for (let k = 0; k < Math.min(n, left); k++) {
    let best: FeedCard | null = null; let bs = -1; let nc = 0;
    const prev = hist[hist.length - 1], prev2 = hist[hist.length - 2];
    // entrelacement (CA2.3) : jamais plus de MAX_SAME_CONCEPT cartes de la même notion à la suite
    const run = hist.slice(-MAX_SAME_CONCEPT); const blocked = run.length === MAX_SAME_CONCEPT && run.every((h) => h.concept && h.concept === run[0].concept) ? run[0].concept : null;
    for (const c of cands) {
      if (blocked && c.concept === blocked) continue;
      const times = hist.filter((h) => h.id === c.id).length;
      if (c.kind === 'mistake' && times) continue; // une erreur donnée : une fois par jour
      if (c.kind === 'lesson' && times >= 2) continue;
      nc++;
      let sc = c.gain * Math.pow(c.kind === 'puzzle' || c.kind === 'mate1' ? 0.7 : 0.5, times) * kindFactor(f, c.kind);
      if (prev && prev.kind === c.kind) sc *= c.kind === 'puzzle' ? 0.75 : 0.45;
      if (c.skill && (prev?.skill === c.skill || prev2?.skill === c.skill)) sc *= 0.55;
      if (c.concept && prev?.concept === c.concept) sc *= 0.6;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) break;
    best = { ...best, score: +bs.toFixed(4), nCands: nc };
    out.push(best); hist.push({ id: best.id, kind: best.kind, skill: best.skill, concept: best.concept });
  }
  return out;
}
/** Le diagnostic est-il encore à faire ? (pas si le coach a déjà un diagnostic ou une note puzzle établie) */
export function diagPending(s: State, m: CoachModel) { return !m.diag && s.puzzle.games < 10 && !feedDiagDone(placementOf(s.placement, s.obMate)) && !s.lessons['diag-beginner']; }
/** Réponse à une carte du diagnostic (brouillon setState). Renvoie le résultat quand le test est terminé. */
export function recordDiag(s: State, it: DiagItem, now = Date.now()): { rating: number; rd: number } | null {
  const st = (s.placement = diagAnswer(placementOf(s.placement, s.obMate), it));
  if (!feedDiagDone(st)) return null;
  const r = diagResult(st); const m = ensureModel(s);
  m.diag = { at: now, r: r.rating }; m.base = r.rating; for (const e of r.events) observe(m, e);
  if (s.puzzle.games < 10) s.puzzle.rating = r.rating;
  // le parcours s'ouvre au niveau mesuré (remplace l'ancien niveau déclaré)
  for (const [k, min] of [['intermediaire', 1150], ['avance', 1550]] as const) if (r.rating >= min) s.lessons['unlock-' + k] ||= { done: false, stars: 0, step: 0 };
  return { rating: r.rating, rd: r.rd };
}
/** « Je débute » : on arrête le test, niveau de départ 600, et l'élève commence par la leçon 1 (brouillon setState). */
export function diagBeginner(s: State, now = Date.now()) {
  const m = ensureModel(s); m.diag = { at: now, r: 600 }; m.base = 600; if (s.puzzle.games < 10) s.puzzle.rating = 600;
  s.lessons['diag-beginner'] = { done: true, stars: 0, step: 0 };
}
export type FeedOutcome = 'ok' | 'fail' | 'skip' | 'abandon';
/** Enregistre un signal du fil (dans un brouillon setState). `counted` : la réussite/l'échec est déjà passé par recordPuzzle. */
export function recordFeed(s: State, c: FeedCard, out: FeedOutcome, ms: number, counted = false, now = Date.now(), fen?: string) {
  const f = (s.feed = feedToday(s, now));
  if (out !== 'abandon') f.served.push({ id: c.id, kind: c.kind, skill: c.skill, out, ...(c.concept ? { concept: c.concept } : {}) });
  // notion (pilier 2) : réussite entrelacée (thème non annoncé) ; les puzzles passent par recordPuzzle (counted)
  if (c.concept && !counted && c.kind !== 'diag' && (out === 'ok' || out === 'fail')) pushCoach(s, { k: 'concept', t: now, ids: [c.concept], ok: out === 'ok', f: out === 'ok', fen, il: true, src: 'feed' });
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

// ——— Pilier 7 : séance de 5 minutes (budget en temps, composée par le fil) ———
export const SESSION_MS = 5 * 60000;
export const SESSION_MAX_CARDS = 30;
/** temps par défaut d'une carte (avant toute mesure), en ms */
export const CARD_MS: Record<CardKind, number> = { puzzle: 35000, mate1: 18000, threat: 22000, master: 45000, mistake: 30000, lesson: 40000, diag: 30000 };
export interface SessionState { date: string; start: number; budget: number; spent: number; n: number; ok: number; est: number; before: { rating: number; p: Record<string, number>; mastered: string[] }; over?: boolean }
/** Temps moyen mesuré d'une carte de ce type (FeedStat.ms), lissé vers la valeur par défaut (2 cartes fictives). */
export function estCardMs(f: FeedState, k: CardKind): number { const st = stat(f, k); return Math.round((st.ms + 2 * CARD_MS[k]) / (st.n + 2)); }
/** Plan de séance : cartes prévues (même choix que le fil) jusqu'à remplir le budget ; durée estimée affichée. */
export function sessionPlan(s: State, m: CoachModel, now = Date.now()): { cards: number; ms: number; due: number } {
  const f = feedToday(s, now); const tmp = { ...s, session: { date: today(new Date(now)), start: now, budget: SESSION_MS, spent: 0, n: 0, ok: 0, est: 0, before: { rating: 0, p: {}, mastered: [] } } } as State;
  const cards = nextFeedCards(tmp, m, SESSION_MAX_CARDS, now); let ms = 0, n = 0;
  for (const c of cards) { const e = estCardMs(f, c.kind); if (n > 0 && ms + e > SESSION_MS * 1.08) break; ms += e; n++; }
  const due = Object.values(s.srs).filter((x) => isDue(x, now) && (x.kind === 'mistake' || x.kind === 'puzzle')).length;
  return { cards: n, ms, due };
}
export function sessionActive(s: State, now = Date.now()) { const x = s.session; return !!x && !x.over && x.date === today(new Date(now)); }
/** Démarre la séance (brouillon setState) : photo des notions et de la note pour l'écran de fin. */
export function startSession(s: State, m: CoachModel, now = Date.now()) {
  const plan = sessionPlan(s, m, now); const p: Record<string, number> = {}; const mastered: string[] = [];
  for (const [id, c] of Object.entries(m.concepts || {})) { p[id] = c.p; if (c.at) mastered.push(id); }
  s.session = { date: today(new Date(now)), start: now, budget: SESSION_MS, spent: 0, n: 0, ok: 0, est: plan.ms, before: { rating: globalRating(m), p, mastered } };
}
/** Une carte jouée pendant la séance (temps réel, plafonné à 2 min). */
export function sessionCard(s: State, ms: number, ok: boolean) { const x = s.session; if (!x || x.over) return; x.n++; x.spent += Math.min(ms, 120000); if (ok) x.ok++; }
/** Fin de séance : le budget est consommé (une carte de plus dépasserait de plus d'un quart de carte moyenne). */
export function sessionOver(s: State, now = Date.now()): boolean { const x = s.session; if (!x || x.over) return false; const f = feedToday(s, now); return x.spent + 0.25 * estCardMs(f, 'puzzle') >= x.budget || x.n >= SESSION_MAX_CARDS; }
export interface SessionSummary { n: number; ok: number; ms: number; rating: number; dRating: number; progressed: { id: string; dp: number }[]; mastered: string[]; tomorrow: string }
export function sessionSummary(s: State, m: CoachModel, now = Date.now()): SessionSummary | null {
  const x = s.session; if (!x) return null; const r = globalRating(m);
  const progressed = Object.entries(m.concepts || {}).map(([id, c]) => ({ id, dp: c.p - (x.before.p[id] ?? 0) })).filter((y) => y.dp > 0.02).sort((a, b) => b.dp - a.dp).slice(0, 4);
  const mastered = Object.entries(m.concepts || {}).filter(([id, c]) => c.at && !x.before.mastered.includes(id)).map(([id]) => id);
  return { n: x.n, ok: x.ok, ms: x.spent, rating: r, dRating: r - x.before.rating, progressed, mastered, tomorrow: tomorrowTeaser(s, m, now) };
}
