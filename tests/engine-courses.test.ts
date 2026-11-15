// Validation Stockfish des exercices des cours thématiques.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
// @ts-ignore
import { Uci, score } from '../tools/uci.mjs';
let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); }, 60000);
afterAll(() => e?.quit());
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const toUci = (fen: string, san: string) => { const m = new Chess(fen).move(san); return m.from + m.to + (m.promotion || ''); };
async function good(fen: string, mv: string, margin: number, depth = 14) {
  const all = await e.analyse(fen, { depth }); const one = await e.analyse(fen, { depth, searchmoves: [mv] });
  const b = all.lines[0], m = one.lines[0]; if (!m) return { ok: false, b, m }; if (m.move === b.move || all.best === mv) return { ok: true, b, m };
  if (b.mate != null && b.mate > 0) return { ok: m.mate != null && m.mate > 0 || score(b) - score(m) <= margin, b, m };
  return { ok: score(b) - score(m) <= margin, b, m };
}
export const problems: string[] = [];
describe('Moteur : exercices des cours', () => {
  for (const l of COURSE_LESSONS) l.steps.forEach((s, i) => {
    if (s.type !== 'exercise' || !['any', 'line', 'play'].includes(s.goal.kind)) return;
    it(`${l.id} #${i}`, async () => {
      const g = s.goal as any; const ch = new Chess(s.fen || START); for (const m of s.pre || []) ch.move(m);
      const margin = l.course === 'ouvertures' ? 150 : l.course === 'parties' ? 200 : 120;
      if (g.kind === 'any') for (const a of g.accept) { const c = new Chess(ch.fen()); c.move(a); if (c.isCheckmate()) continue; const r = await good(ch.fen(), toUci(ch.fen(), a), margin); if (!r.ok) problems.push(`${l.id}#${i} ${a} ${JSON.stringify(r.m)} vs ${JSON.stringify(r.b)}`); }
      if (g.kind === 'line') for (let k = 0; k < g.moves.length; k++) { if (k % 2 === 0) { const c = new Chess(ch.fen()); c.move(g.moves[k]); if (!c.isCheckmate()) { const r = await good(ch.fen(), toUci(ch.fen(), g.moves[k]), margin); if (!r.ok) problems.push(`${l.id}#${i} coup ${k} ${g.moves[k]} ${JSON.stringify(r.m)} vs ${JSON.stringify(r.b)}`); } } ch.move(g.moves[k]); }
      if (g.kind === 'play') { const r = await e.analyse(ch.fen(), { depth: 18 }); const sc = score(r.lines[0]); if (g.result === 'draw' ? Math.abs(sc) > 100 : sc < 200) problems.push(`${l.id}#${i} play ${g.result} éval ${sc}`); }
    }, 120000);
  });
  it('aucun problème', () => { if (problems.length) console.log(problems.join('\n')); expect(problems).toEqual([]); });
});
