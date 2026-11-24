// Audit Magnus (P2) : corpus de pièges classiques en non-régression des explications du bilan.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { buildReview } from '../src/coach/pipeline';
import { isBookFen } from '../src/data/openings';
import { TRAPS, trapExplanation } from '../src/coach/traps';
// @ts-ignore
import { Uci } from '../tools/uci.mjs';

let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); });
afterAll(() => e?.quit());
async function review(line: string, user: 'w' | 'b') {
  const ch = new Chess(); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const s of line.split(' ')) { const m = ch.move(s); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  const lines = []; for (const f of fens) lines.push(new Chess(f).isGameOver() ? [] : (await e.analyse(f, { depth: 12, multipv: 3 })).lines);
  return buildReview({ startFen: new Chess().fen(), moves: ucis, lines, elo: 1200, user, oppElo: 1200, book: isBookFen });
}
describe('Pièges classiques dans le bilan', () => {
  it('chaque coup de piège est reconnu (position + coup)', () => {
    for (const t of TRAPS) { const c = new Chess(); t.line.split(' ').forEach((s, i) => { const f = c.fen(); const m = c.move(s); const ex = trapExplanation(f, m.from + m.to + (m.promotion || '')); expect(!!ex, `${t.name} coup ${i} ${s}`).toBe(t.moves.some((x) => x.at === i)); }); }
  });
  it('piège de l’éléphant : 6.Cxd5 ?? expliqué par 6…Cxd5 7.Fxd8 Fb4+, pas par « cavalier non protégé »', async () => {
    const r = await review(TRAPS[0].line, 'w');
    const nx = r.moves[10]; expect(nx.cls).toMatch(/blunder|mistake/); expect(nx.ex!.headline).toMatch(/éléphant/); expect(nx.ex!.why).toMatch(/Fb4\+/); expect(nx.ex!.why).not.toMatch(/n’est pas protégé/);
    const bx = r.moves[12]; expect(bx.ex!.headline).not.toMatch(/Bien vu/); expect(bx.ex!.why).toMatch(/Fb4\+/);
  }, 120000);
  it('piège de Légal (côté Noirs) : 5…Fxd1 ?? expliqué par le mat Cd5#', async () => {
    const r = await review(TRAPS[1].line, 'b');
    const bx = r.moves[9]; expect(bx.cls).toMatch(/blunder/); expect(bx.ex!.why).toMatch(/Cd5#/);
  }, 120000);
  it('arche de Noé : 8.Dxd4 ? expliqué par …c5 et …c4 (fou b3 enfermé)', async () => {
    const r = await review(TRAPS[2].line, 'w');
    const q = r.moves[14]; expect(q.ex!.headline).toMatch(/arche de Noé/); expect(q.ex!.why).toMatch(/c4/);
  }, 120000);
});
