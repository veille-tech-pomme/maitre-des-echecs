import fs from 'node:fs';
import { Chess } from 'chess.js';
import { puzzleById } from './puzzle-lookup.mjs';
const THREATS = JSON.parse(fs.readFileSync('src/data/feed-threats.json', 'utf8'));
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
  const loc = page.locator('cg-board').first(); let b = null; for (let i = 0; i < 40 && !b; i++) { b = await loc.boundingBox(); if (!b) await sleep(100); } const s = b.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await page.mouse.click(b.x + s * (f + 0.5), b.y + s * (7 - r + 0.5)); await sleep(150);
}
/** résout le puzzle affiché (identifiant data-pz) : FEN avant le coup adverse, l'utilisateur joue les coups impairs */
async function solvePz(page, scope) {
  const id = await page.locator(scope + ' [data-pz], ' + scope + '[data-pz]').first().getAttribute('data-pz'); const z = puzzleById(id); if (!z) throw new Error('puzzle introuvable : ' + id);
  const orient = z.f.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = z.m.split(' '); await sleep(1300);
  const PR = { q: 'Dame', n: 'Cavalier', r: 'Tour', b: 'Fou' };
  for (let i = 1; i < mv.length; i += 2) { await clickSq(page, mv[i].slice(0, 2), orient); await clickSq(page, mv[i].slice(2, 4), orient); if (mv[i][4]) await page.click(`.promo-piece[aria-label="${PR[mv[i][4]]}"]`); await sleep(900); }
  return id;
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
  const tLoad = Date.now(); await page.goto(URL0); await page.waitForSelector('.ob', { timeout: 15000 });
  // R2 : prénom facultatif puis un premier mat gagnant ; temps jusqu'au premier succès, chargement compris (sans pause de capture)
  await check('accueil : premier succès < 15 s', async () => {
    await page.fill('.ob input', 'Camille'); await page.click('.ob-actions .btn');
    await page.waitForSelector('.ob-board cg-board'); await sleep(400); /* fin de l'animation d'entrée */ await clickSq(page, 'h5'); await clickSq(page, 'f7');
    await page.waitForSelector('.ob .fc-xp', { timeout: 5000 }); const ms = Date.now() - tLoad;
    console.log(`    premier succès en ${(ms / 1000).toFixed(1)} s, chargement compris`); if (ms > 15000) throw new Error(`premier succès en ${ms} ms`);
    await shot('00-premier-mat-reussi');
  });
  await check('accueil : pas de niveau déclaré, pas de détour par la 1re leçon', async () => {
    await page.click('.ob-actions .btn'); await page.waitForFunction(() => !document.querySelector('.ob'));
    const h = await page.evaluate(() => location.hash); if (h !== '#/' && h !== '') throw new Error('redirigé vers ' + h);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1'))); if (st.puzzle.declared) throw new Error('niveau déclaré présent');
    if (!st.obMate?.ok || st.settings.name !== 'Camille') throw new Error('premier mat ou prénom non enregistré');
  });
  // R3 : plus de cul-de-sac
  await check('leçon verrouillée → une prochaine action', async () => {
    await page.goto(URL0 + '#/lesson/d-pion'); await page.waitForSelector('.locked-lesson'); await shot('03-lecon-verrouillee');
    if ((await page.locator('.locked-lesson .center-col .btn').count()) < 3) throw new Error('pas assez d’actions');
    if (!(await page.locator('.locked-lesson a[href^="#/lesson/"]').count())) throw new Error('pas de lien vers la leçon qui ouvre celle-ci');
    await page.click('text=Je connais déjà'); await page.waitForSelector('.lesson-grid');
  });
  await check('leçon : étape réussie → avance seule ; fin → leçon suivante seule', async () => {
    await page.goto(URL0 + '#/learn'); await page.waitForSelector('.path'); await page.goto(URL0 + '#/lesson/d-mat'); await page.waitForSelector('.lesson-grid'); await sleep(400);
    const MATES = { 'Mat du couloir': ['d1', 'd8'], 'L’escalier des tours': ['h1', 'h8'], 'Dame et roi': ['a2', 'a8'], 'Le mat du berger': ['h5', 'f7'] };
    let autos = 0, reads = 0;
    for (let i = 0; i < 24 && !(await page.locator('.done-screen').count()); i++) {
      const title = (await page.locator('.lesson-side h2').innerText()).trim();
      if (MATES[title]) {
        await sleep(300); await clickSq(page, MATES[title][0]); await clickSq(page, MATES[title][1]);
        await page.waitForFunction((t) => document.querySelector('.done-screen') || document.querySelector('.lesson-side h2')?.textContent.trim() !== t, title, { timeout: 8000 }); autos++; continue;
      }
      if (/^Entraînement/.test(title)) await page.waitForSelector('.lesson-board [data-pz]', { timeout: 15000 }).catch(() => {});
      if (await page.locator('.lesson-board [data-pz]').count()) {
        const id = await solvePz(page, '.lesson-board');
        await page.waitForFunction((r) => document.querySelector('.done-screen') || document.querySelector('.lesson-side h2')?.textContent.trim() !== 'Entraînement : mats en 1' || document.querySelector('.lesson-board [data-pz]')?.getAttribute('data-pz') !== r, id, { timeout: 8000 }); continue;
      }
      await page.click('.lesson-actions .btn.primary'); reads++; await sleep(350);
    }
    await page.waitForSelector('.done-screen .auto-next'); await shot('03b-lecon-terminee'); const t0 = Date.now();
    await page.waitForFunction(() => location.hash.startsWith('#/lesson/') && location.hash !== '#/lesson/d-mat', null, { timeout: 10000 });
    console.log(`    ${autos} étapes réussies enchaînées seules, ${reads} lectures « Continuer », leçon suivante ouverte seule en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (autos < 4) throw new Error('enchaînement des exercices : ' + autos);
  });
  await check('leçon : coup équivalent accepté (Mat en 2, 1.Tb7), puis mat contre la meilleure défense', async () => {
    await page.goto(URL0 + '#/lesson/i-calcul'); await sleep(600);
    if (await page.locator('.locked-lesson').count()) { await page.click('text=Je connais déjà'); }
    await page.waitForSelector('.lesson-grid');
    for (let i = 0; i < 6 && !/Mat en 2/.test(await page.locator('.lesson-side h2').innerText()); i++) { await page.click('.lesson-actions .btn.primary'); await sleep(400); }
    await sleep(400); await clickSq(page, 'b1'); await clickSq(page, 'b7');
    await page.waitForFunction(() => /mate aussi vite/.test(document.querySelector('.lesson-board')?.textContent || document.body.textContent), null, { timeout: 15000 });
    await page.waitForFunction(() => /Les Blancs jouent|À toi/.test(document.querySelector('.feedback')?.textContent || ''), null, { timeout: 10000 }); await sleep(400);
    await page.locator('cg-board').first().scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector('cg-board')?.scrollIntoView({ block: 'center' })); await sleep(300);
    await clickSq(page, 'a2'); await clickSq(page, 'a8');
    await page.waitForSelector('.feedback.solved, .success-box', { timeout: 8000 }); await shot('03c-lecon-alternative-acceptee');
  });
  await check('finale Philidor : la méthode est vérifiée (1…Tb1 refusé et expliqué)', async () => {
    await page.goto(URL0 + '#/endgames/philidor'); await page.waitForSelector('cg-board'); await sleep(700);
    await clickSq(page, 'b6', 'black'); await clickSq(page, 'b1', 'black');
    await page.waitForFunction(() => /méthode Philidor/.test(document.querySelector('.feedback')?.textContent || ''), null, { timeout: 8000 }); await shot('03d-philidor-methode');
  });
  await check('jouer : pendule (blitz 3+2) qui décompte', async () => {
    await page.goto(URL0 + '#/play/paulette'); await page.waitForSelector('.tc-pick'); await page.click('.tc-pick .color-opt:nth-child(4)'); await page.click('.sticky-cta .btn');
    await page.waitForSelector('.player-bar .clock'); const t0 = await page.locator('.player-bar.me .clock').innerText(); await sleep(2300);
    const t1 = await page.locator('.player-bar.me .clock').innerText(); if (t0 === t1) throw new Error(`pendule figée (${t0})`);
    await shot('06c-pendule'); console.log(`    pendule ${t0} → ${t1}`);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('echecs-app-v1')); s.settings.playTc = 'none'; localStorage.setItem('echecs-app-v1', JSON.stringify(s)); });
  });
  await check('pour toi : 1re carte', async () => { await page.goto(URL0 + '#/'); await page.waitForSelector('.feed-card:not(.skeleton)', { timeout: 20000 }); await sleep(600); await shot('01-pour-toi'); });
  await check('diagnostic : 6 à 8 premières cartes', async () => {
    let n = 0;
    for (let k = 0; k < 9; k++) {
      await page.waitForSelector('.feed-card:not(.skeleton):not(.leaving)'); await sleep(900);
      const kind = await page.locator('.feed-card').getAttribute('data-kind'); const ref = await page.locator('.feed-card').getAttribute('data-ref');
      if (kind !== 'diag') { if (k < 6) throw new Error(`carte ${k + 1} : ${kind} au lieu du diagnostic`); break; }
      if (k === 0 && !(await page.locator('.fc-beginner').count())) throw new Error('pas de « Je débute »');
      const z = puzzleById(ref); n++;
      if (k === 0 && z) { // la première : on la résout (réponse juste → carte suivante seule)
        const orient = z.f.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = z.m.split(' ');
        for (let i = 1; i < mv.length; i += 2) { await clickSq(page, mv[i].slice(0, 2), orient); await clickSq(page, mv[i].slice(2, 4), orient); await sleep(900); }
      } else await page.click('.fc-skip'); // « Je ne sais pas »
      if (k >= 5 && (await page.waitForSelector('.fc-reveal.good', { timeout: 1500 }).then(() => true, () => false))) await shot('01a-diagnostic-resultat');
      await page.waitForFunction((r) => document.querySelector('.feed-card:not(.leaving)')?.getAttribute('data-ref') !== r, ref, { timeout: 12000 });
    }
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')));
    if (!st.coach?.diag || st.placement?.items.length !== n + 1 || n < 6 || n > 8) throw new Error(`diagnostic non enregistré (${n} positions)`);
    console.log(`    ${n} positions, niveau de départ ${st.coach.diag.r} (classement puzzle ${st.puzzle.rating})`);
  });
  await check('pour toi : pourquoi ? + passer', async () => {
    await page.click('.fc-whybtn'); await page.waitForSelector('.fc-why'); await shot('01b-pour-toi-pourquoi'); await page.click('.fc-whybtn');
    const ref = await page.locator('.feed-card').getAttribute('data-ref'); const done0 = await page.locator('.fh-dots span.on').count();
    await page.click('.fc-skip');
    await page.waitForFunction((r) => document.querySelector('.feed-end') || (document.querySelector('.feed-card:not(.skeleton):not(.leaving)') && document.querySelector('.feed-card').getAttribute('data-ref') !== r), ref, { timeout: 15000 });
    if ((await page.locator('.fh-dots span.on').count()) !== done0 + 1) throw new Error('progression du jour non avancée');
    const sk = await page.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')).feed?.kinds); if (!sk || !Object.values(sk).some((k) => k.skip >= 1)) throw new Error('passe non enregistrée');
  });
  await check('pour toi : réussite → carte suivante seule', async () => {
    // on passe jusqu'à une carte « quelle est la menace ? », puis on répond juste : la carte suivante arrive seule
    for (let i = 0; i < 11; i++) {
      if (await page.locator('.feed-end').count()) throw new Error('fin du jour avant une carte testable');
      await page.waitForSelector('.feed-card:not(.skeleton):not(.leaving)'); await sleep(700);
      const kind = await page.locator('.feed-card').getAttribute('data-kind'); const ref = await page.locator('.feed-card').getAttribute('data-ref');
      if (kind === 'threat') {
        const t = THREATS.find((x) => x.id === ref);
        const fenNul = t.f.split(' '); fenNul[1] = fenNul[1] === 'w' ? 'b' : 'w'; fenNul[3] = '-';
        const san = new Chess(fenNul.join(' ')).move({ from: t.t.slice(0, 2), to: t.t.slice(2, 4), promotion: t.t[4] }).san.replace(/[+#]/g, '');
        const fr = san.replace(/[KQRBN]/g, (c) => ({ K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' })[c]);
        await page.locator('.fc-choice', { hasText: new RegExp('^' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click(); await page.waitForSelector('.fc-reveal.good'); await shot('01c-pour-toi-menace');
        const t0 = Date.now(); await page.waitForFunction((r) => document.querySelector('.feed-end') || document.querySelector('.feed-card:not(.leaving)')?.getAttribute('data-ref') !== r, ref, { timeout: 8000 });
        console.log(`    menace juste → carte suivante en ${Date.now() - t0} ms`); return;
      }
      const z = kind !== 'diag' && kind !== 'threat' ? puzzleById(ref) : null;
      if (z) { // une carte puzzle (le diagnostic de 6 à 8 cartes peut épuiser le fil avant une carte menace) : on la résout
        const orient = z.f.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = z.m.split(' ');
        for (let k = 1; k < mv.length; k += 2) { await clickSq(page, mv[k].slice(0, 2), orient); await clickSq(page, mv[k].slice(2, 4), orient); await sleep(900); }
        const t0 = Date.now(); await page.waitForFunction((r) => document.querySelector('.feed-end') || document.querySelector('.feed-card:not(.leaving)')?.getAttribute('data-ref') !== r, ref, { timeout: 10000 });
        console.log(`    puzzle juste (${kind}) → carte suivante en ${Date.now() - t0} ms`); return;
      }
      await page.click('.fc-skip'); await sleep(300);
    }
    throw new Error('aucune carte menace rencontrée');
  });
  await check('moi : mes progrès', async () => { await page.goto(URL0 + '#/profile'); await page.waitForSelector('.coach-card:not(.skeleton) .cc-title'); await sleep(300); await shot('01d-moi-progres'); });
  await check('apprendre : entrée puzzles', async () => { await page.goto(URL0 + '#/learn'); await page.click('.pz-hub'); await page.waitForSelector('.rating-hero', { timeout: 10000 }); });
  await check('onglets : Pour toi / Apprendre / Jouer / Moi', async () => { const t = (await page.locator(name === 'desktop' ? '.sidebar .nav-item' : '.tabbar a small').allInnerTexts()).map((x) => x.trim()); for (const w of ['Pour toi', 'Apprendre', 'Jouer', 'Moi']) if (!t.includes(w)) throw new Error('onglet manquant : ' + w + ' (' + t.join(', ') + ')'); if (t.includes('Puzzles') || t.includes('Accueil')) throw new Error('ancien onglet encore présent'); });
  await check('coach : mes progrès', async () => { await page.goto(URL0 + '#/coach'); await page.waitForSelector('.radar'); await sleep(300); await shot('40-coach-progres'); });
  await check('coach : bilan du diagnostic', async () => { await page.goto(URL0 + '#/coach/test'); await page.waitForSelector('.diag-result .big'); await shot('41-diagnostic-bilan');
    if ((await page.locator('.nb-left a').first().getAttribute('href')) !== '#/coach') throw new Error('retour du bilan ≠ Mes progrès'); });
  await check('coach : erreurs à rejouer (vide) → une prochaine action', async () => { await page.goto(URL0 + '#/review/mistakes'); await page.waitForSelector('.empty'); if (!(await page.locator('.empty a[href="#/"]').count())) throw new Error('impasse'); });
  await check('parcours', async () => { await page.goto(URL0 + '#/learn'); await page.waitForSelector('.path'); await shot('04-parcours'); });
  await check('puzzle classé', async () => {
    await page.goto(URL0 + '#/puzzles/rated'); await page.waitForSelector('cg-board', { timeout: 15000 }); await sleep(1500); await shot('05-puzzle');
    const b = page.locator('button', { hasText: /Indice/ }).first(); if (await b.count()) { await b.click(); await sleep(400); await shot('05b-puzzle-indice'); }
  });
  await check('puzzles classés : enchaînement automatique', async () => {
    for (let k = 0; k < 2; k++) {
      const id = await solvePz(page, '.page'); const t0 = Date.now();
      await page.waitForFunction((r) => { const e = document.querySelector('.puzzle-session[data-pz]'); return e && e.getAttribute('data-pz') !== r; }, id, { timeout: 8000 });
      console.log(`    puzzle ${k + 1} résolu → suivant seul en ${Date.now() - t0} ms`); await page.waitForSelector('cg-board');
    }
    if (await page.locator('text=Puzzle suivant').count()) throw new Error('bouton « Puzzle suivant » encore présent');
  });
  await check('puzzle du jour → puzzles classés seuls', async () => {
    await page.goto(URL0 + '#/puzzles/daily'); await page.waitForFunction(() => document.querySelector('.gt-title')?.textContent === 'Puzzle du jour' && document.querySelector('.puzzle-session[data-pz] cg-board')); await solvePz(page, '.page'); await sleep(300); await shot('05c-puzzle-du-jour-reussi');
    await page.waitForFunction(() => location.hash === '#/puzzles/rated', null, { timeout: 8000 });
  });
  await check('puzzles hub', async () => { await page.goto(URL0 + '#/puzzles'); await page.waitForSelector('.mode-grid, .theme-grid', { timeout: 10000 }); await shot('06-puzzles'); });
  await check('contre la montre', async () => { await page.goto(URL0 + '#/puzzles/rush'); await sleep(800); await shot('07-rush'); });
  await check('bots', async () => { await page.goto(URL0 + '#/play'); await page.waitForSelector('.bot-card'); await shot('08-bots'); });
  await check('partie vs IA', async () => {
    await page.goto(URL0 + '#/play/odette'); await page.click('.color-opt >> text=Blancs'); await page.click('text=Commencer la partie'); await page.waitForSelector('cg-board'); await sleep(500);
    await clickSq(page, 'e2'); await clickSq(page, 'e4');
    await page.waitForFunction(() => document.querySelectorAll('cg-board piece').length === 32 && document.querySelectorAll('cg-board square.last-move').length === 2 && !!document.querySelector('.coach-box, .bubble'), null, { timeout: 30000 }).catch(() => {});
    await sleep(4000);
    await clickSq(page, 'g1'); await clickSq(page, 'f3'); await sleep(5000); await shot('09-partie-ia');
    await page.waitForFunction(() => !document.querySelector('.actionbar .tool')?.hasAttribute('disabled'), null, { timeout: 30000 }); await page.click('.actionbar >> text=Indice'); await page.waitForSelector('.coach-hint', { timeout: 30000 }); await page.click('.actionbar >> text=Indice suivant'); await sleep(300); await shot('09c-indice-idee');
    page.once('dialog', (d) => d.accept()); await page.click('text=Abandonner'); await page.waitForSelector('.over .auto-next'); await sleep(900); await shot('09b-fin-partie');
    const r1 = await page.locator('.over .an-row .btn').nth(0).boundingBox(); const r2 = await page.locator('.over .an-row .btn').nth(1).boundingBox();
    const t = await page.locator('.over .an-row').innerText(); if (!/Revanche/.test(t) || !/Voir le bilan/.test(t)) throw new Error('fin de partie : ' + t);
    if (Math.abs(r1.y - r2.y) > 4) throw new Error('Revanche et Voir le bilan ne sont pas côte à côte');
    if (!(await page.locator('.over .an-count').count())) throw new Error('pas de compte à rebours');
    await page.click('.over .an-stop'); // « Pas maintenant » : la revanche ne part pas
  });
  await check('analyse', async () => { await page.goto(URL0 + '#/analysis'); await page.waitForSelector('cg-board'); await sleep(4000); await shot('10-analyse'); });
  await check('ouvertures', async () => { await page.goto(URL0 + '#/openings'); await page.waitForSelector('.opening-grid'); await shot('11-ouvertures'); await page.goto(URL0 + '#/openings/italienne'); await sleep(800); await shot('11b-ouverture'); });
  await check('finales', async () => { await page.goto(URL0 + '#/endgames'); await page.waitForSelector('.opening-grid'); await shot('12-finales'); });
  await check('révisions', async () => { await page.goto(URL0 + '#/review'); await sleep(500); await shot('13-revisions'); if ((await page.locator('.empty').count()) && !(await page.locator('.empty a[href="#/"]').count())) throw new Error('révisions vides sans suite'); });
  await check('profil', async () => { await page.goto(URL0 + '#/profile'); await page.waitForSelector('.badge-grid'); await shot('14-profil'); });
  await check('réglages', async () => { await page.goto(URL0 + '#/settings'); await page.waitForSelector('.swatches'); await shot('15-reglages'); });
  await check('premium', async () => { await page.goto(URL0 + '#/premium'); await page.waitForSelector('.plans'); await page.getByText('7 jours gratuits, puis 29,99 €/an, annulable à tout moment', { exact: false }).first().waitFor(); await shot('16-premium'); });
  await check('cours', async () => { await page.goto(URL0 + '#/learn'); await page.waitForSelector('.course-card', { timeout: 15000 }); await page.goto(URL0 + '#/learn/course/mats'); await page.waitForSelector('.lesson-list'); await shot('20-cours-mats'); await page.goto(URL0 + '#/lesson/mats-smotheredMate'); await page.waitForSelector('.lesson-grid', { timeout: 15000 }); await shot('21-lecon-mat-etouffe'); });
  await check('partie célèbre (verrou premium)', async () => { await page.goto(URL0 + '#/learn/course/parties'); await page.waitForSelector('.lesson-list'); await shot('22-parties-celebres'); });
  await check('puzzles sur mesure', async () => { await page.goto(URL0 + '#/puzzles/custom'); await sleep(800); await shot('23-puzzles-sur-mesure'); await page.goto(URL0 + '#/puzzles/custom/go?theme=fork&min=1000&max=1400'); await page.waitForSelector('cg-board', { timeout: 20000 }); await sleep(1200); await shot('24-puzzle-fourchette'); });
  await check('duel', async () => { await page.goto(URL0 + '#/puzzles/battle'); await sleep(800); await shot('25-duel'); });
  await check('parcours puzzles', async () => { await page.goto(URL0 + '#/puzzles/paths'); await sleep(600); await shot('26-parcours-puzzles'); await page.goto(URL0 + '#/puzzles/paths/fourchette'); await sleep(600); });
  await check('entraînement', async () => { await page.goto(URL0 + '#/train'); await page.waitForSelector('.train-list'); await shot('27-entrainement'); await page.goto(URL0 + '#/train/coords'); await page.waitForSelector('cg-board'); await page.click('text=Démarrer'); await sleep(300); await shot('28-coordonnees');
    await page.goto(URL0 + '#/train/memory'); await page.click('text=Commencer'); await page.waitForSelector('cg-board piece', { timeout: 20000 }); await shot('29-memoire');
    await page.goto(URL0 + '#/train/mates'); await page.waitForSelector('cg-board', { timeout: 20000 }); await sleep(800); await shot('30-mats-ordinateur');
    await page.goto(URL0 + '#/train/guess'); await page.click('text=Commencer une partie'); await page.waitForSelector('cg-board'); await sleep(500); await shot('31-devine-le-coup'); });
  await check('explorateur', async () => { await page.goto(URL0 + '#/openings'); await page.click('text=Explorateur'); await page.waitForSelector('.explorer-row', { timeout: 15000 }); await page.waitForSelector('.ms-row', { timeout: 20000 }); await sleep(300); await shot('32-explorateur');
    await page.click('.ms-row >> nth=0'); await page.waitForFunction(() => document.querySelector('.master-stats .ms-total')?.textContent?.includes('parties'), null, { timeout: 20000 });
    await page.click('.ms-row >> nth=0'); await page.waitForSelector('.ms-game', { timeout: 20000 }); await sleep(400); await shot('34-explorateur-stats');
    const n = await page.$$eval('.ms-row', (r) => r.length); if (n < 3) throw new Error('trop peu de coups : ' + n);
    await page.click('.ms-game >> nth=0'); await page.waitForSelector('.game-head', { timeout: 20000 }); await sleep(600); await shot('35-partie-de-maitre'); });
  await check('finales (90)', async () => { await page.goto(URL0 + '#/endgames/kbn-k'); await page.waitForSelector('cg-board'); await shot('33-finale-fou-cavalier'); });
  await check('thème clair', async () => { await page.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k)); s.settings.theme = 'light'; localStorage.setItem(k, JSON.stringify(s)); }); await page.goto(URL0 + '#/'); await page.reload(); await page.waitForSelector('.feed-card:not(.skeleton), .feed-end'); await sleep(600); await shot('17-pour-toi-clair'); });
  await check('bilan de partie', async () => {
    const id = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('echecs-app-v1')); const g = s.games?.[0]; return g?.id; }); if (!id) throw new Error('aucune partie enregistrée');
    await page.goto(URL0 + '#/game/' + id); await page.waitForSelector('.review cg-board', { timeout: 10000 }); // l'échiquier est là tout de suite
    if (await page.locator('text=Lancer le bilan').count()) throw new Error('le bilan ne démarre pas seul');
    await page.waitForSelector('.coach-overlay:not(.pend)', { timeout: 90000 }); await shot('18a-bilan-surimpression');
    await page.waitForSelector('.coach-summary:not(.pending)', { timeout: 90000 }); await sleep(800); await shot('18-bilan');
    await page.click('.review-moves .mv >> nth=2'); await page.waitForSelector('.coach-box h4'); await sleep(300); await shot('18b-bilan-coup');
  });
  await check('packs + moteur chargés', async () => { const l = [...loaded]; const pk = l.filter((u) => u.includes('packs/')), sf = l.filter((u) => u.includes('stockfish')); if (!pk.length || !sf.length) throw new Error('packs ' + pk.length + ' moteur ' + sf.length); console.log('    packs :', pk.length, '· moteur :', sf.map((u) => u.split('/').pop()).join(', ')); });
  await check('service worker', async () => { const ok = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())); if (!ok) throw new Error('pas de SW'); });
  await browser.close(); return true;
}
await run('desktop', chromium, { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 });
const iphone = devices['iPhone 14 Pro'] || devices['iPhone 13'];
const wk = await run('iphone', webkit, { ...iphone });
if (!wk) await run('iphone-chromium', chromium, { ...iphone, defaultBrowserType: undefined });
srv.kill();
// WebKit + COOP/COEP locaux : le worker multi-thread est refusé puis le moteur repart en mono-thread (repli voulu, absent en production sans COEP).
const real = errors.filter((e) => !/favicon|Failed to load resource.*(404)/.test(e) && !/^\[iphone\].*(Cross-Origin-Embedder-Policy|(stockfish-18-lite\.js|packs\/\w+\/b\d+\.gz).*access control checks)/.test(e)); // WebKit : téléchargement annulé par page.goto
console.log(`\nErreurs console : ${real.length}`); real.slice(0, 40).forEach((e) => console.log(' - ' + e));
console.log(`Échecs de vérification : ${failures}`);
process.exit(real.length || failures ? 1 : 0);
