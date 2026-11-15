// Test E2E headless : bureau (Chromium) + iPhone (WebKit, repli Chromium mobile). Capture erreurs console + captures d'écran.
import { chromium, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const PORT = 4173, URL0 = process.env.E2E_URL || `http://localhost:${PORT}/`;
mkdirSync('screenshots', { recursive: true });
const srv = process.env.E2E_URL ? { kill() {} } : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
if (!process.env.E2E_URL) await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const errors = []; let failures = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickSq(page, sq, orient = 'white') {
  const b = await page.locator('cg-board').first().boundingBox(); const s = b.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await page.mouse.click(b.x + s * (f + 0.5), b.y + s * (7 - r + 0.5)); await sleep(150);
}
async function run(name, browserType, ctxOpts) {
  let browser;
  try { browser = await browserType.launch(); } catch (e) { console.log(`⚠️ ${name}: lancement impossible (${String(e.message).split('\n')[0]})`); return false; }
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${page.url().split("#")[1] || "/"} console: ${m.text()}`); });
  const loaded = new Set(); page.on('response', (r) => { const u = r.url(); if (r.ok() && /packs\/|stockfish/.test(u)) loaded.add(u.replace(URL0, '')); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  const shot = async (n) => { await sleep(450); return page.screenshot({ path: `screenshots/${process.env.E2E_URL ? 'live-' : ''}${name}-${n}.png`, fullPage: false }); };
  const check = async (label, fn) => { try { await fn(); console.log(`  ✓ ${label}`); } catch (e) { failures++; console.log(`  ✗ ${label}: ${String(e.message).split('\n')[0]}`); await shot('ERR-' + label.replace(/\W+/g, '_')).catch(() => {}); } };
  console.log(`▶ ${name}`);
  await page.goto(URL0); await page.waitForSelector('.modal', { timeout: 15000 });
  await check('onboarding', async () => { await shot('00-onboarding'); await page.fill('.modal input', 'Camille'); await page.click('text=Je débute'); await page.waitForSelector('.lesson-grid', { timeout: 10000 }); });
  await check('leçon (1ère)', async () => { await sleep(600); await shot('02-lecon'); });
  await check('leçon exercice (pion)', async () => {
    await page.goto(URL0 + '#/lesson/d-pion'); await page.waitForSelector('.lesson-grid'); await sleep(500);
    for (let i = 0; i < 6 && !(await page.locator('cg-board').count()); i++) { await page.click('.lesson-actions .btn.primary'); await sleep(300); }
    await shot('03-lecon-exercice');
  });
  await check('accueil', async () => { await page.goto(URL0 + '#/'); await page.waitForSelector('.plan-card'); await sleep(400); await shot('01-accueil'); });
  await check('parcours', async () => { await page.goto(URL0 + '#/learn'); await page.waitForSelector('.path'); await shot('04-parcours'); });
  await check('puzzle classé', async () => {
    await page.goto(URL0 + '#/puzzles/rated'); await page.waitForSelector('cg-board', { timeout: 15000 }); await sleep(1500); await shot('05-puzzle');
    const b = page.locator('button', { hasText: /Indice/ }).first(); if (await b.count()) { await b.click(); await sleep(400); await shot('05b-puzzle-indice'); }
  });
  await check('puzzles hub', async () => { await page.goto(URL0 + '#/puzzles'); await page.waitForSelector('.mode-grid, .theme-grid', { timeout: 10000 }); await shot('06-puzzles'); });
  await check('contre la montre', async () => { await page.goto(URL0 + '#/puzzles/rush'); await sleep(800); await shot('07-rush'); });
  await check('bots', async () => { await page.goto(URL0 + '#/play'); await page.waitForSelector('.bot-grid'); await shot('08-bots'); });
  await check('partie vs IA', async () => {
    await page.goto(URL0 + '#/play/odette'); await page.click('text=Blancs'); await page.waitForSelector('cg-board'); await sleep(500);
    await clickSq(page, 'e2'); await clickSq(page, 'e4');
    await page.waitForFunction(() => document.querySelectorAll('cg-board piece').length === 32 && document.querySelectorAll('cg-board square.last-move').length === 2 && !!document.querySelector('.coach-box, .bubble'), null, { timeout: 30000 }).catch(() => {});
    await sleep(4000);
    await clickSq(page, 'g1'); await clickSq(page, 'f3'); await sleep(5000); await shot('09-partie-ia');
    page.once('dialog', (d) => d.accept()); await page.click('text=Abandonner'); await sleep(1200); await shot('09b-fin-partie');
  });
  await check('analyse', async () => { await page.goto(URL0 + '#/analysis'); await page.waitForSelector('cg-board'); await sleep(4000); await shot('10-analyse'); });
  await check('ouvertures', async () => { await page.goto(URL0 + '#/openings'); await page.waitForSelector('.opening-grid'); await shot('11-ouvertures'); await page.goto(URL0 + '#/openings/italienne'); await sleep(800); await shot('11b-ouverture'); });
  await check('finales', async () => { await page.goto(URL0 + '#/endgames'); await page.waitForSelector('.opening-grid'); await shot('12-finales'); });
  await check('révisions', async () => { await page.goto(URL0 + '#/review'); await sleep(500); await shot('13-revisions'); });
  await check('profil', async () => { await page.goto(URL0 + '#/profile'); await page.waitForSelector('.badge-grid'); await shot('14-profil'); });
  await check('réglages', async () => { await page.goto(URL0 + '#/settings'); await page.waitForSelector('.swatches'); await shot('15-reglages'); });
  await check('premium', async () => { await page.goto(URL0 + '#/premium'); await page.waitForSelector('.plans'); await page.getByText('7 jours gratuits, puis 29,99 €/an, annulable à tout moment', { exact: false }).first().waitFor(); await shot('16-premium'); });
  await check('cours', async () => { await page.goto(URL0 + '#/learn'); await page.waitForSelector('.opening-grid', { timeout: 15000 }); await page.goto(URL0 + '#/learn/course/mats'); await page.waitForSelector('.opening-grid'); await shot('20-cours-mats'); await page.goto(URL0 + '#/lesson/mats-smotheredMate'); await page.waitForSelector('.lesson-grid', { timeout: 15000 }); await shot('21-lecon-mat-etouffe'); });
  await check('partie célèbre (verrou premium)', async () => { await page.goto(URL0 + '#/learn/course/parties'); await page.waitForSelector('.opening-grid'); await shot('22-parties-celebres'); });
  await check('puzzles sur mesure', async () => { await page.goto(URL0 + '#/puzzles/custom'); await sleep(800); await shot('23-puzzles-sur-mesure'); await page.goto(URL0 + '#/puzzles/custom/go?theme=fork&min=1000&max=1400'); await page.waitForSelector('cg-board', { timeout: 20000 }); await sleep(1200); await shot('24-puzzle-fourchette'); });
  await check('duel', async () => { await page.goto(URL0 + '#/puzzles/battle'); await sleep(800); await shot('25-duel'); });
  await check('parcours puzzles', async () => { await page.goto(URL0 + '#/puzzles/paths'); await sleep(600); await shot('26-parcours-puzzles'); await page.goto(URL0 + '#/puzzles/paths/fourchette'); await sleep(600); });
  await check('entraînement', async () => { await page.goto(URL0 + '#/train'); await page.waitForSelector('.opening-grid'); await shot('27-entrainement'); await page.goto(URL0 + '#/train/coords'); await page.waitForSelector('cg-board'); await page.click('text=Démarrer'); await sleep(300); await shot('28-coordonnees');
    await page.goto(URL0 + '#/train/memory'); await page.click('text=Commencer'); await page.waitForSelector('cg-board piece', { timeout: 20000 }); await shot('29-memoire');
    await page.goto(URL0 + '#/train/mates'); await page.waitForSelector('cg-board', { timeout: 20000 }); await sleep(800); await shot('30-mats-ordinateur');
    await page.goto(URL0 + '#/train/guess'); await page.click('text=Commencer une partie'); await page.waitForSelector('cg-board'); await sleep(500); await shot('31-devine-le-coup'); });
  await check('explorateur', async () => { await page.goto(URL0 + '#/openings'); await page.click('text=Explorateur'); await page.waitForSelector('.explorer-row', { timeout: 15000 }); await page.waitForSelector('.ms-row', { timeout: 20000 }); await sleep(300); await shot('32-explorateur');
    await page.click('.ms-row >> nth=0'); await page.waitForFunction(() => document.querySelector('.master-stats .ms-total')?.textContent?.includes('parties'), null, { timeout: 20000 });
    await page.click('.ms-row >> nth=0'); await page.waitForSelector('.ms-game', { timeout: 20000 }); await sleep(400); await shot('34-explorateur-stats');
    const n = await page.$$eval('.ms-row', (r) => r.length); if (n < 3) throw new Error('trop peu de coups : ' + n);
    await page.click('.ms-game >> nth=0'); await page.waitForSelector('.game-head', { timeout: 20000 }); await sleep(600); await shot('35-partie-de-maitre'); });
  await check('finales (90)', async () => { await page.goto(URL0 + '#/endgames/kbn-k'); await page.waitForSelector('cg-board'); await shot('33-finale-fou-cavalier'); });
  await check('thème clair', async () => { await page.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k)); s.settings.theme = 'light'; localStorage.setItem(k, JSON.stringify(s)); }); await page.goto(URL0 + '#/'); await page.reload(); await page.waitForSelector('.plan-card'); await shot('17-accueil-clair'); });
  await check('bilan de partie', async () => {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('echecs-app-v1')); const g = s.games?.[0]; return g?.id; }).then(async (id) => { if (!id) throw new Error('aucune partie enregistrée'); await page.goto(URL0 + '#/game/' + id); await page.click('text=Lancer le bilan'); await page.waitForSelector('.coach-box, .acc', { timeout: 60000 }); await sleep(800); await shot('18-bilan'); });
  }).catch(() => {});
  await check('packs + moteur chargés', async () => { const l = [...loaded]; const pk = l.filter((u) => u.includes('packs/')), sf = l.filter((u) => u.includes('stockfish')); if (!pk.length || !sf.length) throw new Error('packs ' + pk.length + ' moteur ' + sf.length); console.log('    packs :', pk.length, '· moteur :', sf.map((u) => u.split('/').pop()).join(', ')); });
  await check('service worker', async () => { const ok = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())); if (!ok) throw new Error('pas de SW'); });
  await browser.close(); return true;
}
await run('desktop', chromium, { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 });
const iphone = devices['iPhone 14 Pro'] || devices['iPhone 13'];
const wk = await run('iphone', webkit, { ...iphone });
if (!wk) await run('iphone-chromium', chromium, { ...iphone, defaultBrowserType: undefined });
srv.kill();
const real = errors.filter((e) => !/favicon|Failed to load resource.*(404)/.test(e));
console.log(`\nErreurs console : ${real.length}`); real.slice(0, 40).forEach((e) => console.log(' - ' + e));
console.log(`Échecs de vérification : ${failures}`);
process.exit(real.length || failures ? 1 : 0);
