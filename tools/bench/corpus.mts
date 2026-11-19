// Corpus de benchmark : puzzles Lichess (CC0) étiquetés par thème, intégrés + échantillon des packs « cœur ».
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
export interface BP { i: string; f: string; m: string; r: number; t: string[] }
export function loadCorpus(maxPerBand = 400): BP[] {
  const base: BP[] = JSON.parse(fs.readFileSync('src/data/puzzles.json', 'utf8'));
  const idx = JSON.parse(fs.readFileSync('src/data/packs-index.json', 'utf8'));
  const out = [...base]; const dir = 'public/packs/core';
  for (const f of fs.readdirSync(dir).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    let n = 0;
    for (const line of txt.split('\n')) {
      if (!line) continue; if (n++ >= maxPerBand) break;
      const [i, fen, m, r, t] = line.split('|');
      out.push({ i, f: fen + ' 0 1', m, r: +r, t: t ? t.split('.').map((x: string) => idx.themes[parseInt(x, 36)]) : [] });
    }
  }
  return out;
}
