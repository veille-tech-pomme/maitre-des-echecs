import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { minStarMoves } from '../src/lib/stars';
import puzzles from '../src/data/puzzles.json';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const norm = (s: string) => s.replace(/[+#]/g, '');
function setup(fen: string | undefined, pre: string[] = []) {
  const ch = new Chess(fen || START);
  for (const m of pre) { const r = ch.move(m); expect(r, `pré-coup ${m}`).toBeTruthy(); }
  return ch;
}
describe('Leçons', () => {
  it('identifiants uniques et contenu non vide', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LESSONS.length).toBeGreaterThanOrEqual(35);
    for (const l of LESSONS) expect(l.steps.length, l.id).toBeGreaterThan(1);
  });
  for (const l of LESSONS) {
    describe(l.id, () => {
      l.steps.forEach((s, i) => {
        if (s.type === 'demo') it(`démo ${i} légale`, () => { const ch = setup(s.fen, s.pre); for (const m of s.moves) expect(ch.move(m), `${l.id} démo ${m}`).toBeTruthy(); });
        if (s.type === 'puzzles') it(`puzzles ${i} disponibles`, () => {
          const n = (puzzles as any[]).filter((p) => p.r <= s.maxRating && p.r >= (s.minRating || 0) && s.themes.some((t) => p.t.includes(t))).length;
          expect(n, `${l.id}: ${s.themes}`).toBeGreaterThanOrEqual(s.count);
        });
        if (s.type !== 'exercise') return;
        const g = s.goal;
        it(`exercice ${i} (${g.kind}) valide`, () => {
          if (g.kind === 'stars') {
            const n = minStarMoves(g.piece, g.from, g.stars, g.blockers);
            expect(n, 'étoiles atteignables').toBeGreaterThan(0);
            if (g.par) expect(n).toBeLessThanOrEqual(g.par);
            return;
          }
          if (g.kind === 'select') { for (const q of g.squares) expect(q).toMatch(/^[a-h][1-8]$/); return; }
          if (g.kind === 'quiz') { expect(g.answer).toBeLessThan(g.options.length); if (s.fen && g.verify) new Chess(s.fen); return; }
          const ch = setup(s.fen, s.pre);
          if (g.kind === 'any') { for (const a of g.accept) { const c = new Chess(ch.fen()); expect(c.move(a), `${l.id} accepte ${a}`).toBeTruthy(); } }
          if (g.kind === 'mate') expect(ch.moves({ verbose: true }).some((m) => { const c = new Chess(ch.fen()); c.move(m); return c.isCheckmate(); }), `${l.id} mat en 1 existe`).toBe(true);
          if (g.kind === 'check') expect(ch.moves().some((m) => m.includes('+'))).toBe(true);
          if (g.kind === 'line') {
            for (const m of g.moves) { const r = ch.move(m); expect(r, `${l.id} ligne ${m}`).toBeTruthy(); expect(norm(r!.san)).toBe(norm(m)); }
            if (g.moves[g.moves.length - 1].includes('#')) expect(ch.isCheckmate()).toBe(true);
          }
          if (g.kind === 'play') expect(ch.isGameOver()).toBe(false);
        });
      });
    });
  }
});
