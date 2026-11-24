// Pour l'e2e CA1.1 : un coup faux (légal, refusé par l'exercice, pas une alternative équivalente acceptée) par
// exercice à coups des leçons et des cours. Sortie : tools/data/e2e-wrong-moves.json (déterministe).
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons';
import { COURSE_LESSONS } from '../src/data/lessons/courses';
import ACC from '../src/data/accepts.gen.json';

const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion || '');
const out: { id: string; step: number; kind: string; fen: string; wrong: string; orient: 'white' | 'black'; level: string }[] = [];
const PIECE_ORDER = 'nbrqkp'; // préférer un coup de pièce (plus parlant) à un coup de pion
for (const l of [...LESSONS, ...COURSE_LESSONS]) l.steps.forEach((st: any, i: number) => {
  if (st.type !== 'exercise' || !['line', 'any', 'mate', 'check'].includes(st.goal.kind)) return;
  const ch = new Chess(st.fen || undefined); for (const m of st.pre || []) ch.move(m); const fen = ch.fen(); const g = st.goal;
  const acc = (ACC as any)[key(fen)] || {};
  const exp = g.kind === 'line' ? (() => { const c = new Chess(fen); return uci(c.move(g.moves[0])); })() : g.kind === 'any' ? (() => { const c = new Chess(fen); return uci(c.move(g.accept[0])); })() : '';
  const refused = (m: any) => {
    const u = uci(m); const c = new Chess(fen); c.move(m);
    if (g.kind === 'mate') return !c.isCheckmate() && !acc[u];
    if (g.kind === 'check') return !c.inCheck();
    if (g.kind === 'any') { const ok = g.accept.some((a: string) => a.replace(/[+#]/g, '') === m.san.replace(/[+#]/g, '')); return !ok && (g.method ? true : !acc[u]); }
    return u !== exp && !acc[u];
  };
  const ms = ch.moves({ verbose: true }).filter((m) => !m.promotion && refused(m)).sort((a, b) => PIECE_ORDER.indexOf(a.piece) - PIECE_ORDER.indexOf(b.piece) || uci(a).localeCompare(uci(b)));
  if (!ms.length) return;
  out.push({ id: l.id, step: i, kind: g.kind, fen, wrong: uci(ms[0]), orient: st.orientation || (ch.turn() === 'w' ? 'white' : 'black'), level: l.level });
});
fs.writeFileSync('tools/data/e2e-wrong-moves.json', JSON.stringify(out) + '\n');
const by = out.reduce((a: any, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {});
console.log(`${out.length} exercices à coups (${[...new Set(out.map((x) => x.id))].length} leçons/cours) :`, by);
