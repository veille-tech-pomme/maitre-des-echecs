// Explorateur de parties de maîtres : agrège tools/data/elite.jsonl (Lichess Broadcast, CC0, Elo FIDE ≥ 2200 des deux côtés)
// en statistiques par position (transpositions fusionnées) jusqu'à DEPTH demi-coups, pour les positions jouées ≥ MIN_N fois.
// Sortie : public/explorer/p/NNN.gz (512 fragments de positions), public/explorer/g/NNN.gz (parties notables),
// src/data/explorer-meta.json (petit résumé). Usage : node tools/build-explorer.mts
import fs from 'node:fs'; import zlib from 'node:zlib'; import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Chess } from 'chess.js';
import { posKey, hashKey, EXPLORER_SHARDS } from '../src/lib/explorer-key.ts';

const DEPTH = +(process.env.DEPTH || 30), MIN_N = +(process.env.MIN_N || 5), TOPG = 6, MAXMOVES = 14, GAMES_MIN_N = +(process.env.GAMES_MIN_N || 25);

if (!isMainThread) {
  const { moves } = workerData as { moves: string[] };
  const offs = new Uint32Array(moves.length + 1); const hs: number[] = [];
  moves.forEach((m, i) => {
    const c = new Chess(); const ms = m.split(' ');
    for (let p = 0; p < Math.min(DEPTH, ms.length); p++) {
      const [a, b] = hashKey(posKey(c.fen())); hs.push(a, b);
      try { c.move(ms[p]); } catch { hs.length -= 2; break; }
    }
    offs[i + 1] = hs.length / 2;
  });
  const h = Uint32Array.from(hs);
  parentPort!.postMessage({ offs, h }, [offs.buffer, h.buffer]);
} else {
  const t0 = Date.now();
  const games = fs.readFileSync('tools/data/elite.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  console.log('parties', games.length);
  const W = Math.max(1, os.cpus().length); const per = Math.ceil(games.length / W);
  const parts = await Promise.all(Array.from({ length: W }, (_, k) => new Promise<{ offs: Uint32Array; h: Uint32Array }>((res, rej) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { moves: games.slice(k * per, (k + 1) * per).map((g) => g.m) } });
    w.once('message', res); w.once('error', rej);
  })));
  console.log('rejoué en', ((Date.now() - t0) / 1000).toFixed(0), 's');
  // Comptage exact des positions (clé 64 bits)
  let total = 0; for (const p of parts) total += p.h.length / 2;
  const all = new BigUint64Array(total); let q = 0;
  for (const p of parts) for (let i = 0; i < p.h.length; i += 2) all[q++] = (BigInt(p.h[i]) << 32n) | BigInt(p.h[i + 1]);
  all.sort();
  const keep = new Set<bigint>();
  for (let i = 0; i < all.length;) { let j = i; while (j < all.length && all[j] === all[i]) j++; if (j - i >= MIN_N) keep.add(all[i]); i = j; }
  console.log('occurrences', total, 'positions retenues', keep.size);
  type Mv = { n: number; w: number; d: number; r: number };
  type Agg = { a: number; b: number; ply: number; n: number; w: number; d: number; r: number; mv: Map<string, Mv>; g: number[] };
  const agg = new Map<bigint, Agg>();
  const avg = (g: any) => (g.we + g.be) / 2;
  const better = (x: number, y: number) => avg(games[x]) - avg(games[y]) || (games[x].y < games[y].y ? -1 : 1);
  let gi = 0;
  for (const p of parts) {
    for (let i = 0; i + 1 < p.offs.length; i++, gi++) {
      const g = games[gi]; const ms = g.m.split(' '); const ra = avg(g); const vis = new Set<bigint>();
      for (let k = p.offs[i], ply = 0; k < p.offs[i + 1]; k++, ply++) {
        const a = p.h[2 * k], b = p.h[2 * k + 1]; const key = (BigInt(a) << 32n) | BigInt(b);
        if (!keep.has(key) || vis.has(key)) continue; vis.add(key);
        let e = agg.get(key); if (!e) agg.set(key, (e = { a, b, ply, n: 0, w: 0, d: 0, r: 0, mv: new Map(), g: [] }));
        e.ply = Math.min(e.ply, ply); e.n++; if (g.r === 1) e.w++; else if (g.r === 0.5) e.d++; e.r += ra;
        const san = ms[ply]; let m = e.mv.get(san); if (!m) e.mv.set(san, (m = { n: 0, w: 0, d: 0, r: 0 }));
        m.n++; if (g.r === 1) m.w++; else if (g.r === 0.5) m.d++; m.r += ra;
        // parties notables : meilleures moyennes Elo (les plus récentes à égalité)
        if (e.g.length < TOPG || better(gi, e.g[e.g.length - 1]) > 0) { e.g.push(gi); e.g.sort((x, y) => better(y, x)); if (e.g.length > TOPG) e.g.pop(); }
      }
    }
  }
  // Renumérotation des parties notables
  const used = new Map<number, number>(); const gl: number[] = [];
  for (const e of agg.values()) if (e.n < GAMES_MIN_N) e.g = []; else for (const x of e.g) if (!used.has(x)) { used.set(x, gl.length); gl.push(x); }
  const GSH = Math.max(1, Math.ceil(gl.length / 100));
  // Fragments de positions
  const shards: string[][] = Array.from({ length: EXPLORER_SHARDS }, () => []);
  let maxPly = 0;
  for (const e of agg.values()) {
    maxPly = Math.max(maxPly, e.ply);
    const mv = [...e.mv.entries()].sort((x, y) => y[1].n - x[1].n).filter(([, m], i) => i < 3 || m.n >= 2).slice(0, MAXMOVES)
      .map(([s, m]) => `${s}:${m.n.toString(36)}:${m.w.toString(36)}:${m.d.toString(36)}:${Math.round(m.r / m.n).toString(36)}`).join(',');
    shards[e.a % EXPLORER_SHARDS].push([e.a.toString(36) + '.' + e.b.toString(36), e.n.toString(36), e.w.toString(36), e.d.toString(36), Math.round(e.r / e.n).toString(36), mv, e.g.map((x) => used.get(x)!.toString(36)).join('.')].join('|'));
  }
  const out = 'public/explorer'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out + '/p', { recursive: true }); fs.mkdirSync(out + '/g', { recursive: true });
  let psize = 0, gsize = 0, pmax = 0;
  shards.forEach((s, i) => { const z = zlib.gzipSync(s.join('\n'), { level: 9 }); psize += z.length; pmax = Math.max(pmax, z.length); fs.writeFileSync(`${out}/p/${i}.gz`, z); });
  const gsh: string[][] = Array.from({ length: GSH }, () => []);
  const clean = (s: string) => String(s || '').replace(/[|\n]/g, ' ').trim();
  gl.forEach((x, id) => { const g = games[x]; gsh[id % GSH].push([id.toString(36), clean(g.w), clean(g.b), g.we, g.be, g.r === 1 ? '1' : g.r === 0 ? '0' : '½', clean(g.y), clean(g.e).slice(0, 80), clean(g.u).replace('https://lichess.org/broadcast/', ''), g.m.split(' ').slice(0, 300).join(' ')].join('|')); });
  gsh.forEach((s, i) => { const z = zlib.gzipSync(s.join('\n'), { level: 9 }); gsize += z.length; fs.writeFileSync(`${out}/g/${i}.gz`, z); });
  const years = games.map((g) => g.y).filter((y) => /^\d{4}/.test(y)).sort();
  const meta = { version: Date.now() % 1e9, games: games.length, positions: agg.size, depth: DEPTH, maxPly, minN: MIN_N, minElo: 2200, notable: gl.length, shards: EXPLORER_SHARDS, gameShards: GSH,
    sizePositions: psize, sizeGames: gsize, maxShard: pmax, from: years[Math.floor(years.length * 0.001)]?.slice(0, 7), to: years[years.length - 1]?.slice(0, 7), source: 'Lichess Broadcast database (CC0)' };
  fs.writeFileSync('src/data/explorer-meta.json', JSON.stringify(meta, null, 1));
  console.log(meta, ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
