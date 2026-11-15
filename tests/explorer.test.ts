// Base de maîtres : cohérence des statistiques, des fragments et des parties notables.
// @ts-nocheck — test Node (fs)
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { Chess } from 'chess.js';
import meta from '../src/data/explorer-meta.json';
import { setFetcher, positionStats, masterGame, parseEntry, gunzipText } from '../src/lib/explorer';
import { posId, posKey, hashKey, EXPLORER_SHARDS } from '../src/lib/explorer-key';

const fenAfter = (sans: string) => { const c = new Chess(); for (const s of sans.split(' ').filter(Boolean)) c.move(s); return c.fen(); };
beforeAll(() => setFetcher(async (p) => { const b = fs.readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); }));

describe('Base de maîtres', () => {
  it('volumes et tailles (chargement par petits fragments)', () => {
    expect(meta.games).toBeGreaterThan(200000);
    expect(meta.positions).toBeGreaterThan(100000);
    expect(meta.shards).toBe(EXPLORER_SHARDS);
    expect(meta.maxShard).toBeLessThan(16 * 1024);
    expect(fs.readdirSync('public/explorer/p').length).toBe(EXPLORER_SHARDS);
    expect(fs.readdirSync('public/explorer/g').length).toBe(meta.gameShards);
  });
  it('clé de position : 4 champs FEN, hachage stable', () => {
    expect(posKey('8/8/8/8/8/8/8/K6k w - - 12 40')).toBe('8/8/8/8/8/8/8/K6k w - -');
    expect(hashKey('abc')).toEqual(hashKey('abc'));
    expect(posId(new Chess().fen()).id).toBe(posId('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 3 9').id);
  });
  it('gunzip accepte aussi un contenu déjà décompressé', async () => {
    expect(await gunzipText(new TextEncoder().encode('a|b').buffer)).toBe('a|b');
  });
  it('position initiale : toutes les parties, 1.e4 et 1.d4 en tête', async () => {
    const s = await positionStats(new Chess().fen());
    expect(s.n).toBe(meta.games);
    expect(s.w + s.d + s.b).toBe(s.n);
    expect(s.elo).toBeGreaterThanOrEqual(2200);
    const top = s.moves.slice(0, 2).map((m) => m.san).sort();
    expect(top).toEqual(['d4', 'e4']);
    expect(s.moves.reduce((a, m) => a + m.n, 0)).toBeLessThanOrEqual(s.n);
    for (let i = 1; i < s.moves.length; i++) expect(s.moves[i].n).toBeLessThanOrEqual(s.moves[i - 1].n);
  });
  it('les stats d’un coup = celles de la position atteinte (sans transposition possible)', async () => {
    const s0 = await positionStats(new Chess().fen()); const e4 = s0.moves.find((m) => m.san === 'e4');
    const s1 = await positionStats(fenAfter('e4'));
    expect(s1.n).toBe(e4.n); expect(s1.w).toBe(e4.w); expect(s1.d).toBe(e4.d);
    expect(s1.moves[0].san).toBe('c5'); // la Sicilienne, réponse n°1 des maîtres
  });
  it('transpositions fusionnées (1.d4 Nf6 2.c4 e6 = 1.c4 e6 2.d4 Nf6)', async () => {
    const a = await positionStats(fenAfter('d4 Nf6 c4 e6')); const b = await positionStats(fenAfter('c4 e6 d4 Nf6'));
    expect(a).toEqual(b); expect(a.n).toBeGreaterThan(1000);
  });
  it('position absente → null ; lignes de théorie profondes présentes', async () => {
    expect(await positionStats(fenAfter('a4 h5 Ra3 Rh6 Rb3 Rg6'))).toBeNull();
    const najdorf = await positionStats(fenAfter('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'));
    expect(najdorf.n).toBeGreaterThan(300);
  });
  it('parties notables : chargeables et passant bien par la position', async () => {
    const fen = fenAfter('e4 e5 Nf3 Nc6 Bb5'); const s = await positionStats(fen);
    expect(s.games.length).toBeGreaterThanOrEqual(3);
    const key = posKey(fen);
    for (const id of s.games) {
      const g = await masterGame(id); expect(g).toBeTruthy();
      expect(Math.min(g.we, g.be)).toBeGreaterThanOrEqual(2200); expect(Math.max(g.we, g.be)).toBeLessThanOrEqual(2900);
      const c = new Chess(); let hit = false;
      for (const san of g.moves.slice(0, 40)) { if (posKey(c.fen()) === key) { hit = true; break; } c.move(san); }
      expect(hit).toBe(true);
    }
  });
  it('parseEntry décode le format compact', () => {
    const e = parseEntry('a|5|2|1g|e4:6:3:2:1in,d4:4:1:1:1io|0.1');
    expect(e).toMatchObject({ n: 10, w: 5, d: 2, b: 3, elo: 52, games: [0, 1] });
    expect(e.moves[0]).toMatchObject({ san: 'e4', n: 6, w: 3, d: 2, b: 1 });
  });
});
