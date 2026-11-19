import { webkit, devices } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], colorScheme: 'dark' }); const p = await ctx.newPage();
await p.goto('http://localhost:4173/'); await p.evaluate(() => { const k = 'echecs-app-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.onboarded = true; localStorage.setItem(k, JSON.stringify(s)); }); await p.reload(); await sleep(500);
await p.goto('http://localhost:4173/#/play/odette'); await p.click('.color-opt >> text=Blancs'); await p.click('text=Commencer la partie'); await p.waitForSelector('cg-board'); await sleep(600);
const bb = async (sq) => { const r = await p.locator('cg-board').first().boundingBox(); const s = r.width / 8; await p.mouse.click(r.x + s * (sq.charCodeAt(0) - 97 + 0.5), r.y + s * (8 - +sq[1] + 0.5)); await sleep(150); };
for (const [a, c] of [['e2','e4'],['g1','f3'],['f1','c4'],['d2','d3']]) { await bb(a); await bb(c); await sleep(4500); }
p.once('dialog', (d) => d.accept()); await p.click('text=Abandonner'); await p.waitForSelector('.over .auto-next'); await p.click('.over .an-row .btn.secondary');
await p.waitForSelector('.review cg-board'); await sleep(400); await p.screenshot({ path: '/tmp/rv0.png' }); await p.screenshot({ path: '/tmp/rv0f.png', fullPage: true });
await p.waitForSelector('.coach-overlay:not(.pend)', { timeout: 60000 }); await sleep(300); await p.screenshot({ path: '/tmp/rv1.png' }); await p.screenshot({ path: '/tmp/rv1f.png', fullPage: true });
console.log(await p.evaluate(() => { const o = document.querySelector('.coach-overlay'); const r = o.getBoundingClientRect(); return [r.top, r.bottom, innerHeight, scrollY, o.textContent]; }));
await b.close();
