import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { sanFr, tryMove, legalDests, isPromotion, gameOverText, material, uciLineToSan, formatLine, START_FEN } from '../src/lib/chess';

describe('Règles du jeu (chess.js + helpers)', () => {
  it('20 coups légaux au départ', () => { expect(new Chess().moves().length).toBe(20); });
  it('petit et grand roque', () => {
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(tryMove(c, 'O-O')?.san).toBe('O-O'); expect(c.get('g1')?.type).toBe('k'); expect(c.get('f1')?.type).toBe('r');
    expect(tryMove(c, 'O-O-O')?.san).toBe('O-O-O'); expect(c.get('c8')?.type).toBe('k');
  });
  it('pas de roque à travers un échec', () => {
    const c = new Chess('4k3/8/8/8/8/8/5r2/4K2R w K - 0 1');
    expect(c.moves().includes('O-O')).toBe(false);
  });
  it('prise en passant', () => {
    const c = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const m = tryMove(c, { from: 'e5', to: 'd6' }); expect(m?.flags).toContain('e'); expect(c.get('d5')).toBeFalsy();
  });
  it('promotion (détection + sous-promotion)', () => {
    const c = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(isPromotion(c, 'e7', 'e8')).toBe(true);
    expect(tryMove(c, { from: 'e7', to: 'e8', promotion: 'n' })?.san).toBe('e8=N');
  });
  it('pat', () => { const c = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); expect(c.isStalemate()).toBe(true); expect(gameOverText(c)).toMatch(/pat/i); });
  it('mat du berger', () => { const c = new Chess(); for (const m of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) c.move(m); expect(c.isCheckmate()).toBe(true); expect(gameOverText(c)).toMatch(/mat/i); });
  it('triple répétition', () => { const c = new Chess(); for (let i = 0; i < 2; i++) for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) c.move(m); expect(c.isThreefoldRepetition()).toBe(true); });
  it('matériel insuffisant', () => { expect(new Chess('8/8/4k3/8/8/3NK3/8/8 w - - 0 1').isInsufficientMaterial()).toBe(true); expect(new Chess('8/8/4k3/8/8/3RK3/8/8 w - - 0 1').isInsufficientMaterial()).toBe(false); });
  it('règle des 50 coups', () => { expect(new Chess('8/8/4k3/8/8/3RK3/8/8 w - - 100 80').isDraw()).toBe(true); });
  it('clouage : une pièce clouée ne bouge pas', () => { const d = legalDests(new Chess('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1')); expect(d.get('e2' as any)).toBeUndefined(); });
  it('coups illégaux refusés', () => { const c = new Chess(); expect(tryMove(c, 'e5')).toBeNull(); expect(tryMove(c, { from: 'e2', to: 'e5' })).toBeNull(); expect(c.fen()).toBe(START_FEN); });
  it('notation française', () => { expect(sanFr('Nf3')).toBe('Cf3'); expect(sanFr('Qxd8+')).toBe('Dxd8+'); expect(sanFr('Bb5')).toBe('Fb5'); expect(sanFr('Rd1')).toBe('Td1'); expect(sanFr('Kg2')).toBe('Rg2'); expect(sanFr('e8=Q#')).toBe('e8=D#'); expect(sanFr('O-O')).toBe('O-O'); });
  it('conversion UCI → SAN et formatage', () => { const s = uciLineToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3']); expect(s).toEqual(['e4', 'e5', 'Nf3']); expect(formatLine(s)).toContain('1.'); });
  it('matériel', () => { const m = material(new Chess('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')); expect(JSON.stringify(m)).toMatch(/9/); });
});
