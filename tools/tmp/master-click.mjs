// Reproduit le « clic non pris » sur les cartes coup du maître : N cartes maître, clic 1,3 s après l'apparition.
import { webkit, devices } from 'playwright'; import fs from 'node:fs';
const U = process.argv[2] || 'http://localhost:4173/'; const N = +(process.argv[3] || 12); const WAIT = +(process.argv[4] || 1300);
const MASTERS = JSON.parse(fs.readFileSync('src/data/feed-master.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 14 Pro'] }); const p = await ctx.newPage();
await p.goto(U); await sleep(500);
const reset = () => p.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboarded = true; s.puzzle ||= {}; s.puzzle.games = 50; s.puzzle.rating = 1500; s.feed = { date: 'x', served: [], kinds: { puzzle: { n: 40, ok: 0, fail: 0, skip: 40, ab: 0, ms: 0 }, mate1: { n: 40, ok: 0, fail: 0, skip: 40, ab: 0, ms: 0 }, lesson: { n: 40, ok: 0, fail: 0, skip: 40, ab: 0, ms: 0 }, mistake: { n: 40, ok: 0, fail: 0, skip: 40, ab: 0, ms: 0 } } }; localStorage.setItem(k, JSON.stringify(s)); });
await reset(); await p.reload();
let ok = 0, ko = 0, tries = 0;
while (ok + ko < N && tries < 200) {
  tries++;
  const sel = await Promise.race([p.waitForSelector('.feed-card:not(.skeleton):not(.leaving)', { timeout: 20000 }).then(() => 'c'), p.waitForSelector('.feed-end', { timeout: 20000 }).then(() => 'e')]);
  if (sel === 'e') { await reset(); await p.reload(); continue; }
  const kind = await p.locator('.feed-card').getAttribute('data-kind'); const ref = await p.locator('.feed-card').getAttribute('data-ref');
  if (kind !== 'master') { await sleep(300); await p.click('.fc-skip').catch(() => {}); await sleep(450); continue; }
  await sleep(WAIT);
  const x = MASTERS.find((y) => y.f === ref); const orient = x.f.split(' ')[1] === 'w' ? 'white' : 'black';
  const bb = await p.locator('.feed-card cg-board').first().boundingBox(); const s = bb.width / 8;
  for (const sq of [x.m.slice(0, 2), x.m.slice(2, 4)]) { let f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; if (orient === 'black') { f = 7 - f; r = 7 - r; } await p.mouse.click(bb.x + s * (f + 0.5), bb.y + s * (7 - r + 0.5)); await sleep(160); }
  const got = await p.waitForSelector('.feed-card.revealed', { timeout: 2500 }).then(() => true).catch(() => false);
  got ? ok++ : ko++;
  if (!got) { await p.click('.fc-skip').catch(() => {}); }
  else await p.click('.fc-next').catch(() => {});
  await sleep(400);
}
console.log(`coups du maître : ${ok} pris, ${ko} non pris (clic ${WAIT} ms après l'apparition)`);
await b.close();
