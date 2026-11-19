// Modèle du joueur (Glicko-2 par compétence), curriculum et test de placement — joueurs simulés.
import { describe, it, expect } from 'vitest';
import { glicko2, newModel, observe, sync, weaknesses, evidenceFor, applyGame, radar, globalRating, rawToEvents } from '../src/coach/model';
import { coachPlan, ensureModel, ensureWeek, weekProgress, addMistakes, zpd, coachHeadline } from '../src/coach/curriculum';
import { defaultState, pushCoach } from '../src/lib/store';
import { runRecoBench } from '../tools/bench/reco-bench.mts';

describe('Glicko-2', () => {
  it('victoire contre plus fort : la note monte, le RD baisse', () => {
    const a = glicko2({ r: 1500, rd: 200, vol: 0.06, n: 0, last: 0 }, 1700, 60, 1);
    expect(a.r).toBeGreaterThan(1600); expect(a.rd).toBeLessThan(200);
    const b = glicko2({ r: 1500, rd: 200, vol: 0.06, n: 0, last: 0 }, 1700, 60, 0);
    expect(b.r).toBeLessThan(1500); expect(b.r).toBeGreaterThan(1400);
  });
  it('exemple de référence de Glickman (≈ 1464 / 151,5)', () => {
    // un seul match équivalent n'existe pas ; on enchaîne les 3 matchs de l'article (approximation séquentielle)
    let s = { r: 1500, rd: 200, vol: 0.06, n: 0, last: 0 };
    s = glicko2(s, 1400, 30, 1); s = glicko2(s, 1550, 100, 0); s = glicko2(s, 1700, 300, 0);
    expect(Math.abs(s.r - 1464)).toBeLessThan(25); expect(Math.abs(s.rd - 151.5)).toBeLessThan(15);
  });
  it('score fractionnaire et poids', () => {
    const half = glicko2({ r: 1500, rd: 100, vol: 0.06, n: 0, last: 0 }, 1500, 60, 0.5);
    expect(Math.abs(half.r - 1500)).toBeLessThan(1);
    const w1 = glicko2({ r: 1500, rd: 100, vol: 0.06, n: 0, last: 0 }, 1500, 60, 1, 1).r - 1500;
    const w2 = glicko2({ r: 1500, rd: 100, vol: 0.06, n: 0, last: 0 }, 1500, 60, 1, 0.3).r - 1500;
    expect(w2).toBeLessThan(w1); expect(w2).toBeGreaterThan(0);
  });
});
describe('modèle et preuves', () => {
  it('file d’évènements → compétences (une seule fois)', () => {
    const s = defaultState();
    for (let i = 0; i < 5; i++) pushCoach(s, { k: 'puzzle', t: Date.now(), id: 'x' + i, r: 1200, th: ['fork', 'middlegame'], ok: i % 2 === 0, plies: 3 });
    const m = ensureModel(s); expect(m.skills.fork?.n).toBe(5); ensureModel(s); expect(m.skills.fork?.n).toBe(5);
    pushCoach(s, { k: 'lesson', t: Date.now(), id: 'i-fourchette', level: 'intermediaire', stars: 3 }); ensureModel(s); expect(m.skills.fork?.n).toBe(6);
    expect(rawToEvents({ k: 'puzzle', t: 0, id: 'a', r: 1000, th: ['mateIn2', 'backRankMate'], ok: true, plies: 3 }).map((e) => e.skill).sort()).toEqual(['backRank', 'mateN']);
  });
  it('faiblesse récurrente en partie : preuve chiffrée', () => {
    const m = newModel(1200);
    for (let g = 0; g < 4; g++) applyGame(m, 'g' + g, [{ skill: 'vigilance', s: 0, d: 950, src: 'game', ref: '#' + (10 + g), motif: 'fork', piece: 'n', lost: 3 }, { skill: 'fork', s: 1, d: 1300, src: 'game', ref: '#' + (20 + g), motif: 'fork' }]);
    const w = weaknesses(m); expect(w[0].skill).toBe('vigilance');
    expect(w[0].evidence[0]).toMatch(/4 fourchettes de cavalier subies dans 4 de tes 4 dernières parties/);
    expect(evidenceFor(m, 'fork').lines.join(' ')).toMatch(/trouvée?s? en partie/);
    expect(applyGame(m, 'g0', [])).toBe(false);
    expect(radar(m)).toHaveLength(6); expect(globalRating(m)).toBeGreaterThan(800);
  });
  it('erreurs personnelles → répétition espacée', () => {
    const s = defaultState(); const m = ensureModel(s);
    const r: any = { retries: [{ ply: 9, fen: '8/8/8/8/8/8/8/K6k w - - 0 1', solution: ['a1b1'], motif: 'fork', prompt: 'x' }], moves: Array(12).fill(0).map(() => ({ dE: 0.3, ex: { headline: 'Tu perds une tour' } })) };
    expect(addMistakes(s, m, r, 'g1')).toBe(1); expect(s.srs['m:g1:9'].kind).toBe('mistake'); expect(addMistakes(s, m, r, 'g1')).toBe(0);
  });
  it('objectifs de la semaine et accroche', () => {
    const s = defaultState(); const m = ensureModel(s); const w = ensureWeek(s, m);
    expect(w.goals.length).toBeGreaterThanOrEqual(3); expect(weekProgress(s, m)!.goals.every((g) => g.done <= g.target)).toBe(true);
    expect(coachHeadline(s, m).title).toBe('Faisons connaissance');
    expect(coachPlan(s, m)[0].kind).toBe('diag');
  });
  it('zpd maximale à 75 %', () => { expect(zpd(0.75)).toBe(1); expect(zpd(0.95)).toBeLessThan(0.2); expect(zpd(0.5)).toBeLessThan(0.1); });
});
describe('joueurs simulés (bench)', () => {
  it('le modèle retrouve la faiblesse et le curriculum vise la zone proximale', () => {
    const r = runRecoBench(120, 160);
    expect(r.weakDetected).toBeGreaterThanOrEqual(0.85); expect(r.weakTop3).toBeGreaterThanOrEqual(0.78);
    expect(r.strongMisflagged).toBeLessThanOrEqual(0.02); expect(r.planTargetsWeakness).toBeGreaterThanOrEqual(0.7);
    expect(r.puzzlesInZone60to90).toBeGreaterThanOrEqual(0.6); expect(r.skillRMSE).toBeLessThan(140);
    expect(r.diagnosticMAE6items).toBeLessThan(170);
  });
});
