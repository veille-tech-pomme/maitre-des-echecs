// Cours thématiques : légalité de toutes les positions, coups et exercices ; disponibilité des puzzles.
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { COURSES, COURSE_LESSONS } from '../src/data/lessons/courses';
import puzzles from '../src/data/puzzles.json';
import idx from '../src/data/packs-index.json';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const norm = (s: string) => s.replace(/[+#]/g, '');
const setup = (fen?: string, pre: string[] = []) => { const ch = new Chess(fen || START); for (const m of pre) expect(ch.move(m), `pré-coup ${m}`).toBeTruthy(); return ch; };
const bankCount = (themes: string[], min: number, max: number) => { let n = 0; const I = idx as any; for (const [b, B] of Object.entries<any>(I.tiers.core.bands)) { const lo = +b * 100, hi = lo + 99; if (hi < min || lo > max) continue; for (const t of themes) n += B.t[I.themes.indexOf(t)] || 0; } return n; };
describe('Catalogue des cours', () => {
  it('au moins 150 leçons au total, identifiants uniques', () => {
    const all = [...LESSONS, ...COURSE_LESSONS]; const ids = all.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(all.length).toBeGreaterThanOrEqual(150);
  });
  it('objectifs par cours', () => {
    const by = Object.fromEntries(COURSES.map((c) => [c.id, c.lessons.length]));
    expect(by.mats).toBeGreaterThanOrEqual(20); expect(by.parties).toBeGreaterThanOrEqual(20); expect(by.tactique).toBeGreaterThanOrEqual(20); expect(by.ouvertures).toBeGreaterThanOrEqual(30);
    expect(COURSES.find((c) => c.id === 'parties')!.premium).toBe(true);
    for (const l of COURSES.find((c) => c.id === 'parties')!.lessons) expect(l.level).toBe('expert');
  });
});
for (const l of COURSE_LESSONS) describe(l.id, () => {
  it('contenu', () => { expect(l.steps.length).toBeGreaterThan(1); expect(l.title.length).toBeGreaterThan(2); });
  l.steps.forEach((s, i) => {
    if (s.type === 'text' && s.fen) it(`texte ${i} FEN légale`, () => { setup(s.fen, s.pre); });
    if (s.type === 'demo') it(`démo ${i} légale`, () => { const ch = setup(s.fen, s.pre); for (const m of s.moves) expect(ch.move(m), `${l.id} ${m}`).toBeTruthy(); for (const k of Object.keys(s.comments || {})) expect(+k).toBeLessThan(s.moves.length); });
    if (s.type === 'puzzles') it(`puzzles ${i} disponibles`, () => {
      const base = (puzzles as any[]).filter((p) => p.r <= s.maxRating && p.r >= (s.minRating || 0) && s.themes.some((t) => p.t.includes(t))).length;
      expect(base + bankCount(s.themes, s.minRating || 0, s.maxRating), `${l.id} ${s.themes}`).toBeGreaterThanOrEqual(s.count);
    });
    if (s.type === 'exercise') it(`exercice ${i} (${s.goal.kind})`, () => {
      const g = s.goal; const ch = setup(s.fen, s.pre);
      if (g.kind === 'any') for (const a of g.accept) expect(new Chess(ch.fen()).move(a)).toBeTruthy();
      if (g.kind === 'line') { for (const m of g.moves) { const r = ch.move(m); expect(norm(r.san)).toBe(norm(m)); } if (g.moves[g.moves.length - 1].includes('#')) expect(ch.isCheckmate()).toBe(true); }
      if (g.kind === 'quiz') expect(g.answer).toBeLessThan(g.options.length);
      if (g.kind === 'play') expect(ch.isGameOver()).toBe(false);
      if (s.orientation) { const c2 = setup(s.fen, s.pre); expect(c2.turn() === 'w' ? 'white' : 'black', `${l.id} orientation`).toBe(s.orientation); }
    });
  });
});
