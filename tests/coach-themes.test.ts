// Thèmes lus sur la ligne : positions construites à la main (positifs et négatifs).
import { describe, it, expect } from 'vitest';
import { lineThemes, isTrappedAt, isHanging } from '../src/coach/themes';
import { parseFen, sqIdx } from '../src/coach/geometry';
const keys = (fen: string, line: string) => lineThemes(fen, line.split(' ')).map((t) => t.key);

describe('thèmes sur la ligne', () => {
  it('surcharge : la dame garde d8 et e5, Txd8+ Dxd8 Cxe5', () => {
    const k = keys('3r2k1/4qppp/8/4n3/8/5N2/5PPP/3R2K1 b - - 0 1', 'h7h6 d1d8 e7d8 f3e5');
    expect(k).toContain('overload');
  });
  it('pas de surcharge si la cible a un second défenseur', () => {
    const k = keys('3r2k1/4qppp/5p2/4n3/8/5N2/5PPP/3R2K1 b - - 0 1', 'h7h6 d1d8 e7d8 f3e5');
    expect(k).not.toContain('overload');
  });
  it('clouage absolu : Fb5 cloue la dame d7 devant le roi', () => {
    expect(keys('3qk3/8/8/8/8/8/8/4KB2 b - - 0 1', 'd8d7 f1b5 e8e7 b5d7')).toContain('pin');
    expect(keys('3qk3/8/8/8/8/8/8/4KB2 b - - 0 1', 'd8d6 f1b5 e8e7 b5a4')).not.toContain('pin');
  });
  it('enfilade : Ta1+ chasse le roi, la dame a8 tombe', () => {
    expect(keys('q7/8/8/1k6/8/7K/8/7R b - - 0 1', 'b5a5 h1a1 a5b4 a1a8')).toContain('skewer');
    expect(keys('q7/8/8/1k6/8/7K/8/7R b - - 0 1', 'b5a5 h1a1 a5b4 a1a2')).not.toContain('skewer');
  });
  it('pièce en prise : défense en rayons X comptée', () => {
    const b = parseFen('8/8/8/3q4/8/3R4/3R4/k6K w - - 0 1').b;
    expect(isHanging(b, sqIdx('d5'))).toBe(true);
    const b2 = parseFen('3r4/8/8/3q4/8/3R4/8/k6K w - - 0 1').b; expect(isHanging(b2, sqIdx('d5'))).toBe(false);
  });
  it('pièce piégée : le fou a7 enfermé par b6', () => {
    expect(isTrappedAt('6k1/Bp3ppp/1p6/8/8/8/5PPP/6K1 w - - 0 1', sqIdx('a7'))).toBe(false); // pas attaqué
    expect(isTrappedAt('6k1/B4ppp/1p6/8/8/8/5PPP/r5K1 w - - 0 1', sqIdx('a7'))).toBe(false);
  });
});
