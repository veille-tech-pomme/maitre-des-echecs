// Modèle du joueur : une note Glicko-2 par compétence (r, RD, σ), un journal de preuves et la détection des
// faiblesses récurrentes. Pur et sérialisable (stocké dans State.coach).
import { SKILLS, SKILL, FAMILIES, skillsForPuzzle, skillsForLesson, type SkillId, type Family } from './skills';
import type { SkillEvent } from './pipeline';
import { observeConcept, newConceptState, ctxKey, type ConceptState } from './mastery';
import { CONCEPT, conceptsForThemes, conceptsOfLesson } from '../data/concepts';

export interface SkillState { r: number; rd: number; vol: number; n: number; last: number }
export interface Evidence { t: number; k: SkillId; s: number; src: SkillEvent['src']; ref?: string; m?: string; p?: string; l?: number }
/** v2 (pilier 2) : + concepts (maîtrise par notion) et journal des notions maîtrisées. v1 est migré sans perte (migrateModel). */
export interface CoachModel { v: 1 | 2; concepts?: Record<string, ConceptState>; masteredLog?: { id: string; t: number; seen?: boolean }[]; base: number; skills: Partial<Record<SkillId, SkillState>>; ev: Evidence[]; seenQ: number; games: number; diag?: { at: number; r: number }; mistakes: Record<string, Mistake>; week?: WeekGoals }
export interface Mistake { fen: string; sol: string[]; motif: string | null; game?: string; ply?: number; prompt: string; at: number; /** notion en cause (pilier 2) */ concept?: string; /** origine : partie, leçon, exercice, fil */ src?: 'game' | 'lesson' | 'course' | 'feed'; /** coup joué (erreur) */ played?: string }
export interface WeekGoals { start: string; focus: SkillId | null; goals: { id: string; label: string; target: number; done: number; route: string }[] }
/** Évènement brut enregistré par le noyau de l'appli (sans charger le coach) puis consommé par `sync`. */
export type RawEvent =
  | { k: 'puzzle'; t: number; id: string; r: number; th: string[]; ok: boolean; plies: number; /** thème non annoncé (classé, fil, révision) */ il?: boolean; fen?: string }
  | { k: 'lesson'; t: number; id: string; level: string; stars: number }
  | { k: 'endgame'; t: number; id: string; ok: boolean }
  /** pilier 2 : observation d'une ou plusieurs notions (ok, niveau d'indice, du premier coup, position, contexte entrelacé) */
  /** pilier 2 : erreur d'exercice ou de leçon à revoir (carte du fil quand FSRS la dit due) */
  | { k: 'mistake'; t: number; id: string; fen: string; sol: string[]; played: string; concept?: string; prompt: string; src: 'lesson' | 'course' | 'feed' }
  | { k: 'concept'; t: number; ids: string[]; ok: boolean; h?: number; f?: boolean; fen?: string; il?: boolean; src: string }
  /** signal du fil « Pour toi » : réussite/échec des cartes non-puzzle, passe (= négatif faible), abandon, temps passé */
  | { k: 'feed'; t: number; id: string; card: string; sk: SkillId | null; d: number; out: 'ok' | 'fail' | 'skip' | 'abandon'; ms: number; counted?: boolean };

const Q = 173.7178, TAU = 0.5, EPS = 1e-6, DAY = 86400000;
const RD_ITEM: Record<SkillEvent['src'], number> = { puzzle: 60, game: 150, lesson: 200, diag: 80 };
export const MAX_EV = 400;

export function newModel(base = 800): CoachModel { return { v: 2, base, skills: {}, ev: [], seenQ: 0, games: 0, mistakes: {}, concepts: {}, masteredLog: [] }; }
/** Migration v1 → v2 : on ajoute les notions sans rien retirer (compétences, preuves, erreurs, file inchangées). Les
 *  leçons déjà réussies (preuves « l: ») amorcent les notions correspondantes (une observation réussie, sans contexte). */
export function migrateModel(m: CoachModel): boolean {
  if (m.v === 2 && m.concepts) return false;
  m.concepts ||= {}; m.masteredLog ||= [];
  const seeded = new Set<string>();
  for (const e of m.ev) if (e.src === 'lesson' && e.ref?.startsWith('l:') && e.s >= 0.5) { const id = e.ref.slice(2); if (seeded.has(id)) continue; seeded.add(id); for (const c of conceptsOfLesson(id)) applyConceptObs(m, c, { ok: true, t: e.t, firstTry: false }); }
  m.v = 2; return true;
}
/** Observation d'une notion ; enregistre la transition « Maîtrisée » (célébration, CA7.2). */
export function applyConceptObs(m: CoachModel, id: string, o: import('./mastery').Observation): 'mastered' | 'fragile' | undefined {
  if (!CONCEPT[id]) return undefined;
  m.concepts ||= {}; const prev = m.concepts[id]; const r = observeConcept(prev || newConceptState(id), id, o); m.concepts[id] = r.c;
  // célébration : la première maîtrise seulement (une erreur repasse en « Fragile », la reconquête n'est pas re-fêtée)
  if (r.became === 'mastered' && !prev?.ever) { (m.masteredLog ||= []).push({ id, t: o.t ?? Date.now() }); if (m.masteredLog.length > 50) m.masteredLog.shift(); }
  return r.became;
}
function rawToConcepts(m: CoachModel, e: RawEvent) {
  if (e.k === 'mistake') { m.mistakes[e.id] = { fen: e.fen, sol: e.sol, motif: null, prompt: e.prompt, at: e.t, concept: e.concept, src: e.src, played: e.played }; return; }
  if (e.k === 'concept') { for (const id of e.ids) applyConceptObs(m, id, { ok: e.ok, hint: e.h, firstTry: e.f, ctx: e.fen ? ctxKey(e.fen) : undefined, interleaved: e.il, t: e.t }); }
  else if (e.k === 'puzzle') { for (const id of conceptsForThemes(e.th)) applyConceptObs(m, id, { ok: e.ok, firstTry: true, ctx: e.fen ? ctxKey(e.fen) : 'p:' + e.id, interleaved: e.il, t: e.t }); }
}
export function skillOf(m: CoachModel, k: SkillId, now = Date.now()): SkillState {
  const s = m.skills[k] || { r: m.base, rd: 300, vol: 0.06, n: 0, last: now };
  // inactivité : le RD remonte (c = 35 / jour, plafond 350)
  const days = Math.max(0, (now - s.last) / DAY);
  return { ...s, rd: Math.min(350, Math.sqrt(s.rd * s.rd + 35 * 35 * Math.min(days, 100) / 30)) };
}
/** Une observation Glicko-2 (score fractionnaire s ∈ [0,1], poids w ≤ 1) contre un item de difficulté d. */
export function glicko2(st: SkillState, d: number, rdItem: number, s: number, w = 1): SkillState {
  const mu = (st.r - 1500) / Q, phi = st.rd / Q, muj = (d - 1500) / Q, phij = rdItem / Q;
  const g = 1 / Math.sqrt(1 + (3 * phij * phij) / (Math.PI * Math.PI));
  const E = 1 / (1 + Math.exp(-g * (mu - muj)));
  const v = 1 / (w * g * g * E * (1 - E));
  const delta = v * w * g * (s - E);
  // volatilité (algorithme d'Illinois)
  const a = Math.log(st.vol * st.vol);
  const f = (x: number) => { const ex = Math.exp(x); return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU); };
  let A = a, B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v); else { let k = 1; while (f(a - k * TAU) < 0 && k < 50) k++; B = a - k * TAU; }
  let fA = f(A), fB = f(B), it = 0;
  while (Math.abs(B - A) > EPS && it++ < 60) { const C = A + ((A - B) * fA) / (fB - fA); const fC = f(C); if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2; B = C; fB = fC; }
  const vol = Math.min(0.2, Math.exp(A / 2));
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiN = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muN = mu + phiN * phiN * w * g * (s - E);
  return { r: Math.max(100, Math.min(3200, muN * Q + 1500)), rd: Math.max(30, Math.min(350, phiN * Q)), vol, n: st.n + 1, last: st.last };
}
/** Probabilité de réussir un item de difficulté d. */
export const pSuccess = (r: number, d: number) => 1 / (1 + Math.pow(10, (d - r) / 400));

export function observe(m: CoachModel, e: SkillEvent, now = Date.now()): void {
  const st = skillOf(m, e.skill, now);
  const n = glicko2(st, e.d, RD_ITEM[e.src], Math.max(0, Math.min(1, e.s)), e.w ?? 1);
  n.last = now; m.skills[e.skill] = n;
  m.ev.push({ t: e.t ?? now, k: e.skill, s: Math.round(e.s * 100) / 100, src: e.src, ref: e.ref, m: e.motif, p: e.piece, l: e.lost });
  if (m.ev.length > MAX_EV) m.ev.splice(0, m.ev.length - MAX_EV);
}
const LESSON_D: Record<string, number> = { debutant: 600, intermediaire: 1100, avance: 1500, expert: 1900 };
/** Convertit un évènement brut en observations (puzzle → toutes ses compétences, poids partagé). */
export function rawToEvents(e: RawEvent): SkillEvent[] {
  if (e.k === 'puzzle') {
    const ks = skillsForPuzzle(e.th, e.plies); const w = ks.length ? Math.max(0.35, 1 / Math.sqrt(ks.length)) : 1;
    return (ks.length ? ks : ['vigilance' as SkillId]).map((k) => ({ skill: k, s: e.ok ? 1 : 0, d: e.r, w, src: 'puzzle', ref: 'p:' + e.id, t: e.t }));
  }
  if (e.k === 'feed') {
    if (!e.sk) return [];
    // les puzzles du fil passent déjà par recordPuzzle (counted) : seules les passes et abandons s'ajoutent
    if (e.out === 'ok' || e.out === 'fail') {
      if (e.counted) return [];
      const slow = e.out === 'ok' && e.ms > 45000; // réussite lente : score partiel
      return [{ skill: e.sk, s: e.out === 'ok' ? (slow ? 0.8 : 1) : 0, d: e.d, w: 0.6, src: 'puzzle', ref: 'f:' + e.id, t: e.t }];
    }
    // passer = signal négatif faible (trop dur ou pas d'envie), abandon un peu plus fort ; jamais si la carte a duré < 2 s (geste réflexe)
    if (e.ms < 2000) return [];
    return [{ skill: e.sk, s: 0, d: e.d, w: e.out === 'skip' ? 0.2 : 0.3, src: 'puzzle', ref: 'fs:' + e.id, t: e.t }];
  }
  if (e.k === 'lesson') { const d = LESSON_D[e.level] ?? 1000; return skillsForLesson(e.id).map((k) => ({ skill: k, s: e.stars >= 3 ? 1 : e.stars === 2 ? 0.8 : 0.6, d, w: 0.5, src: 'lesson', ref: 'l:' + e.id, t: e.t })); }
  if (e.k === 'mistake') return [];
  if (e.k === 'concept') return []; // notions : voir rawToConcepts (la note par compétence vient des leçons, puzzles, parties)
  return [{ skill: e.id.includes('tour') || e.id.includes('rook') ? 'rookEnd' : 'pawnEnd', s: e.ok ? 1 : 0, d: 1200, w: 0.6, src: 'lesson', ref: 'e:' + e.id, t: e.t }];
}
/** Consomme la file d'évènements bruts (indice seenQ) et met à jour le modèle. */
export interface RawQueue { n: number; items: RawEvent[] }
export function sync(m: CoachModel, q: RawQueue | undefined, base?: number): boolean {
  let changed = false;
  if (base && Math.abs(m.base - base) > 1 && !m.diag) { m.base = base; changed = true; }
  if (!q) return changed;
  const first = q.n - q.items.length;
  if (migrateModel(m)) changed = true;
  for (let i = Math.max(m.seenQ, first); i < q.n; i++) { const e = q.items[i - first]; for (const ev of rawToEvents(e)) observe(m, ev, e.t); rawToConcepts(m, e); changed = true; }
  m.seenQ = q.n; return changed;
}
/** Applique les observations d'une partie analysée (une seule fois par partie). */
export function applyGame(m: CoachModel, gameId: string, events: SkillEvent[], now = Date.now()) {
  if (m.ev.some((e) => e.src === 'game' && e.ref?.split('#')[0] === gameId)) return false;
  for (const e of events) observe(m, { ...e, ref: e.ref?.startsWith('#') ? gameId + e.ref : e.ref || gameId }, now);
  m.games++; return true;
}
export const confidence = (rd: number) => Math.max(0, Math.min(1, 1 - rd / 350));
/** Note globale : moyenne des compétences connues pondérée par la précision (1/RD²), sinon base. */
export function globalRating(m: CoachModel): number {
  let sw = 0, sr = 0;
  for (const s of SKILLS) { const st = m.skills[s.id]; if (!st || st.n < 2) continue; const w = 1 / (st.rd * st.rd); sw += w; sr += w * st.r; }
  return sw ? Math.round((sr + m.base / (200 * 200)) / (sw + 1 / (200 * 200))) : m.base;
}
export const levelIdx = (r: number) => (r < 1000 ? 0 : r < 1800 ? 1 : 2);
export interface SkillView { id: SkillId; label: string; family: Family; r: number; rd: number; conf: number; n: number; delta: number }
export function skillViews(m: CoachModel, now = Date.now()): SkillView[] {
  const g = globalRating(m); const post = posteriors(m, now);
  return SKILLS.map((s) => { const st = skillOf(m, s.id, now); const P = st.n ? post[s.id] : undefined; const r = P ? P.mean : st.r, rd = P ? Math.min(st.rd, P.sd) : st.rd;
    return { id: s.id, label: s.label, family: s.family, r: Math.round(r), rd: Math.round(rd), conf: confidence(rd), n: st.n, delta: Math.round(r - g) }; });
}
/** Radar : une valeur 0–100 par famille, relative à la note globale (50 = ton niveau moyen). */
export function radar(m: CoachModel): { family: Family; value: number; conf: number }[] {
  const v = skillViews(m); const g = globalRating(m);
  return FAMILIES.map((f) => {
    const xs = v.filter((x) => x.family === f && x.n > 0); if (!xs.length) return { family: f, value: 50, conf: 0 };
    let sw = 0, sr = 0, sc = 0; for (const x of xs) { const w = 1 / (x.rd * x.rd); sw += w; sr += w * x.r; sc += x.conf; }
    const r = sr / sw; return { family: f, value: Math.round(Math.max(5, Math.min(95, 50 + (r - g) / 8))), conf: sc / xs.length };
  });
}
// ——— preuves et faiblesses ———
const PIECE_DE: Record<string, string> = { p: 'de pion', n: 'de cavalier', b: 'de fou', r: 'de tour', q: 'de dame', k: 'de roi' };
const MOTIF_FR: Record<string, [string, string]> = {
  fork: ['fourchette', 'fourchettes'], pin: ['clouage', 'clouages'], skewer: ['enfilade', 'enfilades'], discoveredAttack: ['attaque à la découverte', 'attaques à la découverte'],
  discoveredCheck: ['échec à la découverte', 'échecs à la découverte'], hanging: ['pièce en prise', 'pièces en prise'], threat: ['menace', 'menaces'], trappedPiece: ['pièce piégée', 'pièces piégées'],
  capturingDefender: ['élimination du défenseur', 'éliminations du défenseur'], material: ['perte de matériel', 'pertes de matériel'], mate: ['mat', 'mats'], hangingCapture: ['pièce gratuite', 'pièces gratuites'],
};
export interface WeaknessInfo { skill: SkillId; label: string; score: number; gap: number; conf: number; evidence: string[]; refs: string[] }
const gameOf = (ref?: string) => ref?.split('#')[0] || '';
export function evidenceFor(m: CoachModel, k: SkillId): { lines: string[]; refs: string[]; pattern: number } {
  const ev = m.ev.filter((e) => e.k === k); const lines: string[] = []; const refs: string[] = [];
  const games = [...new Set(m.ev.filter((e) => e.src === 'game').map((e) => gameOf(e.ref)))].slice(-10);
  const inG = ev.filter((e) => e.src === 'game' && games.includes(gameOf(e.ref)) && e.s < 0.5 && e.ref?.includes('#'));
  let pattern = 0;
  if (inG.length) {
    const byM: Record<string, Evidence[]> = {}; for (const e of inG) (byM[(e.m || 'x').replace(/^opening:/, '')] ||= []).push(e);
    for (const [mo, es] of Object.entries(byM).sort((a, b) => b[1].length - a[1].length).slice(0, 2)) {
      const n = es.length; const ng = new Set(es.map((e) => gameOf(e.ref))).size; pattern = Math.max(pattern, n);
      const fr = MOTIF_FR[mo]; const pc = es.map((e) => e.p).filter(Boolean); const mainP = pc.length >= 2 && pc.every((x) => x === pc[0]) ? ' ' + PIECE_DE[pc[0]!] : '';
      const where = `dans ${ng > 1 ? `${ng} de tes ${games.length} dernières parties` : 'une de tes dernières parties'}`;
      if (k === 'vigilance' && fr) lines.push(`${n} ${n > 1 ? fr[1] : fr[0]}${mainP} subie${n > 1 ? 's' : ''} ${where}.`);
      else if (k === 'kingSafety') lines.push(`${n} fois, tu as permis un mat ou une attaque décisive ${where}.`);
      else if (k === 'principles') lines.push(`${n} entorse${n > 1 ? 's' : ''} aux principes d’ouverture ${where}.`);
      else if (fr) lines.push(`${n} ${n > 1 ? fr[1] : fr[0]} manquée${n > 1 ? 's' : ''} ${where}.`);
      else lines.push(`${n} erreur${n > 1 ? 's' : ''} de ce type ${where}.`);
      refs.push(...es.map((e) => e.ref!).slice(-3));
    }
  }
  const pz = ev.filter((e) => e.src === 'puzzle' && !e.ref?.startsWith('fs:')).slice(-30); // passes du fil exclues des preuves
  if (pz.length >= 3) { const ok = pz.filter((e) => e.s >= 0.5).length; lines.push(`${ok} réussite${ok > 1 ? 's' : ''} sur tes ${pz.length} derniers puzzles de ce thème.`); }
  const found = ev.filter((e) => e.src === 'game' && e.s >= 0.99 && e.m).length;
  if (found) lines.push(`${found} fois trouvé${found > 1 ? 'es' : 'e'} en partie : c’est en progrès.`);
  return { lines, refs, pattern };
}
// ——— a posteriori hiérarchique (Bayes empirique) ———
// Chaque note Glicko part d'un a priori N(base, 300²) ; on en extrait la vraisemblance (moyenne, précision), puis on la
// recombine avec un a priori hiérarchique : compétence ~ N(μ_famille, τ²), μ_famille ~ N(note globale, τf²). Avec peu
// d'observations, une compétence emprunte l'information de sa famille au lieu de sauter aux extrêmes.
const PRIOR_RD = 300, TAU_S = 150, TAU_F = 90;
const Phi = (z: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
export interface SkillPost { mean: number; sd: number; nObs: number }
export function posteriors(m: CoachModel, now = Date.now()): Partial<Record<SkillId, SkillPost>> {
  const g = globalRating(m); const lik: Partial<Record<SkillId, { mu: number; prec: number }>> = {};
  for (const s of SKILLS) { const st = m.skills[s.id]; if (!st || !st.n) continue; const rd = skillOf(m, s.id, now).rd; const prec = Math.max(0, 1 / (rd * rd) - 1 / (PRIOR_RD * PRIOR_RD)); if (prec < 1e-7) continue; lik[s.id] = { mu: (st.r / (rd * rd) - m.base / (PRIOR_RD * PRIOR_RD)) / prec, prec }; }
  const out: Partial<Record<SkillId, SkillPost>> = {};
  for (const f of FAMILIES) {
    const ks = SKILLS.filter((s) => s.family === f);
    // μ_famille : moyenne des vraisemblances marginalisées (variance 1/prec + τ²), a priori centré sur g
    let sw = 1 / (TAU_F * TAU_F), sm = g / (TAU_F * TAU_F);
    for (const s of ks) { const L = lik[s.id]; if (!L) continue; const w = 1 / (1 / L.prec + TAU_S * TAU_S); sw += w; sm += w * L.mu; }
    const muF = sm / sw, varF = 1 / sw;
    for (const s of ks) {
      const L = lik[s.id]; const pp = 1 / (TAU_S * TAU_S + varF);
      const prec = (L?.prec || 0) + pp; const mean = ((L ? L.prec * L.mu : 0) + pp * muF) / prec;
      out[s.id] = { mean, sd: Math.sqrt(1 / prec), nObs: m.skills[s.id]?.n || 0 };
    }
  }
  return out;
}
export function weaknesses(m: CoachModel, max = 4): WeaknessInfo[] {
  const g = globalRating(m); const lv = levelIdx(g); const out: WeaknessInfo[] = []; const post = posteriors(m);
  for (const s of SKILLS) {
    const st = m.skills[s.id]; const evd = evidenceFor(m, s.id); const P = post[s.id];
    const gap = P && st ? g - P.mean : 0;
    // probabilité a posteriori que l'écart dépasse 100 points
    const pWeak = P && st && st.n >= 2 ? Phi((gap - 100) / P.sd) : 0;
    const byRating = pWeak >= 0.25;
    const byPattern = evd.pattern >= 3;
    if (!byRating && !byPattern) continue;
    const score = (0.75 + 0.25 * Math.sqrt(s.importance[lv])) * (pWeak + Math.max(0, gap) / 1000 + (byPattern ? 0.3 + 0.05 * evd.pattern : 0));
    out.push({ skill: s.id, label: s.label, score, gap: Math.round(gap), conf: P ? Math.max(0, Math.min(1, 1 - P.sd / 350)) : 0.3, evidence: evd.lines, refs: evd.refs });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}
export function strengths(m: CoachModel, max = 3): { skill: SkillId; label: string; gap: number }[] {
  const g = globalRating(m);
  return SKILLS.map((s) => ({ s, st: m.skills[s.id] })).filter((x) => x.st && x.st.n >= 4 && x.st.r - g > 80 && x.st.rd < 170)
    .sort((a, b) => b.st!.r - a.st!.r).slice(0, max).map((x) => ({ skill: x.s.id, label: x.s.label, gap: Math.round(x.st!.r - g) }));
}
export { SKILL };
