// Audit Magnus B7 : erreurs « humaines » des bots (coups naturels, angles morts) et texte de calibration.
import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/engine', () => ({ engine: { analyse: async () => ({ best: '', lines: [] }) } }));
import { Chess } from 'chess.js';
import { naturalMove, seeProb } from '../src/lib/bot-move';
import { BOTS } from '../src/data/bots';
import { calibText } from '../src/pages/Play';
const max = () => 0.999999; // tirage final : premier coup du lot ; danger toujours vu si rnd < see
describe('naturalMove', () => {
  it('prend une dame en prise (coup naturel)', () => {
    const ch = new Chess('rnb1kbnr/pppp1ppp/8/4p2q/3P4/4P3/PPP2PPP/RNBQKBNR w KQkq - 0 1'.replace('4p2q/3P4', '4p3/3P3q'));
    const seen = new Set<string>(); for (let i = 0; i < 40; i++) seen.add(naturalMove(ch, 600)!.san);
    expect([...seen].some((s) => s.includes('x'))).toBe(true);
  });
  it('quand il voit le danger, il ne met pas sa dame en prise d’un pion', () => {
    const ch = new Chess('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 3');
    let hang = 0; for (let i = 0; i < 200; i++) { const m = naturalMove(ch, 1400, () => 0.01 + Math.random() * 0.98)!; const n = new Chess(ch.fen()); n.move(m); if (m.piece === 'q' && n.isAttacked(m.to, 'b') && !m.captured) hang++; }
    expect(hang).toBeLessThan(40);
  });
  it('les angles morts diminuent avec le niveau', () => {
    expect(seeProb(300)).toBeLessThan(seeProb(900)); expect(seeProb(900)).toBeLessThan(seeProb(1400));
  });
  it('chaque bot affiche une force mesurée ou son réglage Stockfish', () => {
    for (const b of BOTS) expect(calibText(b)).toMatch(/Elo mesuré|UCI_Elo|pleine force/);
    for (const b of BOTS.filter((x) => x.elo < 1450)) expect(calibText(b), b.id).toMatch(/Elo mesuré/);
  });
});
