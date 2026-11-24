// Banc de joueurs simulés (cahier GOAT, CA2.5) : vérifie que « Maîtrisée » (mastery.ts) n'est pas déclarée à tort
// et mesure le temps de détection. Chaque joueur a, par notion, un état caché (apprise ou non) qui évolue comme dans
// le modèle de Corbett & Anderson (apprentissage T à chaque essai, oubli lent entre les jours), avec des paramètres
// tirés au hasard autour de ceux du modèle (les vrais élèves ne suivent pas nos paramètres). Graine fixe : reproductible.
// Usage : npx tsx bench/mastery-sim.mts [joueurs=400] [jours=30]
import fs from 'node:fs';
import { newConceptState, observeConcept, masteryOf, ctxKey, type ConceptState } from '../src/coach/mastery';

let seed = 20261124; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const PLAYERS = +(process.argv[2] || 400), DAYS = +(process.argv[3] || 30), CONCEPTS = ['fork', 'pin', 'skewer', 'back-rank', 'hanging', 'opposition'];
const DAY = 86400000, T0 = new Date('2026-01-05T18:00:00').getTime();
interface Truth { known: boolean; T: number; G: number; S: number; forget: number; learnedAt?: number }
let declared = 0, falseMastery = 0, firstDecl = 0, firstFalse = 0, trueMastered = 0, detected = 0; const lagDays: number[] = []; let fragileAfter = 0, obsTotal = 0;
const perPlayerMastered: number[] = [];
for (let p = 0; p < PLAYERS; p++) {
  const skill = rnd(); // élève plus ou moins rapide
  const truth: Record<string, Truth> = {}; const st: Record<string, ConceptState> = {}; const detectedAt: Record<string, number> = {};
  for (const c of CONCEPTS) { truth[c] = { known: rnd() < 0.1, T: 0.05 + 0.25 * skill * rnd(), G: 0.05 + 0.25 * rnd(), S: 0.03 + 0.15 * rnd(), forget: 0.01 + 0.04 * rnd() }; st[c] = newConceptState(c); if (truth[c].known) truth[c].learnedAt = T0; }
  let nM = 0;
  for (let d = 0; d < DAYS; d++) {
    if (rnd() < 0.3) continue; // jours sans séance
    for (const c of CONCEPTS) { const tr = truth[c]; if (tr.known && rnd() < tr.forget) { tr.known = false; tr.learnedAt = undefined; } }
    // séance : 10 observations entrelacées (2 notions au plus à la suite), positions variées
    let prev = '', prev2 = '';
    for (let k = 0; k < 10; k++) {
      let c = CONCEPTS[Math.floor(rnd() * CONCEPTS.length)]; if (c === prev && c === prev2) c = CONCEPTS[(CONCEPTS.indexOf(c) + 1) % CONCEPTS.length];
      prev2 = prev; prev = c; const tr = truth[c]; const t = T0 + d * DAY + k * 30000;
      const ok = tr.known ? rnd() > tr.S : rnd() < tr.G; obsTotal++;
      const r = observeConcept(st[c], c, { ok, firstTry: true, ctx: ctxKey(`${c}-${Math.floor(rnd() * 40)}`), interleaved: true, t }); st[c] = r.c;
      if (r.became === 'mastered' && !detectedAt[c]) { firstDecl++; if (!tr.known) firstFalse++; }
      if (r.became === 'mastered') { declared++; nM++; if (!tr.known) falseMastery++; else { lagDays.push((t - (tr.learnedAt ?? T0)) / DAY); } detectedAt[c] = t; }
      if (r.became === 'fragile' && tr.known) fragileAfter++;
      if (!tr.known && rnd() < tr.T) { tr.known = true; tr.learnedAt = t; }
    }
  }
  for (const c of CONCEPTS) { if (truth[c].known) { trueMastered++; if (masteryOf(st[c]) === 'mastered') detected++; } }
  perPlayerMastered.push(nM);
}
lagDays.sort((a, b) => a - b);
const q = (a: number[], x: number) => (a.length ? Math.round(a[Math.floor(x * (a.length - 1))] * 10) / 10 : null);
const res = {
  players: PLAYERS, days: DAYS, concepts: CONCEPTS.length, observations: obsTotal,
  masteryDeclared: declared, falseMasteryRate: declared ? +(falseMastery / declared).toFixed(3) : 0,
  firstMasteryCelebrated: firstDecl, falseFirstMasteryRate: firstDecl ? +(firstFalse / firstDecl).toFixed(3) : 0,
  recallOfTrueMastery: trueMastered ? +(detected / trueMastered).toFixed(3) : 0,
  detectionLagDays: { p25: q(lagDays, 0.25), median: q(lagDays, 0.5), p75: q(lagDays, 0.75) },
  wrongFragileOnKnown: fragileAfter,
};
console.log(JSON.stringify(res, null, 2));
fs.writeFileSync(new URL('./mastery-sim.result.json', import.meta.url), JSON.stringify(res, null, 2) + '\n');
