// e2e CA1.1 (cahier GOAT, pilier 1) : pour CHAQUE exercice à coups des leçons et des cours, joue un coup faux dans
// l'appli réelle (build de prod) et vérifie que la fiche « Pourquoi » affiche une phrase précise (jamais « Réessaie »
// seul), puis mesure le temps jusqu'à la première phrase et jusqu'au diagnostic final.
// Usage : node tools/e2e-wrong-moves.mjs [--jobs=4] [--browser=chromium|webkit]   (E2E_URL pour viser le site en ligne)
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
const ITEMS = JSON.parse(fs.readFileSync('tools/data/e2e-wrong-moves.json', 'utf8'));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const JOBS = +arg('jobs', 4), BROWSER = arg('browser', 'chromium');
const PORT = 4174, URL0 = process.env.E2E_URL || `http://localhost:${PORT}/`;
const srv = process.env.E2E_URL ? { kill() {} } : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
if (!process.env.E2E_URL) await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GENERIC = /^(réessaie|essaie encore|pas tout à fait|non|raté|mauvais coup|faux|le coach regarde ton coup…?)\.?!?$/i;
const ids = [...new Set(ITEMS.map((x) => x.id))];
// état de départ : accueil fait, toutes les leçons ouvertes ; Premium de test (fournisseur « dev », jamais en production native)
const init = `localStorage.setItem('echecs-app-v1', JSON.stringify({ xp: 0, onboarded: true, lessons: Object.fromEntries(${JSON.stringify(ids)}.map((i) => [i, { done: true, stars: 3, step: 0 }]).concat([['unlock-intermediaire', { done: false, stars: 0, step: 0 }], ['unlock-avance', { done: false, stars: 0, step: 0 }]])) }));
localStorage.setItem('echecs-dev-premium', JSON.stringify({ premium: true, source: 'dev', plan: 'lifetime' }));`;
async function clickSq(page, sq, orient) {
  const b = await page.locator('.lesson-board cg-board').first().boundingBox(); const s = b.width / 8;
  let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; }
  await page.mouse.click(b.x + s * (f + 0.5), b.y + s * (7 - r + 0.5)); await sleep(60);
}
const browserType = BROWSER === 'webkit' ? webkit : chromium;
const browser = await browserType.launch();
const results = []; let next = 0; const t0 = Date.now();
async function worker(w) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(init); const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL0 + '#/learn'); await sleep(500);
  while (next < ITEMS.length) {
    const it = ITEMS[next++]; const r = { id: it.id, step: it.step, kind: it.kind, wrong: it.wrong, ok: false };
    try {
      await page.goto(`${URL0}#/lesson/${it.id}?step=${it.step}&t=${next}`); await page.waitForSelector('.lesson-board cg-board', { timeout: 15000 });
      await page.waitForFunction(() => /À toi|jouent/.test(document.querySelector('.lesson-board .feedback')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
      await sleep(250);
      const tc = Date.now(); await clickSq(page, it.wrong.slice(0, 2), it.orient); await clickSq(page, it.wrong.slice(2, 4), it.orient);
      await page.waitForSelector('.lesson-board .mistake-sheet', { timeout: 10000 }); r.firstMs = Date.now() - tc;
      r.first = (await page.locator('.lesson-board .mistake-sheet .ms-head').innerText()).trim();
      await page.waitForFunction(() => document.querySelector('.lesson-board .mistake-sheet')?.getAttribute('data-source') !== 'symbolic', null, { timeout: 20000 }).catch(() => {});
      r.finalMs = Date.now() - tc; const sh = page.locator('.lesson-board .mistake-sheet');
      r.source = await sh.getAttribute('data-source'); r.mk = await sh.getAttribute('data-kind'); r.headline = (await sh.locator('.ms-head').innerText()).trim();
      r.why = (await sh.locator('p').first().innerText().catch(() => '')).trim();
      r.ok = !GENERIC.test(r.headline) && r.headline.length >= 10 && r.source !== 'symbolic';
      if (!r.ok) r.err = 'générique : ' + r.headline;
    } catch (e) { r.err = String(e.message).split('\n')[0]; await page.screenshot({ path: `screenshots/goat1/ERR-wrong-${it.id}-${it.step}.png` }).catch(() => {}); }
    results.push(r); if (results.length % 25 === 0) console.log(`  ${results.length}/${ITEMS.length} · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  if (errs.length) console.log(`  [w${w}] erreurs page :`, errs.slice(0, 3));
  await ctx.close();
}
fs.mkdirSync('screenshots/goat1', { recursive: true });
await Promise.all(Array.from({ length: JOBS }, (_, w) => worker(w)));
await browser.close(); srv.kill();
const ok = results.filter((r) => r.ok); const bad = results.filter((r) => !r.ok);
const q = (a, x) => { const s = a.filter((v) => v != null).sort((p, n) => p - n); return s.length ? s[Math.floor(x * (s.length - 1))] : null; };
const bySrc = results.reduce((a, r) => ((a[r.source || 'none'] = (a[r.source || 'none'] || 0) + 1), a), {});
const byKind = results.reduce((a, r) => ((a[r.mk || '—'] = (a[r.mk || '—'] || 0) + 1), a), {});
const summary = { browser: BROWSER, exercises: results.length, ok: ok.length, failed: bad.length, firstSentenceMs: { median: q(results.map((r) => r.firstMs), 0.5), p95: q(results.map((r) => r.firstMs), 0.95) }, finalMs: { median: q(results.map((r) => r.finalMs), 0.5), p95: q(results.map((r) => r.finalMs), 0.95) }, bySource: bySrc, byKind, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(`tools/data/e2e-wrong-moves.result.${BROWSER}.json`, JSON.stringify({ summary, failures: bad, sample: ok.slice(0, 40).map((r) => ({ id: r.id, step: r.step, wrong: r.wrong, headline: r.headline, why: r.why })) }, null, 1) + '\n');
console.log(JSON.stringify(summary, null, 1));
for (const r of bad.slice(0, 15)) console.log('  ✗', r.id, r.step, r.wrong, r.err);
process.exit(bad.length ? 1 : 0);
