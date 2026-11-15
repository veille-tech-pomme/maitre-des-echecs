// Packs de puzzles : intégrité de l'index et légalité de chaque puzzle (tous ont été validés par Stockfish prof. 12 à la construction).
// @ts-nocheck — test Node (fs/zlib)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Chess } from 'chess.js';
import idx from '../src/data/packs-index.json';
const I = idx as any;
describe('Packs de puzzles', () => {
  it('volumes', () => { expect(I.tiers.core.count).toBeGreaterThanOrEqual(50000); expect(I.tiers.plus.count).toBeGreaterThanOrEqual(200000); });
  for (const tier of ['core', 'plus']) it(`${tier} : index cohérent et puzzles légaux`, () => {
    let total = 0; const ids = new Set<string>();
    for (const [b, B] of Object.entries<any>(I.tiers[tier].bands)) {
      const buf = fs.readFileSync(`public/packs/${tier}/b${b}.gz`); expect(buf.length).toBe(B.size);
      const lines = zlib.gunzipSync(buf).toString('utf8').split('\n').filter(Boolean); expect(lines.length).toBe(B.n);
      for (const line of lines) {
        const [id, f, m, r, t] = line.split('|'); expect(ids.has(id)).toBe(false); ids.add(id);
        expect(Math.max(4, Math.min(29, Math.floor(+r / 100)))).toBe(+b);
        const c = new Chess(f + ' 0 1'); for (const u of m.split(' ')) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as any });
        for (const x of t ? t.split('.') : []) expect(I.themes[parseInt(x, 36)]).toBeTruthy();
      }
      total += lines.length;
    }
    expect(total).toBe(I.tiers[tier].count);
  }, 600000);
});
