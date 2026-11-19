import { describe, it, expect } from 'vitest';
import { strategicReason, structurePlan, stable, terms } from '../src/coach/strategy';
import { parseFen, sqIdx } from '../src/coach/geometry';
const L = (move: string, pv: string[] = [move]) => ({ move, pv, cp: 0, mate: null });

describe('strategy : raisons positionnelles', () => {
  it('pion de l’abri avancé → sécurité du roi, cases nommées', () => {
    const fen = 'r1b2rk1/ppq2ppp/2nbpn2/3p4/3P4/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 10';
    const r = strategicReason({ fenBefore: fen, uci: 'g2g4', best: L('f3g5'), reply: L('c6e7', ['c6e7']), ply: 18 });
    expect(r?.cat).toBe('kingSafety'); expect(r?.why).toMatch(/f3 et h3/);
  });
  it('cavalier au bord → activité', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7';
    const r = strategicReason({ fenBefore: fen, uci: 'c3a4', best: L('a2a3'), reply: L('b7b6', ['b7b6']), ply: 12 });
    expect(r?.cat).toBe('activity'); expect(r?.why).toMatch(/a4/);
  });
  it('rien à dire si le coup joué est le meilleur ou si un mat est en jeu', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7';
    expect(strategicReason({ fenBefore: fen, uci: 'a2a3', best: L('a2a3'), reply: null, ply: 12 })).toBeNull();
    expect(strategicReason({ fenBefore: fen, uci: 'c3a4', best: L('a2a3'), reply: { move: 'x', pv: [], cp: null, mate: 3 }, ply: 12 })).toBeNull();
  });
  it('un pion en prise ne compte pas comme faiblesse de structure', () => {
    const b = parseFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1').b; const s = stable(b);
    expect(s[sqIdx('d5')]).toBeNull(); expect(s[sqIdx('e4')]).toBeNull();
  });
  it('termes : un pion isolé coûte en structure', () => {
    const a = terms('4k3/pp6/8/8/8/8/PP6/4K3 w - - 0 1', 'w', 40).pawnStructure; const b = terms('4k3/pp6/8/8/8/8/P1P5/4K3 w - - 0 1', 'w', 40).pawnStructure;
    expect(b).toBeLessThan(a);
  });
  it('plans de structures types', () => {
    expect(structurePlan('r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R1BQ1RK1 w - - 0 10', 'w')?.key).toBe('iqp');
    expect(structurePlan('r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R1BQ1RK1 b - - 0 10', 'b')?.key).toBe('iqpAgainst');
    expect(structurePlan('r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 0 5', 'b')?.key).toBe('frenchChain');
  });
});
