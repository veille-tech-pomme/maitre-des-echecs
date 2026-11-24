import fs from 'node:fs'; import { chromium } from 'playwright'; import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4180', '--strictPort'], { stdio: 'pipe' }); await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: process.env.SCHEME || 'light' });
await ctx.addInitScript(`if(!localStorage.getItem('echecs-app-v1'))localStorage.setItem('echecs-app-v1', JSON.stringify({ xp: 0, onboarded: true, lessons: {} }));`);
const p = await ctx.newPage(); const axe = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
for (const r of process.argv.slice(2)) { console.error('..', r);
  await p.goto('http://localhost:4180/' + r); await p.waitForTimeout(2500); await p.addScriptTag({ content: axe });
  const res = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({ id: v.id, n: v.nodes.length, ex: v.nodes.slice(0, 3).map((x) => x.html.slice(0, 140) + ' :: ' + (x.any[0]?.message || '').slice(0, 160)) })));
  console.log('##', r); for (const v of res) { console.log(v.id, v.n); v.ex.forEach((e) => console.log('   ', e)); }
}
await b.close(); srv.kill();
srv.kill(); process.exit(0);
