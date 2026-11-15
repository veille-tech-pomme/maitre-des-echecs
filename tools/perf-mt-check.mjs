import { chromium } from 'playwright'; import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
const reqs = []; p.on('request', (r) => { if (r.url().includes('engine/')) reqs.push(r.url().split('/').pop()); });
await p.goto('http://localhost:4174/#/analysis'); await p.waitForSelector('cg-board'); await new Promise((r) => setTimeout(r, 6000));
console.log(JSON.stringify(await p.evaluate(() => ({ coi: crossOriginIsolated, sab: typeof SharedArrayBuffer, hc: navigator.hardwareConcurrency }))), reqs);
const t = await p.evaluate(async () => { const m = await import('/src/lib/engine.ts').catch(() => null); return !!m; }).catch(() => 'n/a');
await b.close(); srv.kill(); spawn('pkill',['-f','vite preview --port 4174']); process.exit(0);
