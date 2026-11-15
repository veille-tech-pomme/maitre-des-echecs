// Validation des exercices avec Stockfish (natif si disponible, sinon WASM) : les coups attendus doivent être bons.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
// @ts-ignore
import { Uci, score } from '../tools/uci.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); });
afterAll(() => e?.quit());
const uci = (ch: Chess, san: string) => { const m = new Chess(ch.fen()).move(san); return m.from + m.to + (m.promotion || ''); };
async function evalMove(fen: string, mv: string, depth = 16) {
  const all = await e.analyse(fen, { depth, multipv: 1 });
  const one = await e.analyse(fen, { depth, searchmoves: [mv] });
  return { best: all.lines[0], mine: one.lines[0] };
}
function ok(best: any, mine: any, margin: number) {
  if (!mine) return false;
  if (best.mate != null && best.mate > 0) return mine.mate != null && mine.mate > 0;
  return score(best) - score(mine) <= margin;
}
const problems: string[] = [];
describe('Validation moteur des exercices', () => {
  for (const l of LESSONS) l.steps.forEach((s, i) => {
    if (s.type !== 'exercise') return;
    const g = s.goal;
    if (!['any', 'line', 'play'].includes(g.kind) && !(g.kind === 'quiz' && g.verify)) return;
    it(`${l.id} #${i} (${g.kind})`, async () => {
      const ch = new Chess(s.fen || START); for (const m of s.pre || []) ch.move(m);
      if (g.kind === 'any') {
        for (const a of g.accept) {
          const c = new Chess(ch.fen()); const mm = c.move(a); if (c.isCheckmate()) continue;
          const { best, mine } = await evalMove(ch.fen(), mm.from + mm.to + (mm.promotion || ''));
          if (!ok(best, mine, 120)) problems.push(`${l.id}#${i} coup accepté ${a} : ${JSON.stringify(mine)} vs meilleur ${best.move} ${JSON.stringify(best)}`);
        }
      } else if (g.kind === 'line') {
        for (let k = 0; k < g.moves.length; k++) {
          if (k % 2 === 0) {
            const c = new Chess(ch.fen()); c.move(g.moves[k]);
            if (!c.isCheckmate()) {
              const { best, mine } = await evalMove(ch.fen(), uci(ch, g.moves[k]));
              const margin = l.id.startsWith('a-ouv') || l.id === 'i-principes' ? 150 : 80;
              if (!ok(best, mine, margin)) problems.push(`${l.id}#${i} ligne coup ${k} ${g.moves[k]} : ${JSON.stringify(mine)} vs ${best.move} ${JSON.stringify(best)}`);
            }
          }
          ch.move(g.moves[k]);
        }
      } else {
        const r = await e.analyse(ch.fen(), { depth: 20 });
        const sc = score(r.lines[0]); // du point de vue du camp au trait
        const want = g.kind === 'play' ? g.result : null;
        if (want === 'draw') { if (Math.abs(sc) > 100) problems.push(`${l.id}#${i} nulle attendue, éval ${sc}`); }
        else if (want) { if (sc < 400) problems.push(`${l.id}#${i} gain attendu, éval ${sc}`); }
        if (g.kind === 'quiz') {
          const white = ch.turn() === 'w' ? sc : -sc;
          if (g.verify === 'win' && white < 300) problems.push(`${l.id}#${i} quiz gain blanc attendu ${white}`);
          if (g.verify === 'draw' && Math.abs(white) > 100) problems.push(`${l.id}#${i} quiz nulle attendue ${white}`);
        }
      }
    });
  });
  it('aucun problème', () => { if (problems.length) console.log(problems.join('\n')); expect(problems).toEqual([]); });
});

import { ENDGAMES } from '../src/data/endgames';
import TB from '../tools/data/tb-cache.json';
describe('Validation moteur des finales', () => {
  for (const d of ENDGAMES) it(d.id, async () => {
    new Chess(d.fen);
    const r = await e.analyse(d.fen, { depth: 22 }); const sc = score(r.lines[0]);
    if (d.goal === 'draw') expect(Math.abs(sc), d.id).toBeLessThanOrEqual(100);
    // les positions vérifiées par tablebase (gain certain) peuvent avoir une éval. Stockfish modeste (KBN-K, KQ-KR…)
    else expect(sc, d.id).toBeGreaterThan(d.verified === 'tablebase' || d.id === 'kbb-k' ? 150 : 400);
    if (d.verified === 'tablebase') { const tb = (TB as Record<string, any>)[d.fen]; expect(tb, d.id + ' cache tablebase').toBeTruthy(); expect(d.goal === 'draw' ? ['draw', 'blessed-loss', 'cursed-win'] : ['win']).toContain(tb.category); }
  });
});
