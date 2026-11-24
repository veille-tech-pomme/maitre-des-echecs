// Brief P0 §4 et §8.3 : pendule pure.
import { describe, it, expect } from 'vitest';
import { createClock, canMatePieces, clkTag } from '../src/lib/clock';

describe('Pendule 3+2', () => {
  const C = () => createClock({ base: 180000, inc: 2000 });
  it('incrément ajouté à chaque coup ; une seule pendule tourne', () => {
    const c = C(); c.start('w', 0);
    c.press('w', 5000); expect(c.remaining('w', 5000)).toBe(177000); expect(c.running()).toBe('b');
    expect(c.remaining('w', 9000)).toBe(177000); expect(c.remaining('b', 9000)).toBe(176000);
    c.press('b', 9000); expect(c.remaining('b', 9000)).toBe(178000);
  });
  it('pause / reprise (onglet caché, coach, pause « gaffe »)', () => {
    const c = C(); c.start('w', 0); c.pause(10000); expect(c.remaining('w', 60000)).toBe(170000);
    c.pause(20000); c.resume(60000); expect(c.remaining('w', 61000)).toBe(169000);
  });
  it('snapshot / restore pour la reprise de coup', () => {
    const c = C(); c.start('w', 0); const s0 = c.snapshot(0);
    c.press('w', 30000); c.press('b', 40000); c.press('w', 70000);
    c.restore(s0, 100000); expect(c.remaining('w', 100000)).toBe(180000); expect(c.running()).toBe('w'); expect(c.remaining('w', 101000)).toBe(179000);
  });
  it('chute du drapeau détectée au premier test après 0 (intervalle 50 ms → < 100 ms)', () => {
    const c = C(); c.start('w', 0);
    expect(c.flagged(179999)).toBeNull(); expect(c.flagged(180000)).toBe('w'); expect(c.flagged(180049)).toBe('w');
    c.press('w', 180000); expect(c.remaining('w', 180000)).toBe(0); // pas d'incrément après la chute
  });
  it('règle FIDE (approximation P0) : roi seul, roi + fou, roi + cavalier ne peuvent pas mater', () => {
    expect(canMatePieces(['k'])).toBe(false); expect(canMatePieces(['k', 'b'])).toBe(false); expect(canMatePieces(['k', 'n'])).toBe(false);
    expect(canMatePieces(['k', 'p'])).toBe(true); expect(canMatePieces(['k', 'r'])).toBe(true); expect(canMatePieces(['k', 'b', 'n'])).toBe(true);
  });
  it('temps caché : la pendule ne bouge pas pendant la pause', () => { const c = C(); c.start('b', 0); c.pause(1000); expect(c.remaining('b', 999999)).toBe(179000); });
  it('format [%clk] h:mm:ss', () => { expect(clkTag(180000)).toBe('0:03:00'); expect(clkTag(3725400)).toBe('1:02:05'); });
});
