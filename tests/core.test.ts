import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { OPENINGS, isBookFen, bookMoves, openingName } from '../src/data/openings';
import { BOTS } from '../src/data/bots';
import { ENDGAMES } from '../src/data/endgames';
import { classify, moveAccuracy, CLASS_ORDER, CLASS_INFO } from '../src/lib/review';
import { newItem, review, isDue, isMastered } from '../src/lib/srs';
import { expected, updateRating } from '../src/lib/rating';
import { minStarMoves, pieceDests } from '../src/lib/stars';
import { detectMotifs, hangingPieces } from '../src/lib/motifs';
import { PLANS } from '../src/lib/entitlements/config';
import { FREE_REVIEWS_PER_DAY } from '../src/lib/features';
import puzzles from '../src/data/puzzles.json';
import eco from '../src/data/eco.json';
import masters from '../src/data/masters.json';

const base = { loss: 0, isBest: false, book: false, mate: false, sacrifice: false, winBefore: 50, winAfter: 50, onlyMove: false, missedWin: false };
describe('Ouvertures', () => {
  it('au moins 15 ouvertures, toutes les lignes légales', () => {
    expect(OPENINGS.length).toBeGreaterThanOrEqual(15);
    for (const o of OPENINGS) for (const l of o.lines) { const c = new Chess(); for (const m of l.moves.split(' ')) expect(c.move(m), `${o.id} / ${l.name} : ${m}`).toBeTruthy(); for (const k of Object.keys(l.notes || {})) expect(+k).toBeLessThan(l.moves.split(' ').length); }
  });
  it('livre et noms', () => {
    const c = new Chess(); c.move('e4'); expect(isBookFen(c.fen())).toBe(true);
    expect(bookMoves(new Chess().fen()).map((m) => m.san)).toContain('e4');
    expect(openingName(['e4', 'c5'])).toMatch(/Sicilienne/i);
    expect(openingName(['e4', 'e6'])).toMatch(/Française/i);
  });
});
describe('Classification des coups (bilan)', () => {
  it('seuils', () => {
    expect(classify({ ...base, book: true })).toBe('book');
    expect(classify({ ...base, isBest: true })).toBe('best');
    expect(classify({ ...base, isBest: true, onlyMove: true, winBefore: 60 })).toBe('great');
    expect(classify({ ...base, sacrifice: true, loss: 1, winAfter: 70 })).toBe('brilliant');
    expect(classify({ ...base, loss: 1.5 })).toBe('excellent');
    expect(classify({ ...base, loss: 4 })).toBe('good');
    expect(classify({ ...base, loss: 8 })).toBe('inaccuracy');
    expect(classify({ ...base, loss: 15 })).toBe('mistake');
    expect(classify({ ...base, loss: 35 })).toBe('blunder');
    expect(classify({ ...base, loss: 25, missedWin: true })).toBe('miss');
  });
  it('précision', () => { expect(moveAccuracy(0)).toBeCloseTo(100, 0); expect(moveAccuracy(50)).toBeLessThan(15); expect(moveAccuracy(5)).toBeGreaterThan(moveAccuracy(10)); });
  it('toutes les classes ont libellé français et couleur', () => { for (const c of CLASS_ORDER) { expect(CLASS_INFO[c].label.length).toBeGreaterThan(2); expect(CLASS_INFO[c].color).toMatch(/^#/); } });
});
describe('Répétition espacée', () => {
  it('intervalles croissants, échec = retour à zéro', () => {
    const t = 0; let it = newItem('x', 'puzzle', t); expect(isDue(it, t)).toBe(false); expect(isDue(it, t + 11 * 60000)).toBe(true);
    it = review(it, 2, t); expect(it.interval).toBe(1); it = review(it, 2, t); expect(it.interval).toBe(4); it = review(it, 2, t); expect(it.interval).toBe(10);
    it = review(it, 3, t); expect(isMastered(it)).toBe(true);
    it = review(it, 0, t); expect(it.interval).toBe(0); expect(it.lapses).toBe(1);
  });
});
describe('Classement Elo des puzzles', () => {
  it('symétrie et sens', () => {
    expect(expected(1500, 1500)).toBeCloseTo(0.5); const up = updateRating(1500, 1500, true, 50); const dn = updateRating(1500, 1500, false, 50);
    const r = (x: any) => (typeof x === 'number' ? x : x.rating ?? x.r); expect(r(up)).toBeGreaterThan(1500); expect(r(dn)).toBeLessThan(1500);
  });
});
describe('Exercices « étoiles »', () => {
  it('BFS', () => { expect(minStarMoves('R', 'a1', ['a8'])).toBe(1); expect(minStarMoves('N', 'a1', ['b3', 'c5'])).toBe(2); expect(minStarMoves('B', 'a1', ['a2'])).toBe(-1); expect(pieceDests('K', 'a1', new Set()).length).toBe(3); });
});
describe('Motifs tactiques (coach)', () => {
  it('fourchette du cavalier', () => {
    const b = new Chess('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'); const a = new Chess(b.fen()); const m = a.move('Nc7+')!;
    expect(detectMotifs(b, m, a).map((x) => x.key)).toContain('fork');
  });
  it('pièce en prise', () => { const c = new Chess('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1'); expect(JSON.stringify(hangingPieces(c, 'b'))).toContain('d5'); });
});
describe('Contenu', () => {
  it('40+ bots à personnalité (200 → 3200 Elo)', () => {
    expect(BOTS.length).toBeGreaterThanOrEqual(40); for (const b of BOTS) { expect(b.name && b.elo && b.bio && b.group).toBeTruthy(); expect(b.elo).toBeGreaterThanOrEqual(200); expect(b.elo).toBeLessThanOrEqual(3200); }
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(BOTS.length);
    for (const id of ['paulette', 'leo', 'odette', 'hugo', 'ines', 'comte', 'morgane', 'victor', 'max']) expect(BOTS.some((b) => b.id === id)).toBe(true);
    for (const b of BOTS) for (const line of b.book || []) { const c = new Chess(); for (const m of line) expect(c.move(m), `${b.id} livre ${m}`).toBeTruthy(); }
  });
  it('explorateur : 3 800+ lignes nommées légales', () => {
    const E = eco as [string, string, string][]; expect(E.length).toBeGreaterThan(3800);
    for (const [, name, mv] of E) { expect(name.length).toBeGreaterThan(3); const c = new Chess(); for (const m of mv.split(' ')) expect(c.move(m)).toBeTruthy(); }
  });
  it('« Devine le coup » : parties légales', () => { for (const g of masters as any[]) { const c = new Chess(); for (const m of g.m.split(' ')) c.move(m); expect(['w', 'b']).toContain(g.side); } expect((masters as any[]).length).toBeGreaterThanOrEqual(60); });
  it('finales : positions légales', () => { expect(ENDGAMES.length).toBeGreaterThanOrEqual(12); for (const e of ENDGAMES) expect(() => new Chess(e.fen)).not.toThrow(); });
  it('puzzles : tous rejouables légalement', () => {
    const P = puzzles as { i: string; f: string; m: string; r: number; t: string[] }[]; expect(P.length).toBeGreaterThan(4000);
    for (const p of P) { const c = new Chess(p.f); for (const u of p.m.split(' ')) { const mv = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); if (!mv) throw new Error('puzzle ' + p.i); } }
  });
  it('tarifs et essai gratuit', () => {
    const a = PLANS.find((p) => p.id === 'annual')!; expect(a.price).toContain('29,99'); expect(a.trialDays).toBe(7);
    expect(PLANS.find((p) => p.id === 'monthly')!.price).toContain('3,99'); expect(PLANS.some((p) => p.id === 'lifetime')).toBe(true);
    expect(FREE_REVIEWS_PER_DAY).toBeGreaterThanOrEqual(3);
  });
  it('aucune régie publicitaire dans les dépendances', async () => {
    const pkg = (await import('../package.json')).default as any; const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/admob|adsense|applovin|unity-ads|ironsource|google-mobile-ads|facebook-audience/i);
  });
});
