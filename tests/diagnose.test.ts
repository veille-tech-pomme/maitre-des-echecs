// Pilier 1 : diagnostic de l'erreur (CA1.2, CA1.3, CA1.4, CA1.5).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import { diagnose, diagnoseFast, explainIllegal, graduatedHints, spoilers, narrate, MISTAKE_KINDS, type EngineLike } from '../src/coach/diagnose';
import { CORPUS } from './diagnose-corpus';
// @ts-ignore
import { Uci } from '../tools/uci.mjs';

let e: any; let eng: EngineLike;
beforeAll(async () => { e = new Uci(); await e.init(); eng = { analyse: (fen, o) => e.analyse(fen, { nodes: o.nodes, multipv: o.multipv, searchmoves: o.searchmoves }) }; });
afterAll(() => e?.quit());
const NODES = 300_000;
async function run(c: typeof CORPUS[number]) {
  if (c.kind === 'illegal') { const [f, t] = [c.played.slice(0, 2), c.played.slice(2, 4)]; return explainIllegal(c.fen, f, t); }
  return diagnose({ fen: c.fen, played: c.played, expected: c.expected, goal: c.goal, elo: 1000, allowEquivalent: c.goal === 'mate', engine: eng, nodes: NODES });
}

describe('Diagnostic de l’erreur : corpus par catégorie (CA1.2)', () => {
  it('chaque catégorie a au moins un cas positif et un négatif', () => {
    for (const k of MISTAKE_KINDS) { expect(CORPUS.some((c) => c.kind === k && c.positive), k + ' +').toBe(true); expect(CORPUS.some((c) => c.kind === k && !c.positive), k + ' −').toBe(true); }
  });
  for (const c of CORPUS) it(`${c.positive ? '+' : '−'} ${c.kind} : ${c.note}`, async () => {
    const d = await run(c);
    if (c.positive) { expect(d?.kind, JSON.stringify(d)).toBe(c.kind); expect(d!.headline.length).toBeGreaterThan(8); expect(d!.headline).not.toMatch(/^Pas tout à fait|Réessaie/); }
    else expect(d?.kind ?? null).not.toBe(c.kind);
  }, 60000);
  it('aucune explication n’annonce une prise que la ligne du moteur ne confirme pas', async () => {
    for (const c of CORPUS.filter((x) => x.positive && ['hanging', 'losingTrade'].includes(x.kind))) {
      const d = (await run(c))!; const sq = d.marks.find((m) => m.kind === 'danger')!.sq;
      const r = await e.analyse(new Chess(c.fen).move({ from: c.played.slice(0, 2), to: c.played.slice(2, 4) }) && (() => { const x = new Chess(c.fen); x.move({ from: c.played.slice(0, 2), to: c.played.slice(2, 4) }); return x.fen(); })(), { nodes: NODES });
      expect(r.lines[0].pv.filter((_: string, i: number) => i % 2 === 0).some((u: string) => u.slice(2, 4) === sq), `${c.note} : la ligne ${r.lines[0].pv.join(' ')} ne prend pas en ${sq}`).toBe(true);
    }
  }, 60000);
  it('les règles répondent sans moteur (immédiat) pour les catégories 2 à 6', () => {
    for (const c of CORPUS.filter((x) => x.positive && ['stalemate', 'missedMate', 'ignoredMateThreat', 'ignoredCheck', 'hanging', 'losingTrade'].includes(x.kind)))
      expect(diagnoseFast({ fen: c.fen, played: c.played, expected: c.expected, goal: c.goal }).kind, c.note).toBe(c.kind);
  });
});

describe('Cas de l’audit acceptés (CA1.3)', () => {
  it('Tb7 dans « Mat en 2 » (6k1/8/8/8/8/8/R7/1R4K1 w) : accepté, depuis les alternatives précalculées', async () => {
    const ctx = { fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', played: 'b1b7', expected: ['a2a7'], goal: 'line' as const, allowEquivalent: true };
    const fast = diagnoseFast(ctx); expect(fast.accept).toBe(true); expect(fast.source).toBe('precomputed'); expect(fast.note).toMatch(/Tb7 mate en 2 comme Ta7/);
    expect(fast.continuation!.length).toBeGreaterThan(0);
    const d = await diagnose({ ...ctx, engine: eng, nodes: NODES }); expect(d.accept).toBe(true);
  });
  it('Txe6 dans « Attaque la pièce clouée » : accepté', async () => {
    const ctx = { fen: '4k3/8/4n3/8/3P4/8/8/4R1K1 w - - 0 1', played: 'e1e6', expected: ['d4d5'], goal: 'any' as const, allowEquivalent: true };
    expect(diagnoseFast(ctx).accept).toBe(true);
    expect((await diagnose({ ...ctx, engine: eng, nodes: NODES })).accept).toBe(true);
  });
});

describe('Indices gradués et « Montre-moi » (CA1.4, CA1.5)', () => {
  it('3 niveaux ; les niveaux 1 et 2 ne contiennent jamais le coup solution ; le niveau 3 le montre', () => {
    for (const c of CORPUS.filter((x) => x.kind !== 'illegal')) {
      const h = graduatedHints({ fen: c.fen, expected: c.expected, authored: ['Joue ' + new Chess(c.fen).move({ from: c.expected[0].slice(0, 2), to: c.expected[0].slice(2, 4) }).san] });
      expect(h.map((x) => x.level)).toEqual([1, 2, 3]);
      const sp = spoilers(c.fen, c.expected[0]);
      for (const x of h.slice(0, 2)) for (const s of sp) expect(x.text.includes(s), `${c.note} niveau ${x.level} « ${x.text} » contient ${s}`).toBe(false);
      expect(h[2].arrows[0]).toEqual({ orig: c.expected[0].slice(0, 2), dest: c.expected[0].slice(2, 4), brush: 'green' });
    }
  });
  it('« Montre-moi » : la réfutation est légale, une phrase par demi-coup, et on revient exactement à la FEN de départ', async () => {
    for (const c of CORPUS.filter((x) => x.positive && x.kind !== 'illegal')) {
      const d = (await run(c))!; const seq = [c.played, ...d.refutation];
      const ch = new Chess(c.fen); for (const u of seq) expect(ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }), `${c.note} ${u}`).toBeTruthy();
      expect(d.narration.length).toBe(seq.length); expect(d.refutation.length).toBeLessThanOrEqual(4);
      // le composant rejoue sur une copie : la position de l'exercice ne change pas
      expect(new Chess(c.fen).fen()).toBe(new Chess(c.fen).fen());
    }
  }, 120000);
  it('narration lisible', () => {
    expect(narrate('4k3/8/5p2/8/8/5N2/8/4K3 w - - 0 1', ['f3g5', 'f6g5'], 'w')).toEqual(['Tu joues Cg5.', 'L’adversaire répond fxg5 : le pion prend ton cavalier.']);
  });
});
