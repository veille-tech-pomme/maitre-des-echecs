// R3 : plus de cul-de-sac — captures iPhone 14 Pro (WebKit). node tools/tmp/r3-shots.mjs [url] [dossier]
import { webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';
import { puzzleById } from '../puzzle-lookup.mjs';
const U = process.argv[2] || 'http://localhost:4173/'; const OUT = process.argv[3] || 'screenshots/r3';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await (process.env.CHROMIUM ? chromium : webkit).launch(); const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], colorScheme: 'dark' }); const p = await ctx.newPage(); p.setDefaultTimeout(30000);
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shot = (n) => p.screenshot({ path: `${OUT}/iphone-${n}.png` });
async function clickSq(sq, orient = 'white', scope = '') {
  const bb = await p.locator((scope ? scope + ' ' : '') + 'cg-board').first().boundingBox(); const s = bb.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await p.mouse.click(bb.x + s * (f + 0.5), bb.y + s * (7 - r + 0.5)); await sleep(160);
}
async function solve(scope, pauseLast = 0) {
  const id = await p.locator(scope + ' [data-pz], ' + scope + '[data-pz]').first().getAttribute('data-pz'); const z = puzzleById(id);
  const orient = z.f.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = z.m.split(' '); await sleep(1300);
  for (let i = 1; i < mv.length; i += 2) { await clickSq(mv[i].slice(0, 2), orient); await clickSq(mv[i].slice(2, 4), orient); if (mv[i][4]) await p.click(`.promo-piece[aria-label="${{ q: 'Dame', n: 'Cavalier', r: 'Tour', b: 'Fou' }[mv[i][4]]}"]`); await sleep(i + 2 >= mv.length ? pauseLast : 900); }
  return id;
}
await p.goto(U); await p.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboarded = true; s.settings = { ...(s.settings || {}), name: 'Camille', theme: 'dark' }; localStorage.setItem(k, JSON.stringify(s)); }); await p.reload(); await sleep(800);
// 1. leçon verrouillée : toujours une suite
await p.goto(U + '#/lesson/d-pion'); await p.waitForSelector('.locked-lesson'); await sleep(500); await shot('r3-01-lecon-verrouillee');
await p.click('text=Je connais déjà'); await p.waitForSelector('.lesson-grid');
// 2. leçon : exercice réussi → « Continuer » se remplit seul
await p.goto(U + '#/learn'); await p.waitForSelector('.path'); await p.goto(U + '#/lesson/d-mat'); await p.waitForSelector('.lesson-grid'); await sleep(400);
const MATES = { 'Mat du couloir': ['d1', 'd8'], 'L’escalier des tours': ['h1', 'h8'], 'Dame et roi': ['a1', 'a8'], 'Le mat du berger': ['h5', 'f7'] };
let shotStep = false;
for (let i = 0; i < 24 && !(await p.locator('.done-screen').count()); i++) {
  const title = (await p.locator('.lesson-side h2').innerText()).trim();
  if (MATES[title]) { await sleep(300); await clickSq(MATES[title][0]); await clickSq(MATES[title][1]); if (!shotStep) { await p.waitForSelector('.lesson .auto-next'); await sleep(450); await p.locator('.lesson .auto-next').scrollIntoViewIfNeeded(); await shot('r3-02-lecon-etape-reussie-auto'); shotStep = true; } await p.waitForFunction((t) => document.querySelector('.done-screen') || document.querySelector('.lesson-side h2')?.textContent.trim() !== t, title, { timeout: 8000 }); continue; }
  if (await p.locator('.lesson-board [data-pz]').count()) { const id = await solve('.lesson-board'); await p.waitForFunction((r) => document.querySelector('.done-screen') || document.querySelector('.lesson-board [data-pz]')?.getAttribute('data-pz') !== r, id, { timeout: 8000 }); continue; }
  await p.click('.lesson-actions .btn.primary'); await sleep(350);
}
await p.waitForSelector('.done-screen .auto-next'); await sleep(2200); await shot('r3-03-lecon-terminee-suivante-seule');
await p.click('.done-screen .an-stop');
// 3. puzzles classés : réussite → suivant seul
await p.goto(U + '#/puzzles/rated');
for (let k = 0; k < 4; k++) { await p.waitForSelector('.puzzle-session[data-pz] cg-board'); const id = await solve('.page', 0); const ok = await p.waitForSelector('.next-btn .auto-next', { timeout: 4000 }).then(() => true, () => false); if (ok) { await sleep(250); await shot('r3-04-puzzle-reussi-suivant-seul'); break; } console.log('puzzle non résolu, on passe', id); await p.click('text=Passer').catch(() => {}); await sleep(800); }
await sleep(2000);
// 4. fin de partie : Revanche (compte à rebours) + Voir le bilan
await p.goto(U + '#/play/odette'); await p.click('.color-opt >> text=Blancs'); await p.click('text=Commencer la partie'); await p.waitForSelector('cg-board'); await sleep(600);
await clickSq('e2'); await clickSq('e4'); await sleep(5000); await clickSq('g1'); await clickSq('f3'); await sleep(5000);
p.once('dialog', (d) => d.accept()); await p.click('text=Abandonner'); await p.waitForSelector('.over .auto-next'); await sleep(2500); await shot('r3-05-fin-de-partie-revanche-bilan');
await p.click('.over .an-row .btn.secondary'); // Voir le bilan
// 5. bilan : le commentaire du coach arrive en surimpression, sans écran bloquant
await p.waitForSelector('.review cg-board'); await sleep(300); await p.locator('.review cg-board').scrollIntoViewIfNeeded(); await shot('r3-06-bilan-demarre-seul');
await p.waitForSelector('.coach-overlay:not(.pend)', { timeout: 90000 }); await p.locator('.review cg-board').scrollIntoViewIfNeeded(); await sleep(500); await shot('r3-07-bilan-coach-surimpression');
// 6. révisions vides : une suite
await p.goto(U + '#/review'); await sleep(700); await shot('r3-08-revisions-vides');
await p.goto(U + '#/review/mistakes'); await sleep(900); await shot('r3-09-erreurs-vides');
console.log('erreurs :', errs.length ? errs : 'aucune'); await b.close();
