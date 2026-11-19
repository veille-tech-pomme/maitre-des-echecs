// Captures du coach avec un profil réaliste (tools/coach-seed.mts) : node tools/coach-shots.mjs [dossier] [iphone,desktop]
import { chromium, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const OUT = process.argv[2] || 'screenshots/coach'; const ONLY = (process.argv[3] || 'iphone,desktop').split(',');
const SEED = JSON.parse(readFileSync('tools/tmp/coach-seed.json', 'utf8'));
const PORT = 4175, U = process.env.URL || `http://localhost:${PORT}/`;
mkdirSync(OUT, { recursive: true });
const srv = process.env.URL ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
if (srv) await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEV = { iphone: [webkit, devices['iPhone 14 Pro']], desktop: [chromium, { viewport: { width: 1366, height: 860 } }] };
let errs = [];
for (const d of ONLY) {
  const [bt, opts] = DEV[d]; const b = await bt.launch(); const ctx = await b.newContext({ ...opts, colorScheme: process.env.LIGHT ? 'light' : 'dark' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(d + ' ' + e.message)); p.on('console', (m) => m.type() === 'error' && !/Cross-Origin|access control/.test(m.text()) && errs.push(d + ' ' + m.text()));
  await p.goto(U); await sleep(800);
  await p.evaluate((seed) => { localStorage.setItem('echecs-app-v1', JSON.stringify(seed.state)); for (const [id, r] of Object.entries(seed.reviews)) localStorage.setItem('cr3-' + id, JSON.stringify(r)); }, SEED);
  const shot = async (n, full) => { await sleep(500); await p.screenshot({ path: `${OUT}/${d}-${n}.png`, fullPage: !!full }); };
  await p.goto(U + '#/'); await p.reload(); await p.waitForSelector('.coach-card:not(.skeleton) .cc-title'); await shot('01-accueil'); await shot('01-accueil-full', true);
  await p.goto(U + '#/coach'); await p.waitForSelector('.radar'); await shot('02-mes-progres'); await shot('02-mes-progres-full', true);
  await p.goto(U + '#/game/g2'); await p.waitForSelector('.coach-summary'); await shot('03-bilan'); await shot('03-bilan-full', true);
  await p.click('.review-moves .mv >> nth=12'); await p.waitForSelector('.coach-box h4'); await shot('04-bilan-mat-permis');
  await p.goto(U + '#/game/g3'); await p.waitForSelector('.coach-summary'); await p.click('.review-moves .mv >> nth=10'); await p.waitForSelector('.coach-box h4'); await shot('05-bilan-piece-en-prise');
  const retry = p.locator('.retry-bar .btn').first(); if (await retry.count()) { await retry.click(); await sleep(800); await shot('06-rejouer-moment'); }
  await p.goto(U + '#/review/mistakes'); await sleep(1500); await shot('07-erreurs-a-rejouer');
  await p.goto(U + '#/coach/test'); await p.waitForSelector('cg-board'); await sleep(1200); await shot('08-test-niveau');
  console.log(d, 'ok'); await b.close();
}
srv?.kill(); console.log('erreurs', errs.length, errs.slice(0, 5));
process.exit(0);
