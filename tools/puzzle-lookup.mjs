// Tests : retrouve un puzzle (base intégrée + packs) par son identifiant → { f, m } (FEN avant le coup adverse, coups UCI).
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
let idx = null;
export function puzzleById(id) {
  if (!idx) {
    idx = new Map();
    for (const p of JSON.parse(fs.readFileSync('src/data/puzzles.json', 'utf8'))) idx.set(p.i, { f: p.f, m: p.m });
    for (const tier of ['core', 'plus']) {
      const dir = path.join('public/packs', tier); if (!fs.existsSync(dir)) continue;
      for (const fn of fs.readdirSync(dir)) {
        const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, fn))).toString('utf8');
        for (const line of txt.split('\n')) { const [i, f, m] = line.split('|'); if (i && f && m && !idx.has(i)) idx.set(i, { f: f.split(' ').length < 6 ? f + ' 0 1' : f, m }); }
      }
    }
  }
  return idx.get(id) || null;
}
