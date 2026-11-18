// Captures de tous les écrans (audit UX) : node tools/shots.mjs <dossier> [iphone,se,desktop]
import { chromium, webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'screenshots/audit'; const ONLY = (process.argv[3] || 'iphone,se,desktop').split(',');
const ROUTES = (process.env.ROUTES || '').split(',').filter(Boolean);
const PORT = 4174, U = process.env.URL || `http://localhost:${PORT}/`;
mkdirSync(OUT, { recursive: true });
const srv = process.env.URL ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
if (srv) await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = [
  ['01-accueil', ''], ['02-apprendre', 'learn'], ['03-cours', 'learn/course/tactique'], ['04-lecon', 'lesson/d-pion'],
  ['05-puzzles', 'puzzles'], ['06-puzzle', 'puzzles/rated'], ['07-rush', 'puzzles/rush'], ['08-duel', 'puzzles/battle'], ['09-parcours', 'puzzles/paths'], ['10-sur-mesure', 'puzzles/custom'],
  ['11-revisions', 'review'], ['12-jouer', 'play'], ['13-partie', 'play/leo'], ['14-analyse', 'analysis'], ['15-ouvertures', 'openings'], ['16-ouverture', 'openings/italienne'],
  ['17-entrainement-ouv', 'openings/italienne/0'], ['18-finales', 'endgames'], ['19-finale', 'endgames/kbn-k'], ['20-entrainement', 'train'], ['21-coords', 'train/coords'],
  ['22-devine', 'train/guess'], ['23-profil', 'profile'], ['24-reglages', 'settings'], ['25-premium', 'premium'], ['26-plus', 'more'], ['27-confidentialite', 'privacy'],
].filter(([n]) => !ROUTES.length || ROUTES.some((r) => n.startsWith(r)));
const DEV = { iphone: [webkit, devices['iPhone 14 Pro']], se: [webkit, devices['iPhone SE']], desktop: [chromium, { viewport: { width: 1366, height: 860 } }] };
for (const d of ONLY) {
  const [bt, opts] = DEV[d]; const b = await bt.launch(); const ctx = await b.newContext({ ...opts, colorScheme: process.env.LIGHT ? 'light' : 'dark' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(U); await sleep(1200);
  if (!ROUTES.length || ROUTES.includes('00')) await p.screenshot({ path: `${OUT}/${d}-00-onboarding.png` });
  await p.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k) || 'null'); if (s) { s.onboarded = true; s.settings.name = 'Camille'; localStorage.setItem(k, JSON.stringify(s)); } });
  await p.reload(); await sleep(800);
  await p.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboarded = true; s.settings ||= {}; s.settings.name = 'Camille'; localStorage.setItem(k, JSON.stringify(s)); });
  for (const [n, r] of R) {
    await p.goto(U + '#/' + r); await p.reload(); await sleep(r.includes('/') && !r.startsWith('learn') ? 2200 : 1200);
    await p.screenshot({ path: `${OUT}/${d}-${n}.png` });
    if (process.env.FULL) await p.screenshot({ path: `${OUT}/${d}-${n}-full.png`, fullPage: true });
  }
  console.log(d, 'erreurs', errs.length, errs.slice(0, 3)); await b.close();
}
srv?.kill();
