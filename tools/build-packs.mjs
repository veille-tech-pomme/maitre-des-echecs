// Construit les packs de puzzles compressés (gzip) par tranche de 100 points Elo + l'index.
// Entrées : tools/data/core_valid.jsonl, tools/data/extra_valid.jsonl  →  public/packs/{core,plus}/bNN.gz, src/data/packs-index.json
import fs from 'node:fs'; import zlib from 'node:zlib';
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const tiers = { core: read('tools/data/core_valid.jsonl'), plus: read('tools/data/extra_valid.jsonl') };
const themes = [...new Set(Object.values(tiers).flat().flatMap((p) => p.t))].sort();
const openings = [...new Set(Object.values(tiers).flat().map((p) => p.o).filter(Boolean))].sort();
const TI = new Map(themes.map((t, i) => [t, i])), OI = new Map(openings.map((o, i) => [o, i + 1]));
const index = { version: 1, themes, openings, tiers: {} };
let bytes = {};
for (const [tier, list] of Object.entries(tiers)) {
  if (!list.length) continue;
  fs.mkdirSync(`public/packs/${tier}`, { recursive: true });
  const byBand = {};
  for (const p of list) (byBand[Math.max(4, Math.min(29, Math.floor(p.r / 100)))] ||= []).push(p);
  index.tiers[tier] = { count: list.length, bands: {} };
  bytes[tier] = 0;
  for (const [b, L] of Object.entries(byBand)) {
    L.sort((a, b) => a.r - b.r);
    const txt = L.map((p) => [p.i, p.f.split(' ').slice(0, 4).join(' '), p.m, p.r, p.t.map((t) => TI.get(t).toString(36)).join('.'), (OI.get(p.o) || 0).toString(36)].join('|')).join('\n');
    const gz = zlib.gzipSync(txt, { level: 9 });
    fs.writeFileSync(`public/packs/${tier}/b${b}.gz`, gz); bytes[tier] += gz.length;
    const tc = {}; for (const p of L) for (const t of p.t) tc[TI.get(t)] = (tc[TI.get(t)] || 0) + 1;
    const oc = {}; for (const p of L) if (p.o) oc[OI.get(p.o)] = (oc[OI.get(p.o)] || 0) + 1;
    index.tiers[tier].bands[b] = { n: L.length, size: gz.length, t: tc, o: oc };
  }
}
fs.writeFileSync('src/data/packs-index.json', JSON.stringify(index));
console.log(Object.fromEntries(Object.entries(index.tiers).map(([k, v]) => [k, v.count])), 'themes', themes.length, 'openings', openings.length, 'gz bytes', bytes);
