// GOAT phase 1, piliers 2 et 7 : notions (CA2.1), erreurs de leçon révisées par FSRS (CA2.2), fil entrelacé (CA2.3),
// migration v1→v2 sans perte (CA2.4), maîtrise exacte (CA7.2), séance de 5 minutes (CA7.1), export.
import { describe, it, expect, beforeAll } from 'vitest';
import { defaultState, pushCoach, type State } from '../src/lib/store';
import { ensureModel } from '../src/coach/curriculum';
import { newItem, review, loadFsrs, fsrsReady, isMastered, type SrsItem } from '../src/lib/srs';
import { fsrsReview, fromSm2 } from '../src/lib/fsrs';
import { nextFeedCards, feedCandidates, recordFeed, sessionPlan, startSession, sessionCard, sessionOver, sessionSummary, estCardMs, feedToday, SESSION_MS, MAX_SAME_CONCEPT, type FeedCard } from '../src/coach/feed';
import { migrateModel, applyConceptObs, newModel, type CoachModel } from '../src/coach/model';
import { observeConcept, newConceptState, meetsMastery, masteryOf, ctxKey } from '../src/coach/mastery';
import { recordExerciseMistake, recordStep } from '../src/lib/learning';
import { CONCEPT, CONCEPTS, conceptsOfStep } from '../src/data/concepts';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';

const NOW = new Date('2026-11-24T18:00:00').getTime(); const DAY = 86400000;
function fresh(): State { const s = defaultState(); s.onboarded = true; ensureModel(s).diag = { at: 0, r: 900 }; return s; }
beforeAll(async () => { await loadFsrs(); });

describe('CA2.1 : chaque étape d’exercice a au moins une notion', () => {
  it('leçons et cours : 100 % des exercices étiquetés, notions existantes', () => {
    let n = 0; const miss: string[] = [];
    for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((st, i) => {
      if (st.type !== 'exercise' && st.type !== 'puzzles') return; n++;
      const cs = conceptsOfStep(l.id, st); if (!cs.length || cs.some((c) => !CONCEPT[c])) miss.push(`${l.id}#${i} → ${cs.join(',') || '∅'}`);
    });
    expect(miss, miss.slice(0, 20).join('\n')).toEqual([]);
    expect(n).toBeGreaterThan(400);
  });
  it('le graphe des prérequis ne référence que des notions existantes et n’a pas de cycle', () => {
    for (const c of CONCEPTS) for (const p of c.prereq) expect(CONCEPT[p], `${c.id} ← ${p}`).toBeTruthy();
    const seen = new Set<string>(), stack = new Set<string>();
    const dfs = (id: string): void => { if (stack.has(id)) throw new Error('cycle ' + id); if (seen.has(id)) return; stack.add(id); for (const p of CONCEPT[id].prereq) dfs(p); stack.delete(id); seen.add(id); };
    for (const c of CONCEPTS) dfs(c.id);
  });
});

describe('CA2.2 : une erreur de leçon revient dans le fil quand FSRS la dit due (horloge simulée)', () => {
  it('création, échéance, révision FSRS, retour', () => {
    expect(fsrsReady()).toBe(true);
    const s = fresh(); const l = LESSONS.find((x) => x.id === 'i-fourchette') || LESSONS[10]; const idx = l.steps.findIndex((st) => st.type === 'exercise');
    recordExerciseMistake(s, { lessonId: l.id, stepIdx: idx, step: l.steps[idx], fen: '4k3/8/8/1N6/8/8/8/4K3 w - - 0 1', sol: ['b5c7'], played: 'e1e2', headline: 'Il y a plus fort', t: NOW });
    const id = `x:${l.id}:${idx}`; const m = ensureModel(s);
    expect(m.mistakes[id]?.src).toBe('lesson'); expect(s.srs[id].concept).toBeTruthy();
    const has = (t: number) => feedCandidates(s, m, t).some((c) => c.kind === 'mistake' && c.ref === id);
    expect(has(NOW + 60000)).toBe(false);          // pas tout de suite
    expect(has(NOW + 11 * 60000)).toBe(true);      // due après 10 min
    // réussie dans le fil : FSRS repousse l'échéance
    const t1 = NOW + 11 * 60000; s.srs[id] = review(s.srs[id], 2, t1);
    expect(s.srs[id].f).toBeTruthy(); const due1 = s.srs[id].due;
    expect(has(t1 + 60000)).toBe(false);
    expect(has(due1 + 1000)).toBe(true);
    // la carte porte la notion (entrelacement) mais pas de thème annoncé
    const c = feedCandidates(s, m, due1 + 1000).find((x) => x.ref === id)!; expect(c.concept).toBe(s.srs[id].concept);
  });
});

describe('CA2.3 : fil entrelacé (au plus 2 cartes de la même notion à la suite)', () => {
  it('12 cartes avec 6 erreurs dues de la même notion : jamais 3 à la suite', () => {
    const s = fresh(); const m = s.coach!;
    for (let i = 0; i < 6; i++) { const id = `x:i-fourchette:${i}`; s.srs[id] = { ...newItem(id, 'mistake', NOW - DAY), concept: 'fork' }; m.mistakes[id] = { fen: '4k3/8/8/1N6/8/8/8/4K3 w - - 0 1', sol: ['b5c7'], motif: null, prompt: 'x', at: NOW - DAY, concept: 'fork', src: 'lesson' }; }
    const seq: (string | undefined)[] = []; startSession(s, m, NOW);
    for (let i = 0; i < 12; i++) { const [c] = nextFeedCards(s, m, 1, NOW); if (!c) break; seq.push(c.concept); recordFeed(s, c, 'ok', 20000, false, NOW); sessionCard(s, 20000, true); }
    expect(seq.length).toBe(12);
    let run = 1; for (let i = 1; i < seq.length; i++) { run = seq[i] && seq[i] === seq[i - 1] ? run + 1 : 1; expect(run, seq.join(' ')).toBeLessThanOrEqual(MAX_SAME_CONCEPT); }
    expect(seq.filter((x) => x === 'fork').length).toBeGreaterThanOrEqual(4); // les erreurs dues passent quand même
  });
});

describe('CA2.4 : migration v1 → v2 sans perte', () => {
  it('compétences, preuves, erreurs, file, diagnostic, objectifs : identiques ; notions ajoutées', () => {
    const v1: CoachModel = { v: 1, base: 1100, skills: { fork: { r: 1200, rd: 120, vol: 0.06, n: 9, last: NOW - DAY } }, ev: [{ t: NOW - DAY, k: 'fork', s: 1, src: 'lesson', ref: 'l:i-fourchette' }, { t: NOW - DAY, k: 'fork', s: 0, src: 'puzzle', ref: 'p:abc' }],
      seenQ: 7, games: 3, diag: { at: NOW - 9 * DAY, r: 1000 }, mistakes: { 'm:g1:12': { fen: '8/8/8/8/8/8/8/K6k w - - 0 1', sol: ['a1b1'], motif: 'fork', prompt: 'p', at: NOW - DAY, game: 'g1', ply: 12 } }, week: { start: '2026-11-23', focus: 'fork', goals: [] } };
    const snap = JSON.parse(JSON.stringify(v1));
    expect(migrateModel(v1)).toBe(true);
    const { v: _a, concepts, masteredLog, ...rest } = v1 as any; const { v: _b, ...restSnap } = snap;
    expect(rest).toEqual(restSnap);
    expect(v1.v).toBe(2); expect(concepts.fork?.n).toBe(1); expect(masteredLog).toEqual([]);
    expect(migrateModel(v1)).toBe(false); // idempotent
  });
  it('SRS : un élément SM-2 converti en FSRS garde répétitions, oublis et maîtrise', () => {
    const sm2: SrsItem = { id: 'p:1', kind: 'puzzle', due: NOW, interval: 30, ease: 2.5, reps: 5, lapses: 1, added: NOW - 90 * DAY };
    expect(isMastered(sm2)).toBe(true);
    const c = fromSm2(sm2); expect(c.reps).toBe(5); expect(c.lapses).toBe(1); expect(c.stability).toBe(30);
    const n = fsrsReview(sm2, 2, NOW); expect(n.reps).toBe(6); expect(n.lapses).toBe(1); expect(n.interval).toBeGreaterThan(30); expect(isMastered(n)).toBe(true);
    const f = fsrsReview(sm2, 0, NOW); expect(f.lapses).toBe(2); expect(f.due - NOW).toBeLessThan(DAY);
  });
  it('FSRS est déterministe (pas de flou) : même séquence → mêmes échéances', () => {
    const run = () => { let it = newItem('x', 'mistake', NOW); let t = NOW; const out: number[] = []; for (const g of [2, 2, 0, 2, 3, 1, 2] as const) { t = Math.max(t + 60000, it.due); it = fsrsReview(it, g, t); out.push(it.due); } return out; };
    expect(run()).toEqual(run());
  });
  it('l’export contient les notions', () => {
    const s = fresh(); pushCoach(s, { k: 'concept', t: NOW, ids: ['fork'], ok: true, src: 'lesson' }); ensureModel(s);
    expect(JSON.parse(JSON.stringify(s)).coach.concepts.fork.n).toBe(1);
  });
});

describe('CA7.2 : la maîtrise tombe exactement à la transition', () => {
  it('séquence : jamais avant les 4 conditions, exactement une fois, puis Fragile sur une erreur', () => {
    const m = newModel(); const fens = ['a', 'b', 'c', 'd'].map((x) => `fen-${x}`); let t = NOW; const events: string[] = [];
    const obs = (ok: boolean, ctx: string, il: boolean, dt = 60000) => { t += dt; const b = applyConceptObs(m, 'fork', { ok, firstTry: true, ctx: ctxKey(ctx), interleaved: il, t }); events.push(b || '-'); return b; };
    obs(true, fens[0], false); obs(true, fens[1], false); obs(true, fens[2], false); obs(true, fens[0], false);
    expect(masteryOf(m.concepts!.fork)).toBe('learning'); // pas d'autre jour, pas d'entrelacé
    obs(true, fens[1], true); expect(masteryOf(m.concepts!.fork)).toBe('learning'); // même jour
    const b = obs(true, fens[3], true, DAY); // un autre jour, entrelacé, 4e position
    expect(b).toBe('mastered'); expect(meetsMastery(m.concepts!.fork)).toBe(true);
    expect(events.filter((x) => x === 'mastered').length).toBe(1); expect(m.masteredLog!.length).toBe(1);
    expect(obs(true, fens[2], true)).toBeUndefined(); // pas de seconde célébration
    expect(obs(false, fens[2], true)).toBe('fragile'); expect(masteryOf(m.concepts!.fork)).toBe('fragile');
  });
  it('un indice de niveau 3 ou la solution ne compte pas comme réussite', () => {
    const c = newConceptState('fork'); const r = observeConcept(c, 'fork', { ok: true, hint: 3, t: NOW });
    expect(r.c.p).toBeLessThan(c.p + 0.05); expect(r.c.contexts.length).toBe(0); expect(r.c.days.length).toBe(0);
  });
});

describe('CA7.1 : séance de 5 minutes', () => {
  it('le plan remplit environ 5 minutes avec les temps par défaut', () => {
    const s = fresh(); const p = sessionPlan(s, s.coach!, NOW);
    expect(p.ms).toBeGreaterThan(4 * 60000); expect(p.ms).toBeLessThanOrEqual(SESSION_MS * 1.08); expect(p.cards).toBeGreaterThanOrEqual(6);
  });
  it('les temps mesurés (FeedStat.ms) changent le nombre de cartes, pas la durée', () => {
    const s = fresh(); s.feed = { ...feedToday(s, NOW), kinds: { puzzle: { n: 20, ok: 15, fail: 5, skip: 0, ab: 0, ms: 20 * 15000 }, mate1: { n: 10, ok: 10, fail: 0, skip: 0, ab: 0, ms: 10 * 9000 } } };
    expect(estCardMs(s.feed, 'puzzle')).toBeLessThan(20000);
    const p = sessionPlan(s, s.coach!, NOW); expect(p.ms).toBeGreaterThan(4 * 60000); expect(p.ms).toBeLessThanOrEqual(SESSION_MS * 1.08);
  });
  it('fin de séance quand le budget est consommé (temps simulés), puis résumé', () => {
    const s = fresh(); const m = s.coach!; startSession(s, m, NOW); let n = 0;
    while (!sessionOver(s, NOW) && n < 40) { const [c] = nextFeedCards(s, m, 1, NOW); expect(c).toBeTruthy(); recordFeed(s, c, 'ok', 32000, false, NOW); sessionCard(s, 32000, true); n++; }
    expect(n).toBeGreaterThanOrEqual(8); expect(n).toBeLessThanOrEqual(10); // 9 × 32 s ≈ 4 min 48 s
    const sm = sessionSummary(s, ensureModel(s), NOW)!; expect(sm.n).toBe(n); expect(sm.tomorrow).toMatch(/^Demain/);
  });
});
