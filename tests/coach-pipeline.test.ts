// Pipeline du coach de bout en bout avec Stockfish (natif si dispo) : classement, explications, moments, leçons.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from '../tools/uci.mjs';
import { buildReview } from '../src/coach/pipeline';
import { isBookFen } from '../src/data/openings';
import { hintsFor, nullMoveFen } from '../src/coach/hints';
import { explainMove } from '../src/coach/explain';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); });
afterAll(() => e?.quit());
async function linesFor(fens: string[], depth = 12) {
  const out: any[] = [];
  for (const f of fens) { const c = new Chess(f); if (c.isGameOver()) { out.push([]); continue; } out.push((await e.analyse(f, { depth, multipv: 3 })).lines); }
  return out;
}
async function review(sans: string[], user: 'w' | 'b', elo = 1200) {
  const ch = new Chess(); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const s of sans) { const m = ch.move(s); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  return buildReview({ startFen: START, moves: ucis, lines: await linesFor(fens), elo, user, oppElo: elo, book: isBookFen, gameId: 't' });
}

describe('pipeline du coach', () => {
  it('piège Blackburne-Shilling : gaffes blanches, mat permis, leçons et exercices', async () => {
    const r = await review(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'], 'w');
    expect(r.moves).toHaveLength(14);
    expect(r.accuracy.w).toBeLessThan(r.accuracy.b);
    const nxf7 = r.moves[8]; expect(['mistake', 'blunder']).toContain(nxf7.cls);
    expect(nxf7.ex?.headline).toBeTruthy();
    expect(r.moves[13].cls).not.toBe('blunder');
    expect(r.critical.length).toBeGreaterThan(0);
    expect(r.lessons.length).toBeGreaterThan(0); expect(r.lessons.length).toBeLessThanOrEqual(3);
    expect(r.events.some((x) => x.skill === 'vigilance' || x.skill === 'kingSafety')).toBe(true);
    expect(r.summary).toMatch(/précision/);
    for (const m of r.moves.filter((m) => m.color === 'w')) expect(m.ex).toBeTruthy();
    expect(r.moves.filter((m) => m.color === 'b').every((m) => m.ex === null)).toBe(true);
  }, 120000);
  it('mat du berger côté noir : le coup qui permet le mat est expliqué', async () => {
    const r = await review(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'], 'b');
    const nf6 = r.moves[5]; expect(nf6.cls).toBe('blunder');
    expect(nf6.ex!.headline).toMatch(/mat/); expect(nf6.ex!.why).toMatch(/Dxf7#/);
    expect(nf6.ex!.tags[0]).toMatch(/^allowedMate/);
    expect(r.retries.some((x) => x.ply === 5)).toBe(true);
    expect(r.events.some((x) => x.skill === 'kingSafety' && x.s === 0)).toBe(true);
  }, 60000);
  it('les explications ne disent jamais « (e) » et accordent en genre', async () => {
    const r = await review(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'], 'b');
    for (const m of r.moves) if (m.ex) { expect(m.ex.why).not.toMatch(/\(e\)/); expect(m.ex.headline).not.toMatch(/\(e\)|de le /); }
  }, 120000);
  it('indices : menaces, idée, coup', async () => {
    // Les blancs ont une dame attaquée en h5 par … (position simple) ; mat du berger à parer
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    const lines = (await e.analyse(fen, { depth: 12, multipv: 2 })).lines;
    const t = (await e.analyse(nullMoveFen(fen)!, { depth: 10, multipv: 1 })).lines[0];
    const h = hintsFor(fen, lines, t);
    expect(h.map((x) => x.level)).toEqual([1, 2, 3]);
    expect(h[0].text).toMatch(/mater/);
  }, 60000);
  it('coup gagnant trouvé : fourchette reconnue', async () => {
    // cavalier en c7 : fourchette roi e8 / tour a8
    const f2 = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
    const L = (await e.analyse(f2, { depth: 12, multipv: 2 })).lines;
    const ch = new Chess(f2); ch.move('Nc7+'); const rep = (await e.analyse(ch.fen(), { depth: 12, multipv: 1 })).lines[0];
    const ex = explainMove({ fenBefore: f2, uci: 'b5c7', cls: 'best', dE: 0, eBefore: 0.9, ePlayed: 0.9, eBest: 0.9, lines: L, reply: rep, elo: 1200, ply: 40, history: [], mine: true });
    expect(ex.headline).toMatch(/Fourchette/); expect(ex.tags[0]).toBe('found:fork:n');
  }, 60000);
});
