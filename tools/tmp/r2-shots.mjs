// R2 : accueil < 15 s + diagnostic dans les 4 premières cartes. node tools/tmp/r2-shots.mjs [url] [dossier]
import { webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';
import { puzzleById } from '../puzzle-lookup.mjs';
const U = process.argv[2] || 'http://localhost:4173/'; const OUT = process.argv[3] || 'screenshots/r2';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await (process.env.CHROMIUM ? chromium : webkit).launch(); const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], colorScheme: 'dark' }); const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/access control|Load failed/.test(m.text()) && errs.push(m.text()));
async function clickSq(scope, sq, orient) {
  const bb = await p.locator(scope + ' cg-board').first().boundingBox(); const s = bb.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await p.mouse.click(bb.x + s * (f + 0.5), bb.y + s * (7 - r + 0.5)); await sleep(160);
}
const T0 = Date.now(); await p.goto(U); await p.waitForSelector('.ob');
await p.screenshot({ path: `${OUT}/iphone-ob-00-prenom.png` });
await p.fill('.ob input', 'Camille'); await p.click('.ob-actions .btn');
await p.waitForSelector('.ob-board cg-board'); await sleep(350); await p.screenshot({ path: `${OUT}/iphone-ob-01-mat.png` });
await clickSq('.ob-board', 'h5'); await clickSq('.ob-board', 'f7');
await p.waitForSelector('.ob .fc-xp'); const ttfs = Date.now() - T0;
await sleep(500); await p.screenshot({ path: `${OUT}/iphone-ob-02-mat-reussi.png` });
console.log(`premier succès en ${ttfs} ms (chargement compris)`);
await p.click('.ob-actions .btn'); // Continuer
const plan = ['solve', 'skip', 'solve', 'wrong'];
for (let k = 0; k < 4; k++) {
  await p.waitForSelector('.feed-card[data-kind="diag"]:not(.leaving)', { timeout: 20000 }); await sleep(1100);
  const ref = await p.locator('.feed-card').getAttribute('data-ref'); const z = puzzleById(ref);
  if (k === 0) await p.screenshot({ path: `${OUT}/iphone-diag-1.png` });
  const orient = z.f.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = z.m.split(' ');
  if (plan[k] === 'skip') { await p.click('.fc-skip'); console.log(`diag ${k + 1} : je ne sais pas`); }
  else if (plan[k] === 'wrong') {
    // un coup légal mais faux : on cherche dans la position après le coup adverse
    const { Chess } = await import('chess.js'); const c = new Chess(z.f); c.move({ from: mv[0].slice(0, 2), to: mv[0].slice(2, 4), promotion: mv[0][4] });
    const w = c.moves({ verbose: true }).find((x) => x.from + x.to !== mv[1].slice(0, 4));
    await clickSq('.feed-card', w.from, orient); await clickSq('.feed-card', w.to, orient); console.log(`diag ${k + 1} : coup faux`);
  } else {
    for (let i = 1; i < mv.length; i += 2) { await clickSq('.feed-card', mv[i].slice(0, 2), orient); await clickSq('.feed-card', mv[i].slice(2, 4), orient); await sleep(1000); }
    console.log(`diag ${k + 1} : résolu`);
  }
  if (k === 0) { await sleep(150); await p.screenshot({ path: `${OUT}/iphone-diag-1-reussi.png` }); }
  if (k === 3) { await p.waitForSelector('.fc-reveal.good', { timeout: 8000 }); await sleep(900); await p.screenshot({ path: `${OUT}/iphone-diag-resultat.png` }); }
  await p.waitForFunction((r) => document.querySelector('.feed-card:not(.leaving)')?.getAttribute('data-ref') !== r, ref, { timeout: 15000 }).catch(async (e) => { await p.screenshot({ path: OUT + '/ERR.png' }); console.log(ref, z, errs); throw e; });
}
await p.waitForSelector('.feed-card:not(.skeleton):not(.leaving)'); await sleep(1000);
const k5 = await p.locator('.feed-card').getAttribute('data-kind'); console.log('carte 5 :', k5); await p.screenshot({ path: `${OUT}/iphone-carte-5.png` });
const st = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echecs-app-v1')); return { diag: s.coach?.diag, rating: s.puzzle.rating, items: s.placement?.items.length, hash: location.hash, name: s.settings.name }; });
console.log(JSON.stringify(st));
await p.goto(U + '#/coach/test'); await p.waitForSelector('.diag-result'); await sleep(500); await p.screenshot({ path: `${OUT}/iphone-diag-bilan.png` });
console.log('erreurs :', errs.length, errs.slice(0, 3));
await b.close();
