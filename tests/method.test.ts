// Audit Magnus C3 : la méthode Philidor est vérifiée, pas seulement « tenir N coups ».
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { philidorMethodIssue } from '../src/lib/goal';
import { ENDGAMES } from '../src/data/endgames';
import { LESSONS } from '../src/data/lessons';
const after = (fen: string, san: string) => { const c = new Chess(fen); c.move(san); return c; };
const START = '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', E6 = '4k3/R7/4P1r1/3K4/8/8/8/8 b - - 0 1';
describe('philidorMethodIssue', () => {
  it('pion en e5 : la tour reste sur la 6e rangée (Tg6, Rf8 acceptés ; Tb1 refusé même s’il annule)', () => {
    expect(philidorMethodIssue(after(START, 'Rg6'), 'b')).toBeNull();
    expect(philidorMethodIssue(after(START, 'Kf8'), 'b')).toBeNull();
    expect(philidorMethodIssue(after(START, 'Rb1'), 'b')).toMatch(/3e rangée/);
  });
  it('pion en e6 : la tour descend tout en bas (Tg1 accepté, Th6 refusé)', () => {
    expect(philidorMethodIssue(after(E6, 'Rg1'), 'b')).toBeNull();
    expect(philidorMethodIssue(after(E6, 'Rh6'), 'b')).toMatch(/tout en bas/);
  });
  it('plus de tour adverse ou plus de pion : la méthode ne s’applique plus', () => {
    expect(philidorMethodIssue(new Chess('4k3/8/8/3K4/8/8/8/6r1 w - - 0 1'), 'b')).toBeNull();
  });
  it('les exercices Philidor (finale + leçon) vérifient la méthode', () => {
    expect(ENDGAMES.filter((e) => e.id.startsWith('philidor')).every((e) => e.method === 'philidor')).toBe(true);
    const l = LESSONS.find((x) => x.id === 'a-philidor')!;
    expect(l.steps.some((s) => s.type === 'exercise' && s.goal.kind === 'play' && s.goal.method === 'philidor')).toBe(true);
    expect(l.steps.length).toBeGreaterThanOrEqual(5);
    expect(LESSONS.find((x) => x.id === 'a-lucena')!.steps.length).toBeGreaterThanOrEqual(5);
  });
  it('opposition et carré sont au niveau Intermédiaire', () => {
    for (const id of ['a-opposition', 'a-carre']) expect(LESSONS.find((x) => x.id === id)!.level).toBe('intermediaire');
  });
});
