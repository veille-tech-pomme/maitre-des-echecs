import { chromium, devices } from 'playwright'; import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 14 Pro'], defaultBrowserType: undefined }); const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto('http://localhost:4174/'); await p.evaluate(() => { localStorage.setItem('echecs-app-v1', JSON.stringify({ onboarded: true })); });
await p.goto('http://localhost:4174/#/analysis'); await p.waitForSelector('cg-board'); await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => { window.f = []; let last = performance.now(); const loop = (t) => { window.f.push(t - last); last = t; if (window.f.length < 400) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
const box = await p.locator('cg-board').boundingBox(); const s = box.width / 8;
const sq = (f, r) => [box.x + s * (f + .5), box.y + s * (7 - r + .5)];
for (const [a, c] of [[[4, 1], [4, 3]], [[4, 6], [4, 4]], [[6, 0], [5, 2]], [[1, 7], [2, 5]], [[5, 0], [2, 3]], [[6, 7], [5, 5]]]) {
  await p.mouse.move(...sq(...a)); await p.mouse.down(); for (let k = 1; k <= 15; k++) { const [x0, y0] = sq(...a), [x1, y1] = sq(...c); await p.mouse.move(x0 + (x1 - x0) * k / 15, y0 + (y1 - y0) * k / 15); } await p.mouse.up(); await new Promise((r) => setTimeout(r, 400)); }
await new Promise((r) => setTimeout(r, 1500));
const f = await p.evaluate(() => window.f.slice(5)); f.sort((a, b) => a - b);
const avg = f.reduce((a, b) => a + b, 0) / f.length;
console.log(JSON.stringify({ frames: f.length, fps: Math.round(1000 / avg), p95ms: Math.round(f[Math.floor(f.length * .95)]), over33: f.filter((x) => x > 33.4).length }));
await b.close(); srv.kill(); spawn('pkill', ['-f', 'vite preview --port 4174']); process.exit(0);
