// Brief P0 §4 et §8.3 : PGN avec TimeControl et [%clk], relu par chess.js.
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { pgnWithClock } from '../src/lib/clock';
describe('PGN [%clk]', () => {
  it('TimeControl + [%clk] sur chaque coup, relu par chess.js (coups et commentaires)', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
    const pgn = pgnWithClock(sans, [178000, 179500, 171000, 175250, 160000], { Event: 'Partie amicale', White: 'Moi', Black: 'Bot', Result: '*' }, { base: 180000, inc: 2000 });
    expect(pgn).toContain('[TimeControl "180+2"]'); expect(pgn).toContain('{ [%clk 0:02:58] }');
    const c = new Chess(); c.loadPgn(pgn);
    expect(c.history()).toEqual(sans); expect(c.getHeaders().TimeControl).toBe('180+2');
    const com = c.getComments(); expect(com).toHaveLength(5); expect(com[4].comment).toContain('[%clk 0:02:40]');
  });
});
