// Audit P0 : contenu des leçons au moteur (Stockfish multi-PV), à chaque coup que l'élève doit trouver.
// 1) le coup prévu n'est pas une erreur (≤ 150 cp du meilleur, sauf ouvertures) ;
// 2) toute alternative aussi bonne (même mat aussi rapide, ou ≥ coup prévu − 30 cp) est ACCEPTÉE par l'app :
//    acceptation statique de l'exercice (liste, n'importe quel mat) ou règle d'équivalence du juge des leçons.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
import { equivalence, pts, EQUIV_CP } from '../src/lib/judge-rule';
// @ts-ignore
import { Uci, findEngine } from '../tools/uci.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const NATIVE = !findEngine().args.length; const DEPTH = NATIVE ? 16 : 11;
/** types d'exercices où un coup différent passe par le juge des leçons (Lesson.tsx : judge={judgeMove}) */
const JUDGED = new Set(['line', 'any']);
let e: any;
beforeAll(async () => { e = new Uci(); await e.init(); });
afterAll(() => e?.quit());
type Pos = { id: string; fen: string; expected: string; kind: string; accept: (san: string, after: Chess) => boolean; opening: boolean };
const positions: Pos[] = [];
for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((s: any, i) => {
  if (s.type !== 'exercise') return; const g = s.goal; if (!['any', 'line', 'mate'].includes(g.kind)) return;
  const ch = new Chess(s.fen || START); for (const m of s.pre || []) ch.move(m);
  const opening = /^(ouv-|a-ouv|i-principes|rep-)/.test(l.id);
  const strip = (x: string) => x.replace(/[+#]/g, '');
  if (g.kind === 'mate') { const t = ch.moves({ verbose: true }).find((m) => { const c = new Chess(ch.fen()); c.move(m); return c.isCheckmate(); }); if (t) positions.push({ id: `${l.id}#${i}`, fen: ch.fen(), expected: t.from + t.to + (t.promotion || ''), kind: 'mate', accept: (_, a) => a.isCheckmate(), opening }); return; }
  const moves: string[] = g.kind === 'any' ? [g.accept[0]] : g.moves;
  moves.forEach((san: string, k: number) => {
    if (k % 2 === 0) { const m = new Chess(ch.fen()).move(san); positions.push({ id: `${l.id}#${i}.${k}`, fen: ch.fen(), expected: m.from + m.to + (m.promotion || ''), kind: g.kind, opening,
      accept: (x, a) => a.isCheckmate() || (g.kind === 'any' ? g.accept.some((y: string) => strip(y) === strip(x)) : strip(x) === strip(san)) }); }
    ch.move(san);
  });
});

describe('Contenu des leçons au moteur : alternatives acceptées, solutions justes', () => {
  it(`au moins 250 coups à trouver (${positions.length})`, () => expect(positions.length).toBeGreaterThan(250));
  const problems: string[] = []; let alternatives = 0;
  it('chaque position', async () => {
    for (const p of positions) {
      const c = new Chess(p.fen); if (c.isGameOver()) continue;
      const r = await e.analyse(p.fen, { depth: DEPTH, multipv: 4 });
      const ex = r.lines.find((l: any) => l.move === p.expected) || (await e.analyse(p.fen, { depth: DEPTH, searchmoves: [p.expected] })).lines[0];
      const afterExp = new Chess(p.fen); afterExp.move({ from: p.expected.slice(0, 2), to: p.expected.slice(2, 4), promotion: p.expected[4] });
      const expSc = afterExp.isCheckmate() ? { cp: null, mate: 1 } : ex;
      if (!p.opening && !(expSc.mate > 0) && pts(r.lines[0]) - pts(expSc) > 150) problems.push(`${p.id} coup prévu faible : ${p.expected} ${pts(expSc)} contre ${r.lines[0].move} ${pts(r.lines[0])} · ${p.fen}`);
      for (const alt of r.lines) {
        if (alt.move === p.expected) continue;
        const a = new Chess(p.fen); const m = a.move({ from: alt.move.slice(0, 2), to: alt.move.slice(2, 4), promotion: alt.move[4] });
        const asGood = expSc.mate > 0 ? (a.isCheckmate() || (alt.mate > 0 && alt.mate <= expSc.mate)) : pts(alt) >= pts(expSc) - EQUIV_CP && pts(alt) > -200;
        if (!asGood) continue; alternatives++;
        const ok = p.accept(m.san, a) || (JUDGED.has(p.kind) && equivalence(expSc, a.isCheckmate() ? { cp: null, mate: 1 } : alt) !== 'worse');
        if (!ok) problems.push(`${p.id} alternative refusée : ${m.san} (${pts(alt)}) aussi bon que ${p.expected} (${pts(expSc)}) · ${p.fen}`);
      }
    }
    console.log(`${positions.length} coups à trouver, ${alternatives} alternatives aussi bonnes (toutes acceptées si 0 problème), profondeur ${DEPTH}`);
    expect(problems, problems.join('\n')).toEqual([]);
  }, 1800000);
});
