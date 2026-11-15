import { chromium } from 'playwright'; import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { srv.stdout.on('data', (d) => String(d).includes('localhost') && r()); setTimeout(r, 8000); });
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:4174/');
const run = (file, threads) => p.evaluate(([file, threads]) => new Promise((res) => {
  const w = new Worker('engine/' + file); let nps = 0, depth = 0;
  w.onmessage = (e) => { const l = String(e.data); const m = l.match(/depth (\d+).* nps (\d+)/); if (m) { depth = +m[1]; nps = +m[2]; }
    if (l === 'uciok') { w.postMessage(`setoption name Threads value ${threads}`); w.postMessage('setoption name Hash value 64'); w.postMessage('isready'); }
    if (l === 'readyok') { w.postMessage('position fen r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'); w.postMessage('go movetime 3000'); }
    if (l.startsWith('bestmove')) { w.terminate(); res({ file, threads, nps, depth }); } };
  w.postMessage('uci');
}), [file, threads]);
console.log(await run('stockfish-18-lite-single.js', 1)); console.log(await run('stockfish-18-lite.js', 4));
await b.close(); srv.kill(); spawn('pkill', ['-f', 'vite preview --port 4174']); process.exit(0);
