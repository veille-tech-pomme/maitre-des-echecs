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
const errors = []; let failures = 0; const timings = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickSq(page, sq, orient = 'white') {
  const loc = page.locator('cg-board').first(); let b = null; for (let i = 0; i < 40 && !b; i++) { b = await loc.boundingBox(); if (!b) await sleep(100); } const s = b.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await page.mouse.click(b.x + s * (f + 0.5), b.y + s * (7 - r + 0.5)); await sleep(150);
}
/** P0 : position lue sur l'échiquier (éléments <piece> de chessground, clé cgKey) → un coup légal pour le joueur (Blancs) */
async function pickMyMove(page) {
  const pcs = await page.evaluate(() => [...document.querySelectorAll('.game-board cg-board piece, cg-board piece')].filter((e) => e.cgKey && !e.classList.contains('ghost') && !e.classList.contains('fading')).map((e) => ({ k: e.cgKey, c: e.className })));
  const ch = new Chess(); ch.clear();
  const T = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
  for (const { k, c } of pcs) { const color = c.includes('white') ? 'w' : 'b'; const role = Object.keys(T).find((r) => c.includes(r)); if (role) ch.put({ type: T[role], color }, k); }
  const fen = ch.fen().replace(/ [wb] .*/, ' w - - 0 1'); const c2 = new Chess(fen); const mv = c2.moves({ verbose: true });
  if (!mv.length) return null;
  const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  mv.sort((a, b) => (V[b.captured] || 0) - (V[a.captured] || 0) || (['e2', 'd2', 'g1', 'b1', 'f1', 'c1'].indexOf(b.from) - ['e2', 'd2', 'g1', 'b1', 'f1', 'c1'].indexOf(a.from)));
  return mv[0];
}
/** P0 : lit le journal IndexedDB de la page (après l'écriture groupée) */
async function readJournal(pg) {
  await sleep(2600);
  return pg.evaluate(() => new Promise((res) => { const rq = indexedDB.open('echecs-events', 1); rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains('ev')) return res([]); const g = db.transaction('ev', 'readonly').objectStore('ev').getAll(); g.onsuccess = () => res(g.result); g.onerror = () => res([]); }; rq.onerror = () => res([]); }));
}
/** P0 : joue n coups (Blancs, sans coach) contre le bot affiché */
async function playMoves(pg, n) {
  let played = 0;
  for (; played < n; played++) {
    const ok = await pg.waitForFunction(() => document.querySelector('.player-bar.me .clock.on') || document.querySelector('.play-grid div.over, div.over'), null, { timeout: 20000 }).then(() => true, () => false);
    if (!ok || (await pg.locator('div.over').count())) break;
    await sleep(250); const m = await pickMyMove(pg); if (!m) break;
    await clickSq(pg, m.from); await clickSq(pg, m.to); if (m.promotion) await pg.click('.promo-piece[aria-label="Dame"]').catch(() => {});
    await pg.waitForFunction(() => !document.querySelector('.player-bar.me .clock.on'), null, { timeout: 5000 }).catch(() => {});
  }
  return played;
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
  // P0 : la feuille de consentement peut apparaître à la 2e carte du fil ; dans le parcours principal on répond « Non merci »
  let consentSeen = 0; await page.addLocatorHandler(page.locator('.consent-sheet'), async () => { consentSeen++; await page.click('.consent-sheet .cs-no'); });
  const shot = async (n) => { await sleep(450); return page.screenshot({ path: `screenshots/${process.env.E2E_URL ? 'live-' : ''}${name}-${n}.png`, fullPage: false }); };
  /** captures GOAT phase 1 (à tester par l'utilisateur) */
  const shotG2 = async (pg, n) => { await sleep(450); fs.mkdirSync('screenshots/r4', { recursive: true }); return pg.screenshot({ path: `screenshots/r4/${process.env.E2E_URL ? 'live-' : ''}${name}-r4a-${n}.png`, fullPage: false }); };
  const shotB = async (pg, n) => { await sleep(450); fs.mkdirSync('screenshots/r4', { recursive: true }); return pg.screenshot({ path: `screenshots/r4/${process.env.E2E_URL ? 'live-' : ''}${name}-r4b-${n}.png`, fullPage: false }); };
  const shotG = async (n) => { await sleep(450); return page.screenshot({ path: `screenshots/goat1/${process.env.E2E_URL ? 'live-' : ''}${name}-${n}.png`, fullPage: false }); };
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
    await page.waitForFunction(() => /marche aussi|mate en 2 comme/.test(document.querySelector('.lesson-board')?.textContent || document.body.textContent), null, { timeout: 15000 });
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
    await page.goto(URL0 + '#/play/paulette'); await page.waitForSelector('.tc-pick'); await page.click('.tc-pick .color-opt:has-text("3 min + 2 s")'); await page.click('.sticky-cta .btn');
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
  // ——— GOAT phase 1 ———
  const pieces = () => page.evaluate(() => [...document.querySelectorAll('.lesson-board cg-board piece')].map((p) => p.className + '@' + p.style.transform).sort().join('|'));
  await check('GOAT P1 : coup faux → fiche « Pourquoi » précise ; Montre-moi rejoue la réfutation et revient à la position (CA1.1, CA1.5, CA1.6)', async () => {
    await page.goto(URL0 + '#/lesson/d-mat?step=1'); await page.waitForSelector('.lesson-board cg-board'); await page.waitForFunction(() => /jouent/.test(document.querySelector('.lesson-board .feedback')?.textContent || '')); await sleep(500);
    const before = await pieces(); const t0 = Date.now();
    await clickSq(page, 'd1'); await clickSq(page, 'd2');
    await page.waitForSelector('.lesson-board .mistake-sheet'); const first = Date.now() - t0;
    const h1 = (await page.locator('.mistake-sheet .ms-head').innerText()).trim();
    await page.waitForFunction(() => document.querySelector('.mistake-sheet')?.getAttribute('data-source') !== 'symbolic' && document.querySelector('.mistake-sheet .ms-show'), null, { timeout: 15000 }); const fin = Date.now() - t0;
    const h = (await page.locator('.mistake-sheet .ms-head').innerText()).trim();
    if (/^(Réessaie|Pas tout à fait)/.test(h) || h.length < 10) throw new Error('titre générique : ' + h);
    console.log(`    1re phrase en ${first} ms (« ${h1} »), diagnostic final en ${fin} ms : « ${h} »`); timings.push({ name, first, fin });
    await shotG('01-fiche-pourquoi');
    await page.click('.mistake-sheet .ms-show'); await page.waitForSelector('.mistake-sheet .ms-narr'); await sleep(1600); await shotG('02-montre-moi');
    const narr = (await page.locator('.mistake-sheet .ms-narr').innerText()).trim(); if (!narr) throw new Error('narration vide');
    await page.waitForSelector('.mistake-sheet .ms-actions', { timeout: 15000 }); await sleep(700);
    if ((await pieces()) !== before) throw new Error('la position n’est pas revenue exactement au départ');
  });
  await check('GOAT P1 : 3 niveaux d’indice, sans le coup aux niveaux 1 et 2 (CA1.4)', async () => {
    await page.goto(URL0 + '#/lesson/d-mat?step=1&h=1'); await page.waitForSelector('.lesson-board cg-board'); await sleep(500);
    const txt = []; for (let k = 1; k <= 3; k++) { await page.click('.lesson-hint'); await page.waitForSelector(`.coach-hint[data-level="${k}"]`); txt.push((await page.locator('.coach-hint').innerText()).trim()); if (k === 2) await shotG('03-indice-2'); }
    if (/Td8|Txd8/.test(txt[0]) || /Td8|Txd8/.test(txt[1])) throw new Error('le coup apparaît avant le niveau 3 : ' + txt.slice(0, 2).join(' / '));
    if (!/Td8/.test(txt[2])) throw new Error('niveau 3 sans le coup : ' + txt[2]);
    if (await page.locator('.lesson-hint').count()) throw new Error('un 4e niveau est proposé');
    await shotG('04-indice-3');
  });
  await check('GOAT P1 : Débutant, coup illégal expliqué', async () => {
    await page.goto(URL0 + '#/lesson/d-mat?step=1&i=1'); await page.waitForSelector('.lesson-board cg-board'); await sleep(500);
    await clickSq(page, 'd1'); await clickSq(page, 'e3');
    await page.waitForSelector('.mistake-sheet[data-kind="illegal"]', { timeout: 8000 }); const h = (await page.locator('.mistake-sheet .ms-head').innerText()).trim();
    if (h.length < 10) throw new Error('explication courte : ' + h); console.log(`    « ${h} »`); await shotG('05-coup-illegal');
  });
  await check('GOAT P7 : séance de 5 minutes en un geste, temps simulés, fin de séance (CA7.1) ; thème jamais annoncé avant la réponse (CA2.3)', async () => {
    await page.clock.install(); await page.goto(URL0 + '#/'); await page.reload();
    await page.waitForSelector('.session-start', { timeout: 20000 }); const est = (await page.locator('.session-start small').innerText()).trim();
    const m = est.match(/≈ (\d+) min · (\d+) cartes/); if (!m || +m[1] < 4 || +m[1] > 6) throw new Error('durée estimée : ' + est);
    await shotG('06-accueil-seance');
    await page.click('.session-start'); await page.waitForSelector('.session-gauge'); let n = 0; const seen = [];
    for (; n < 25 && !(await page.locator('.session-end').count()); n++) {
      await page.waitForSelector('.feed-card:not(.skeleton):not(.leaving), .session-end', { timeout: 20000 }); if (await page.locator('.session-end').count()) break;
      const kind = await page.locator('.feed-card').getAttribute('data-kind'); const lab = (await page.locator('.feed-card .fc-kind').innerText()).trim(); seen.push(kind);
      if (['puzzle', 'mate1', 'mistake'].includes(kind) && ((await page.locator('.feed-card .fc-sub').count()) || /Mat en 1|Rejoue/.test(lab))) throw new Error(`thème annoncé avant la réponse (${kind} : ${lab})`);
      if (n === 1) await shotG('07-seance-jauge');
      const ref = await page.locator('.feed-card').getAttribute('data-ref');
      await page.clock.fastForward(32000); await page.click('.fc-skip');
      await page.waitForFunction((r) => document.querySelector('.session-end') || (document.querySelector('.feed-card:not(.skeleton):not(.leaving)') && document.querySelector('.feed-card').getAttribute('data-ref') !== r), ref, { timeout: 15000 });
    }
    await page.waitForSelector('.session-end', { timeout: 10000 }); await shotG('08-fin-de-seance');
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')).session);
    console.log(`    estimé « ${est} » ; ${st.n} cartes en ${(st.spent / 60000).toFixed(1)} min simulées (${seen.join(', ')})`);
    if (st.spent < 4.5 * 60000 || st.spent > 5.6 * 60000) throw new Error('durée simulée ' + st.spent);
    if (!(await page.locator('.session-end .fe-teaser').innerText()).startsWith('Demain')) throw new Error('pas de « ce qui revient demain »');
    await page.click('.se-continue'); await page.waitForSelector('.feed-card, .feed-end', { timeout: 15000 });
    await page.reload(); // fin de l'horloge simulée
  });
  await check('GOAT P2 : carte des notions (Mes progrès) et célébration de maîtrise', async () => {
    await page.goto(URL0 + '#/coach'); await page.reload(); await page.waitForSelector('.concept-map .cm-chip'); // reload : après page.clock (P7), le seul changement de hash n'est pas toujours servi const n = await page.locator('.concept-map .cm-chip').count(); if (n < 40) throw new Error('notions : ' + n);
    await page.locator('.concept-map .cm-chip').first().click(); await page.waitForSelector('.cm-detail'); await page.locator('.concept-map').scrollIntoViewIfNeeded(); await shotG('09-carte-des-notions');
    await page.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k)); const t = Date.now(); s.coach.concepts.fork = { p: 0.95, n: 9, lastOk: t, lastFail: 0, firstTryStreak: 6, contexts: ['a', 'b', 'c', 'd'], days: ['2026-11-23', '2026-11-24'], inter: 2, at: t, ever: true, last: [1, 1, 1, 1, 1] }; s.coach.masteredLog = [...(s.coach.masteredLog || []), { id: 'fork', t }]; localStorage.setItem(k, JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector('.mastery-cel', { timeout: 10000 }); await shotG('10-notion-maitrisee');
    await page.click('.mastery-cel .btn'); await page.waitForFunction(() => !document.querySelector('.mastery-cel'));
  });
  // R4a (plan rétention §6, §2.13) : migration v1 → v2 (sauvegarde gardée), identifiant d'installation stable, journal local,
  // J1/J7/J30 calculés sur l'appareil, export ; AUCUNE requête ne transporte l'identifiant ni le journal.
  await check('R4a : migration v1→v3, identifiant stable, mesures locales, rien ne sort', async () => {
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const v1 = { v: 1, createdAt: Date.now() - 40 * 86400e3, xp: 420, onboarded: true, lessons: { 'd-echiquier': { done: true, stars: 3, step: 0 } }, activity: { [d(40)]: 30, [d(39)]: 10, [d(33)]: 5, [d(2)]: 8 }, streak: { count: 1, best: 3, last: d(2) }, settings: { name: 'Léa' } };
    await c2.addInitScript((v) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('echecs-app-v1', JSON.stringify(v)); } }, v1);
    const reqs = []; p2.on('request', (r) => reqs.push(r.url() + ' ' + (r.postData() || '')));
    await p2.goto(URL0 + '#/dev/metrics'); await p2.waitForSelector('[data-testid=retention] .mt-tile');
    await sleep(600);
    const st = await p2.evaluate(() => ({ s: JSON.parse(localStorage.getItem('echecs-app-v1') || '{}'), bak: localStorage.getItem('echecs-app-v1.bak-v1') }));
    if (st.s.v !== 3 || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(st.s.deviceId || '')) throw new Error('migration : ' + JSON.stringify({ v: st.s.v, dev: st.s.deviceId }));
    if (!st.bak || JSON.parse(st.bak).xp !== 420 || st.s.xp !== 420 || st.s.settings.name !== 'Léa') throw new Error('perte de données ou sauvegarde absente');
    if (st.s.installDay !== d(40)) throw new Error('jour d’installation ' + st.s.installDay);
    const ret = await p2.locator('[data-testid=retention] .mt-tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-ret')));
    if (ret.join() !== 'yes,yes,no') throw new Error('J1/J7/J30 attendus oui,oui,non : ' + ret);
    for (const t of ['app_open', 'session_start', 'migration']) if (!(await p2.locator(`[data-testid=by-type] [data-type=${t}]`).count())) throw new Error('évènement absent : ' + t);
    await shotG2(p2, '01-mes-mesures');
    const [dl] = await Promise.all([p2.waitForEvent('download'), p2.click('.mt-export')]);
    const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); if (j.dev !== st.s.deviceId || !j.events.some((e) => e.type === 'app_open' && e.dev === st.s.deviceId)) throw new Error('export du journal');
    await p2.reload(); await p2.waitForSelector('[data-testid=retention] .mt-tile');
    const dev2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')).deviceId); if (dev2 !== st.s.deviceId) throw new Error('identifiant instable');
    await p2.goto(URL0 + '#/settings'); await p2.waitForSelector('a[href="#/dev/metrics"]'); await shotG2(p2, '02-reglages-mes-mesures');
    const leak = reqs.filter((u) => u.includes(st.s.deviceId)); if (leak.length) throw new Error('identifiant dans une requête : ' + leak[0].slice(0, 120));
    const foreign = reqs.map((u) => u.split(' ')[0]).filter((u) => !u.startsWith(URL0) && !u.startsWith('data:') && !u.startsWith('blob:'));
    console.log(`    ${reqs.length} requêtes, 0 avec l’identifiant ; hors site : ${foreign.length ? [...new Set(foreign.map((u) => new URL(u).host))].join(', ') : 'aucune'}`);
    await c2.close();
  });
  await check('P0 : la feuille de consentement est apparue dans le fil (après le 1er mat), une seule fois', async () => {
    if (consentSeen !== 1) throw new Error('feuille vue ' + consentSeen + ' fois');
    const c = await page.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')).consent); if (!c || c.detail !== false || c.asked !== 1) throw new Error('consentement : ' + JSON.stringify(c));
  });
  // P0 (brief modélisation §9) : consentement accepté → partie 3+2 de 10 coups → compteurs ; aucune requête nouvelle
  await check('P0 : consentement accepté, partie 3+2 de 10 coups journalisée (temps par coup), écran dev', async () => {
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    p2.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] P0 console: ${m.text()}`); });
    await c2.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('echecs-app-v1', JSON.stringify({ xp: 0, onboarded: true, lessons: {}, puzzle: { rating: 1200, games: 20, history: [], solved: 15, failed: 5, seen: [], streak: 0, bestStreak: 0 } })); } });
    const reqs = []; p2.on('request', (r) => reqs.push(r.url()));
    await p2.goto(URL0 + '#/settings'); await p2.click('label:has(.detail-switch)');
    await p2.waitForSelector('.consent-sheet'); await shotG2(p2, '03-consentement');
    const yesBox = await p2.locator('.cs-yes').boundingBox(), noBox = await p2.locator('.cs-no').boundingBox();
    const [bgY, bgN] = await Promise.all([p2.locator('.cs-yes').evaluate((e) => getComputedStyle(e).backgroundColor), p2.locator('.cs-no').evaluate((e) => getComputedStyle(e).backgroundColor)]);
    if (Math.abs(yesBox.width - noBox.width) > 2 || Math.abs(yesBox.height - noBox.height) > 2 || bgY !== bgN) throw new Error('boutons de poids inégal');
    if (await p2.locator('.consent-sheet input:checked').count()) throw new Error('case pré-cochée');
    await p2.click('.cs-yes'); if (!(await p2.locator('.cs-need').count())) throw new Error('âge non demandé');
    await p2.click('.cs-opt:has-text("13 ans ou plus")'); await p2.click('.cs-yes'); await p2.waitForSelector('.consent-sheet', { state: 'detached' });
    await p2.goto(URL0 + '#/play/paulette'); await p2.waitForSelector('.tc-pick');
    const def = await p2.locator('.tc-pick .color-opt.on').innerText(); if (!def.includes('Sans pendule')) throw new Error('cadence par défaut : ' + def);
    await p2.click('.tc-pick .color-opt:has-text("3 min + 2 s")'); await p2.click('.color-pick .color-opt:has-text("Blancs")');
    if (await p2.locator('.switch-row input.switch:checked').count()) await p2.click('.switch-row:has-text("Mode coach")');
    await p2.click('.sticky-cta .btn'); await p2.waitForSelector('.player-bar .clock');
    const n = await playMoves(p2, 10); await sleep(1500); await shotG2(p2, '04-partie-3+2');
    const pgnClk = null;
    await p2.goto(URL0 + '#/dev/events'); await p2.waitForSelector('[data-testid=ev-count]'); await sleep(400); await shotG2(p2, '05-ce-que-le-coach-sait');
    const ev = await readJournal(p2);
    const gs = ev.filter((e) => e.type === 'game_start'), mv = ev.filter((e) => e.type === 'move'), ge = ev.filter((e) => e.type === 'game_end');
    const mine = mv.filter((e) => e.data.side === 'me');
    if (gs.length !== 1 || ge.length !== 1) throw new Error(`game_start ${gs.length}, game_end ${ge.length}`);
    if (mine.length !== n || Math.abs(mv.length - 2 * n) > 1) throw new Error(`coups ${mine.length} / ${mv.length} pour ${n} joués`);
    if (!mine.every((e) => e.data.thinkMs > 0 && e.data.input && Array.isArray(e.data.lifts) && e.data.clockMs > 0)) throw new Error('move incomplet : ' + JSON.stringify(mine[0].data));
    if (JSON.stringify(gs[0].data.tc) !== JSON.stringify({ base: 180, inc: 2 })) throw new Error('tc ' + JSON.stringify(gs[0].data.tc));
    const ui = await p2.locator('[data-testid=ev-types] [data-type=move] b').innerText(); if (+ui !== mv.length) throw new Error(`écran dev move=${ui} ≠ ${mv.length}`);
    const per = mv.reduce((a, e) => a + JSON.stringify(e).length, 0) / mv.length;
    const foreign = [...new Set(reqs.filter((u) => !u.startsWith(URL0) && !u.startsWith('data:') && !u.startsWith('blob:')).map((u) => new URL(u).host))];
    if (foreign.length) throw new Error('requêtes hors site : ' + foreign.join(', '));
    console.log(`    ${n} coups joués : ${gs.length} game_start, ${mv.length} move (${mine.length} à moi, thinkMs médian ${mine.map((e) => e.data.thinkMs).sort((a, b) => a - b)[mine.length >> 1]} ms), ${ge.length} game_end (${ge[0].data.how}) ; ${Math.round(per)} o/coup ; 0 requête hors site`);
    await c2.close();
  });
  await check('P0 : consentement refusé (feuille du fil) → aucun move journalisé', async () => {
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    await c2.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('echecs-app-v1', JSON.stringify({ xp: 0, onboarded: true, lessons: {}, puzzle: { rating: 1200, games: 20, history: [], solved: 15, failed: 5, seen: [], streak: 0, bestStreak: 0 } })); } });
    await p2.goto(URL0 + '#/'); await p2.waitForSelector('.feed-card:not(.skeleton)', { timeout: 25000 });
    if (await p2.locator('.consent-sheet').count()) throw new Error('feuille dès la 1re carte');
    await p2.click('.fc-skip'); await p2.waitForSelector('.consent-sheet', { timeout: 15000 }); await shotG2(p2, '06-consentement-fil');
    await p2.click('.cs-no'); await p2.waitForSelector('.consent-sheet', { state: 'detached' });
    await p2.goto(URL0 + '#/play/paulette'); await p2.waitForSelector('.tc-pick'); await p2.click('.color-pick .color-opt:has-text("Blancs")');
    if (await p2.locator('.switch-row input.switch:checked').count()) await p2.click('.switch-row:has-text("Mode coach")');
    await p2.click('.sticky-cta .btn'); await p2.waitForSelector('cg-board');
    // sans pendule : on attend la main en surveillant le tour (pas de .clock)
    for (let i = 0; i < 3; i++) { await sleep(1800); const m = await pickMyMove(p2); if (!m) break; await clickSq(p2, m.from); await clickSq(p2, m.to); }
    await p2.goto(URL0 + '#/dev/events'); await p2.waitForSelector('[data-testid=ev-count]');
    const ev = await readJournal(p2);
    const bad = ev.filter((e) => ['move', 'takeback', 'puzzle_try', 'lesson_step', 'visibility', 'puzzle_rush'].includes(e.type));
    if (bad.length) throw new Error(`${bad.length} évènements détaillés sans accord (${bad[0].type})`);
    const cons = ev.filter((e) => e.type === 'consent'); if (cons.length !== 1 || cons[0].data.detail !== false) throw new Error('trace du refus absente');
    if (!ev.some((e) => e.type === 'game_start')) throw new Error('game_start (base) absent');
    console.log(`    refus : ${ev.length} évènements de base, 0 détaillé`);
    await c2.close();
  });
  // R4b (plan §2.2) : Coup du jour à calendrier figé, ouvert par un lien partagé (nouveau visiteur), une tentative notée,
  // grille sans spoiler, partage natif (feuille du système simulée), résultat gardé, rejouer sans note, numéro futur bloqué.
  await check('R4b : Coup du jour par lien (nouveau visiteur), 1 erreur → 🟨, grille partagée sans spoiler', async () => {
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    await c2.addInitScript(() => { window.__shared = []; Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } }); });
    p2.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}/r4b] ${p2.url().split('#')[1] || '/'} console: ${m.text()}`); });
    const reqs = []; p2.on('request', (r) => reqs.push(r.url()));
    await p2.goto(URL0 + '#/jour'); await p2.waitForSelector('.daily-page[data-jour]');
    const n = +(await p2.locator('.daily-page').getAttribute('data-jour')); if ((await p2.locator('.daily-page').getAttribute('data-rated')) !== '1') throw new Error('tentative non notée');
    const e = await p2.evaluate(async (n) => { const y = new Date(Date.UTC(2026, 10, 24) + (n - 1) * 864e5).getUTCFullYear(); const l = await (await fetch(`daily/${y}.json`)).json(); return l.find((x) => x.n === n); }, n);
    const orient = e.fen.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = e.moves.split(' ');
    const c = new Chess(e.fen); c.move({ from: mv[0].slice(0, 2), to: mv[0].slice(2, 4), promotion: mv[0][4] });
    const wrong = c.moves({ verbose: true }).find((m) => m.from + m.to !== mv[1].slice(0, 4) && !m.san.includes('#'));
    await sleep(1300); await shotB(p2, '01-coup-du-jour');
    await clickSq(p2, wrong.from, orient); await clickSq(p2, wrong.to, orient); if (wrong.promotion) await p2.click('.promo-piece[aria-label="Dame"]').catch(() => {});
    await sleep(1800);
    const PR = { q: 'Dame', n: 'Cavalier', r: 'Tour', b: 'Fou' };
    for (let i = 1; i < mv.length; i += 2) { await clickSq(p2, mv[i].slice(0, 2), orient); await clickSq(p2, mv[i].slice(2, 4), orient); if (mv[i][4]) await p2.click(`.promo-piece[aria-label="${PR[mv[i][4]]}"]`); await sleep(1000); }
    await p2.waitForSelector('.daily-result .dj-grid.big', { timeout: 10000 });
    const cells = await p2.locator('.daily-result .dj-grid.big .dj-cell').evaluateAll((l) => l.map((x) => x.className.replace('dj-cell ', '')));
    const exp = 'y' + 'g'.repeat(Math.floor(mv.length / 2) - 1); if (cells.join('') !== exp) throw new Error(`grille ${cells.join('')} ≠ ${exp}`);
    await shotB(p2, '02-resultat');
    await p2.evaluate(fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8'));
    const ax = await p2.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} ${x.nodes[0]?.target}`));
    if (ax.length) throw new Error('axe (résultat) : ' + ax.join(' | '));
    await p2.click('.daily-result .btn.primary'); await sleep(300);
    const shared = await p2.evaluate(() => window.__shared); const txt = shared[0]?.text || '';
    if (!new RegExp(`^♟ Coup du jour #${n} · [★☆]{5}\\n🟨(🟩)*  ⏱ \\d+:\\d\\d  💡0\\n`).test(txt)) throw new Error('texte partagé : ' + JSON.stringify(txt));
    if (!txt.endsWith(`#/jour/${n}`)) throw new Error('lien absent');
    for (const u of mv) if (txt.includes(u.slice(2, 4))) throw new Error('spoiler : ' + u);
    const st = await p2.evaluate(() => JSON.parse(localStorage.getItem('echecs-app-v1')));
    if (st.jour?.[n]?.grid !== exp || !st.jour[n].ok || !(st.jour[n].ms > 0)) throw new Error('résultat non gardé ' + JSON.stringify(st.jour?.[n]));
    // une seule tentative notée : au retour, le résultat ; « Rejouer » est sans note
    await p2.goto(URL0 + '#/'); await p2.goto(URL0 + '#/jour/' + n); await p2.waitForSelector('.daily-result');
    await p2.click('text=Rejouer (sans note)'); await p2.waitForSelector('.daily-page[data-rated="0"]');
    await p2.goto(URL0 + '#/jour/' + (n + 1)); await p2.waitForSelector('text=n’est pas encore sorti');
    await p2.goto(URL0 + '#/jour/archives'); await p2.waitForSelector('.dj-archive .item'); await shotB(p2, '03-archives');
    const ev = await readJournal(p2);
    const dp = ev.filter((x) => x.type === 'daily_played'); const sh = ev.filter((x) => x.type === 'share');
    if (dp.length !== 1 || dp[0].data.n !== n || dp[0].data.grid !== exp || !dp[0].data.rated) throw new Error('daily_played ' + JSON.stringify(dp.map((x) => x.data)));
    if (sh.length !== 1 || sh[0].data.via !== 'share') throw new Error('share ' + JSON.stringify(sh.map((x) => x.data)));
    if (ev.some((x) => x.type === 'puzzle_try')) throw new Error('puzzle_try sans accord');
    const foreign = [...new Set(reqs.filter((u) => !u.startsWith(URL0) && !u.startsWith('data:') && !u.startsWith('blob:')).map((u) => new URL(u).host))]; if (foreign.length) throw new Error('requêtes hors site : ' + foreign.join(', '));
    console.log(`    #${n} ${e.puzzleId} (${e.rating}, ${e.theme}) : grille ${cells.join('')}, partage « ${txt.split('\n')[1]} »`);
    await c2.close();
  });
  await check('R4b + P0 : avec accord, Coup du jour « Montre le coup » → 🟥, puzzle_try (jour et classé)', async () => {
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    p2.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}/r4b2] ${p2.url().split('#')[1] || '/'} console: ${m.text()}`); });
    const seed = { v: 1, createdAt: Date.now() - 3 * 86400e3, onboarded: true, xp: 50, settings: { name: 'Noé' }, consent: { detail: true, upload: false, ageBand: '13+', at: Date.now(), textV: 1, asked: 1 } };
    await c2.addInitScript((v) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('echecs-app-v1', JSON.stringify(v)); } }, seed);
    await p2.goto(URL0 + '#/'); await p2.waitForSelector('.daily-chip'); await shotB(p2, '04-pour-toi-chip');
    await p2.click('.daily-chip'); await p2.waitForSelector('.daily-page[data-rated="1"]'); await sleep(1300);
    await p2.click('.daily-page button:has-text("Indice")'); await p2.click('.daily-page button:has-text("Montre le coup")');
    const n = +(await p2.locator('.daily-page').getAttribute('data-jour'));
    const e = await p2.evaluate(async (n) => { const y = new Date(Date.UTC(2026, 10, 24) + (n - 1) * 864e5).getUTCFullYear(); const l = await (await fetch(`daily/${y}.json`)).json(); return l.find((x) => x.n === n); }, n);
    const orient = e.fen.split(' ')[1] === 'w' ? 'black' : 'white'; const mv = e.moves.split(' '); await sleep(1800);
    const PR = { q: 'Dame', n: 'Cavalier', r: 'Tour', b: 'Fou' };
    for (let i = 3; i < mv.length; i += 2) { await clickSq(p2, mv[i].slice(0, 2), orient); await clickSq(p2, mv[i].slice(2, 4), orient); if (mv[i][4]) await p2.click(`.promo-piece[aria-label="${PR[mv[i][4]]}"]`); await sleep(1000); }
    await p2.waitForSelector('.daily-result .dj-grid.big', { timeout: 10000 });
    const g = (await p2.locator('.daily-result .dj-grid.big .dj-cell').evaluateAll((l) => l.map((x) => x.className.replace('dj-cell ', '')))).join('');
    if (g !== 'r' + 'g'.repeat(Math.floor(mv.length / 2) - 1)) throw new Error('grille ' + g);
    // puzzle classé : une tentative = un puzzle_try
    await p2.goto(URL0 + '#/puzzles/rated'); await p2.waitForSelector('.puzzle-session[data-pz]'); const pid = await solvePz(p2, '.puzzle-session'); await p2.waitForSelector('.next-btn', { timeout: 10000 });
    const ev = await readJournal(p2); const pt = ev.filter((x) => x.type === 'puzzle_try');
    const dj = pt.find((x) => x.data.mode === 'daily'), rt = pt.find((x) => x.data.pid === pid);
    if (pt.length !== 2 || !dj || dj.data.ok || !dj.data.shown || dj.data.hints !== 1) throw new Error('puzzle_try du jour ' + JSON.stringify(pt.map((x) => x.data)));
    if (!rt || !rt.data.ok || rt.data.mode !== 'rated' || !(rt.data.totalMs > 0) || !(rt.data.firstMoveMs > 0) || rt.data.hints !== 0) throw new Error('puzzle_try classé ' + JSON.stringify(rt?.data));
    console.log(`    jour : grille ${g} (indice + coup montré) ; classé ${pid} : 1er coup ${rt.data.firstMoveMs} ms, total ${rt.data.totalMs} ms`);
    await c2.close();
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
  await check('ancien lien #/puzzles/daily → Coup du jour (calendrier figé)', async () => {
    await page.goto(URL0 + '#/puzzles/daily'); await page.waitForSelector('.daily-page[data-jour] cg-board, .daily-result[data-jour]'); await sleep(300); await shot('05c-coup-du-jour');
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
  // pilier 8 (F8.4) : accessibilité axe-core (WCAG 2.x A/AA) sur les écrans principaux ; échec sur toute violation « serious » ou « critical »
  await check('accessibilité axe-core (WCAG A/AA)', async () => {
    const AXE = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8'); const bad = [];
    for (const r of ['#/', '#/learn', '#/lesson/d-echiquier', '#/play', '#/puzzles', '#/coach', '#/profile', '#/settings', '#/jour', '#/jour/archives']) {
      await page.goto(URL0 + r); await page.waitForSelector('.page, main', { timeout: 15000 }); await sleep(900);
      await page.evaluate(AXE);
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes.length}) ${x.nodes[0]?.target}`));
      for (const x of v) bad.push(`${r} ${x}`);
    }
    if (bad.length) throw new Error(bad.join(' | '));
  });
  await check('service worker', async () => { const ok = await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())); if (!ok) throw new Error('pas de SW'); });
  await browser.close(); return true;
}
await run('desktop', chromium, { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 });
const iphone = devices['iPhone 14 Pro'] || devices['iPhone 13'];
const wk = await run('iphone', webkit, { ...iphone });
if (!wk) await run('iphone-chromium', chromium, { ...iphone, defaultBrowserType: undefined });
// CA1.6 : latence de la 1re phrase sur iPhone émulé avec CPU ralenti 4× (bridage CPU par CDP : Chromium seulement,
// WebKit n'en a pas ; la mesure WebKit non bridée est dans « timings »)
{
  const W = JSON.parse(fs.readFileSync('tools/data/e2e-wrong-moves.json', 'utf8')).filter((x) => x.level === 'debutant' || x.level === 'intermediaire').filter((_, i) => i % 6 === 0).slice(0, 12);
  const b = await chromium.launch(); const ctx = await b.newContext({ ...iphone, defaultBrowserType: undefined });
  await ctx.addInitScript(`localStorage.setItem('echecs-app-v1', JSON.stringify({ xp: 0, onboarded: true, lessons: Object.fromEntries(${JSON.stringify([...new Set(W.map((x) => x.id))])}.map((i) => [i, { done: true, stars: 3, step: 0 }]).concat([['unlock-intermediaire', { done: false, stars: 0, step: 0 }], ['unlock-avance', { done: false, stars: 0, step: 0 }]])) }));`);
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const firsts = [], finals = [];
  await page.goto(URL0 + '#/learn'); await sleep(1500);
  for (const it of W) {
    try {
      await page.goto(`${URL0}#/lesson/${it.id}?step=${it.step}`); await page.waitForSelector('.lesson-board cg-board', { timeout: 20000 }); await sleep(900);
      const bb = await page.locator('.lesson-board cg-board').first().boundingBox(); const sz = bb.width / 8;
      const at = (sq) => { let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (it.orient === 'black') { f = 7 - f; r = 7 - r; } return [bb.x + sz * (f + 0.5), bb.y + sz * (7 - r + 0.5)]; };
      const t0 = Date.now(); await page.mouse.click(...at(it.wrong.slice(0, 2))); await page.mouse.click(...at(it.wrong.slice(2, 4)));
      await page.waitForSelector('.lesson-board .mistake-sheet', { timeout: 15000 }); firsts.push(Date.now() - t0);
      await page.waitForFunction(() => document.querySelector('.lesson-board .mistake-sheet')?.getAttribute('data-source') !== 'symbolic', null, { timeout: 30000 }); finals.push(Date.now() - t0);
    } catch (e) { console.log('  ⚠ CA1.6', it.id, it.step, String(e.message).split('\n')[0]); }
  }
  await b.close();
  const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor((x.length - 1) / 2)] : null; };
  const res = { device: 'iPhone 14 Pro émulé (Chromium) · CPU ÷4', n: firsts.length, firstSentenceMs: { median: med(firsts), max: Math.max(...firsts) }, finalDiagnosisMs: { median: med(finals), max: Math.max(...finals) }, webkitUnthrottled: timings };
  console.log('▶ CA1.6', JSON.stringify(res)); fs.writeFileSync('tools/data/ca16-latency.json', JSON.stringify(res, null, 1) + '\n');
}
srv.kill();
// WebKit + COOP/COEP locaux : le worker multi-thread est refusé puis le moteur repart en mono-thread (repli voulu, absent en production sans COEP).
const real = errors.filter((e) => !/favicon|Failed to load resource.*(404)/.test(e) && !/^\[iphone\].*(Cross-Origin-Embedder-Policy|(stockfish-18-lite\.js|packs\/\w+\/b\d+\.gz).*access control checks)/.test(e)); // WebKit : téléchargement annulé par page.goto
console.log(`\nErreurs console : ${real.length}`); real.slice(0, 40).forEach((e) => console.log(' - ' + e));
console.log(`Échecs de vérification : ${failures}`);
process.exit(real.length || failures ? 1 : 0);
