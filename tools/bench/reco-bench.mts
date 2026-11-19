// Joueurs simulés : vérifie que le modèle retrouve les vraies faiblesses et que le curriculum propose
// des activités dans la zone proximale (60–90 % de réussite attendue).
import { newModel, observe, weaknesses, skillOf, pSuccess, globalRating } from '../../src/coach/model';
import { coachPlan, activities } from '../../src/coach/curriculum';
import { SKILLS, SKILL, skillsForPuzzle, type SkillId } from '../../src/coach/skills';
import { diagStart, diagTarget, diagAnswer, diagResult, diagDone } from '../../src/coach/diagnostic';
import { defaultState } from '../../src/lib/store';

function rng(seed: number) { let h = Math.imul(seed, 2654435761) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; }; }
const THEMED = SKILLS.filter((s) => s.theme && skillsForPuzzle([s.theme], 4).includes(s.id));
export function simulate(seed: number, nPuzzles = 160) {
  const R = rng(seed); const base = 600 + Math.floor(R() * 1400);
  const truth: Partial<Record<SkillId, number>> = {}; for (const s of THEMED) truth[s.id] = base + (R() - 0.5) * 120;
  const weak = THEMED[Math.floor(R() * THEMED.length)].id; truth[weak] = base - 320;
  let strong = THEMED[Math.floor(R() * THEMED.length)].id; if (strong === weak) strong = THEMED[(THEMED.findIndex((s) => s.id === weak) + 1) % THEMED.length].id; truth[strong] = base + 260;
  const m = newModel(base + (R() - 0.5) * 200); let t = Date.now() - 20 * 86400000;
  for (let i = 0; i < nPuzzles; i++) {
    const sk = THEMED[Math.floor(R() * THEMED.length)]; const d = base + (R() - 0.5) * 500;
    const ks = skillsForPuzzle([sk.theme!], 4).filter((k) => truth[k] != null);
    const trueR = ks.reduce((a, k) => Math.min(a, truth[k]!), 4000);
    const ok = R() < pSuccess(trueR, d);
    const w = ks.length ? Math.max(0.35, 1 / Math.sqrt(ks.length)) : 1;
    t += 3 * 3600000; for (const k of ks) observe(m, { skill: k, s: ok ? 1 : 0, d, w, src: 'puzzle', ref: 'p' + i, t }, t);
  }
  return { m, truth, weak, strong, base };
}
export function runRecoBench(n = 60, np = 160) {
  let se = 0, cnt = 0, det = 0, top1 = 0, top3 = 0, strongFlagged = 0, planHasWeak = 0, inZone = 0, pz = 0, diagErr = 0;
  for (let i = 0; i < n; i++) {
    const { m, truth, weak, strong } = simulate(1000 + i, np);
    for (const s of THEMED) { const st = m.skills[s.id]; if (st && st.n >= 5) { se += (st.r - truth[s.id]!) ** 2; cnt++; } }
    const w = weaknesses(m, 3).map((x) => x.skill);
    if (weaknesses(m, 6).some((x) => x.skill === weak)) det++; if (w[0] === weak) top1++; if (w.includes(weak)) top3++; if (w.includes(strong)) strongFlagged++;
    const s = defaultState(); s.coach = m; s.onboarded = true;
    const plan = coachPlan(s, m, 4); if (plan.some((a) => a.skill === weak)) planHasWeak++;
    for (const a of activities(s, m).filter((x) => x.kind === 'puzzles').slice(0, 3)) { const p = pSuccess(truth[a.skill!]!, a.difficulty!); pz++; if (p >= 0.6 && p <= 0.9) inZone++; }
    // test de placement
    const R = rng(77 + i); const trueR = 500 + R() * 1600; let d = diagStart(1000);
    while (!diagDone(d)) { const tg = diagTarget(d); const ok = R() < pSuccess(trueR, tg.rating); d = diagAnswer(d, { id: 'x' + d.i, r: tg.rating, th: [tg.theme], ok, ms: 20000, plies: 3 }); }
    diagErr += Math.abs(diagResult(d).rating - trueR);
    void SKILL; void skillOf; void globalRating;
  }
  return { players: n, puzzlesPerPlayer: np, skillRMSE: Math.round(Math.sqrt(se / cnt)), weakDetected: +(det / n).toFixed(3), weakTop1: +(top1 / n).toFixed(3), weakTop3: +(top3 / n).toFixed(3), strongMisflagged: +(strongFlagged / n).toFixed(3), planTargetsWeakness: +(planHasWeak / n).toFixed(3), puzzlesInZone60to90: +(inZone / pz).toFixed(3), diagnosticMAE6items: Math.round(diagErr / n) };
}
if (process.argv[1]?.endsWith('reco-bench.mts')) console.log(JSON.stringify([80, 160, 320].map((np) => runRecoBench(+(process.argv[2] || 60), np)), null, 1));
