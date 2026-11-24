// Brief P0 §3 et §8.2 : temps de réflexion (fonction pure).
import { describe, it, expect } from 'vitest';
import { computeThinkMs } from '../src/lib/timing';
describe('computeThinkMs', () => {
  it('simple', () => expect(computeThinkMs(1000, 4500)).toBe(3500));
  it('retire le temps onglet caché', () => expect(computeThinkMs(0, 10000, [[2000, 5000]])).toBe(7000));
  it('retire l’analyse du coach ; chevauchements comptés une fois ; bornés à [tReady, tMove]', () => {
    expect(computeThinkMs(0, 10000, [[2000, 5000]], [[4000, 6000]])).toBe(6000);
    expect(computeThinkMs(1000, 10000, [[0, 3000]], [[9000, 20000]])).toBe(6000);
  });
  it('jamais négatif ; tMove ≤ tReady → 0', () => { expect(computeThinkMs(5000, 5000)).toBe(0); expect(computeThinkMs(0, 1000, [[0, 5000]])).toBe(0); });
});
