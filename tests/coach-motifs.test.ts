// Détecteurs du coach : corpus étiqueté (positifs + négatifs), SEE, structure de pions, finales.
import { describe, it, expect } from 'vitest';
import { parseFen, sqIdx, sqName, see } from '../src/coach/geometry';
import { moveMotifs, pawnInfo, kingInfo, outposts, opposition, squareRule, rookPawnPattern, overloaded, hanging, endgameKind } from '../src/coach/motifs';
import { MOVE_CASES } from './coach-corpus';

const mv = (u: string) => ({ from: sqIdx(u.slice(0, 2)), to: sqIdx(u.slice(2, 4)), promo: (u[4] as any) || undefined });
const names = (a: number[]) => a.map(sqName).sort();

describe('Corpus de coups étiquetés', () => {
  for (const c of MOVE_CASES) it(c.name, () => {
    const got = moveMotifs(parseFen(c.fen), mv(c.uci), !!c.mate).map((x) => x.key);
    for (const k of c.expect) expect(got, `attendu ${k}`).toContain(k);
    for (const k of c.forbid) expect(got, `interdit ${k}`).not.toContain(k);
  });
});

describe('SEE (échange statique)', () => {
  it('pion non défendu : +1', () => expect(see(parseFen('4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1').b, sqIdx('d5'), 'w')).toBe(1));
  it('pion défendu par pion, pris par la tour : −4', () => expect(see(parseFen('4k3/8/4p3/3p4/8/8/8/3RK3 w - - 0 1').b, sqIdx('d5'), 'w')).toBe(-4));
  it('batterie tour + tour contre une défense : +1', () => expect(see(parseFen('3rk3/8/8/3p4/8/8/3R4/3RK3 w - - 0 1').b, sqIdx('d5'), 'w')).toBe(1));
  it('rayons X : la tour derrière la dame reprend (Dxe4 Txe4 Txe4 = −1, et non −6)', () => expect(see(parseFen('4k3/4r3/8/8/4n3/8/4Q3/4R1K1 w - - 0 1').b, sqIdx('e4'), 'w')).toBe(-1));
  it('le roi ne prend pas une pièce défendue', () => expect(see(parseFen('8/8/8/2b5/3p4/4K3/8/7k w - - 0 1').b, sqIdx('d4'), 'w')).toBe(0));
  it('pièce en prise listée', () => expect(hanging(parseFen('4k3/8/8/3n4/8/8/8/3RK3 b - - 0 1').b, 'b').map((h) => sqName(h.sq))).toEqual(['d5']));
});

describe('Structure de pions', () => {
  it('pion isolé', () => expect(names(pawnInfo(parseFen('4k3/8/8/8/3P4/8/P6P/4K3 w - - 0 1').b, 'w').isolated)).toEqual(['a2', 'd4', 'h2']));
  it('pions doublés', () => expect(names(pawnInfo(parseFen('4k3/8/8/8/8/2P5/1PP5/4K3 w - - 0 1').b, 'w').doubled)).toEqual(['c2', 'c3']));
  it('pion passé et non passé', () => {
    expect(names(pawnInfo(parseFen('4k3/p6p/8/3P4/8/8/8/4K3 w - - 0 1').b, 'w').passed)).toEqual(['d5']);
    expect(pawnInfo(parseFen('4k3/4p3/8/3P4/8/8/8/4K3 w - - 0 1').b, 'w').passed).toEqual([]);
  });
  it('pion passé protégé', () => expect(names(pawnInfo(parseFen('4k3/8/8/3P4/2P5/8/8/4K3 w - - 0 1').b, 'w').protectedPassed)).toEqual(['d5']));
  it('pion arriéré', () => expect(names(pawnInfo(parseFen('4k3/8/8/4p3/4P3/3P4/8/4K3 w - - 0 1').b, 'w').backward)).toEqual(['d3']));
  it('pion de noirs isolé (symétrie des couleurs)', () => expect(names(pawnInfo(parseFen('4k3/p7/8/4p3/8/8/8/4K3 b - - 0 1').b, 'b').isolated)).toEqual(['a7', 'e5']));
});

describe('Pièces et roi', () => {
  it('avant-poste du cavalier', () => expect(names(outposts(parseFen('4k3/p6p/8/3N4/4P3/8/8/4K3 w - - 0 1').b, 'w'))).toEqual(['d5']));
  it('pas un avant-poste si un pion peut le chasser', () => expect(outposts(parseFen('4k3/2p4p/8/3N4/4P3/8/8/4K3 w - - 0 1').b, 'w')).toEqual([]));
  it('bouclier de pions du roi roqué', () => { const k = kingInfo(parseFen('4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1'), 'w'); expect(k.shield).toBe(3); expect(k.castled).toBe(true); });
  it('roi exposé', () => expect(kingInfo(parseFen('r2qk2r/ppp2ppp/8/8/8/8/8/2RQR1K1 b - - 0 1'), 'w').exposed).toBe(true));
  it('défenseur surchargé : la dame défend seule le fou et la tour', () => {
    const o = overloaded(parseFen('7k/3q1r2/4n3/3b4/8/8/8/3R1RK1 b - - 0 1').b, 'b');
    expect(o.map((x) => [sqName(x.def), names(x.targets)])).toEqual([['d7', ['d5', 'f7']]]);
  });
  it('pas de surcharge si le fou défend aussi la tour', () => expect(overloaded(parseFen('7k/3q1r2/8/3b4/8/8/8/3R1RK1 b - - 0 1').b, 'b')).toEqual([]));
});

describe('Finales', () => {
  it('type de finale', () => { expect(endgameKind(parseFen('8/8/4k3/8/4K3/8/4P3/8 w - - 0 1').b)).toBe('pawn'); expect(endgameKind(parseFen('3K4/3P1k2/8/8/8/8/1r6/4R3 w - - 0 1').b)).toBe('rook'); });
  it('opposition directe (trait aux noirs → les Blancs l’ont)', () => expect(opposition(parseFen('8/8/4k3/8/4K3/8/4P3/8 b - - 0 1'))).toEqual({ holder: 'w', kind: 'direct' }));
  it('règle du carré : le roi rattrape si c’est à lui de jouer', () => {
    expect(squareRule(parseFen('8/8/8/P3k3/8/8/8/K7 b - - 0 1'))[0].caught).toBe(true);
    expect(squareRule(parseFen('8/8/8/P3k3/8/8/8/K7 w - - 0 1'))[0].caught).toBe(false);
  });
  it('position de Lucena', () => expect(rookPawnPattern(parseFen('3K4/3P1k2/8/8/8/8/1r6/4R3 w - - 0 1'))).toEqual({ kind: 'lucena', strong: 'w' }));
  it('défense Philidor', () => expect(rookPawnPattern(parseFen('4k3/8/r7/4P3/4K3/8/8/7R w - - 0 1'))).toEqual({ kind: 'philidor', strong: 'w' }));
  it('pas de Lucena si le roi adverse n’est pas coupé', () => expect(rookPawnPattern(parseFen('3K4/3P4/4k3/8/8/8/1r6/4R3 w - - 0 1'))).toBe(null));
});
