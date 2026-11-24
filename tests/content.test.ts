// Pilier 8 : le rapport de tools/validate-content.mts (Stockfish 17.1, budget fixe, cache commité) est sans erreur,
// couvre 100 % des exercices à coups (CA8.4) et garde les cas de l'audit en non-régression (CA8.2).
import { describe, it, expect } from 'vitest';
import report from '../tools/data/validation-report.json';
import accepts from '../src/data/accepts.gen.json';
import { positionIssues } from '../src/lib/legal';

const A = accepts as Record<string, Record<string, { s: string; pv?: string[] }>>;
describe('Validation du contenu au moteur (pilier 8)', () => {
  it('aucune erreur : FEN, solutions, alternatives, base de finales, « mat en N »', () => {
    expect(report.errors, (report.errors as string[]).join('\n')).toEqual([]);
  });
  it('100 % des positions d’exercices à coups ont leurs alternatives calculées (CA8.4)', () => {
    expect(report.coverage.movePositions).toBeGreaterThan(700);
    expect(report.coverage.covered).toBe(report.coverage.movePositions);
  });
  it('budget reproductible : Stockfish 17.1, nœuds fixes, multi-PV 5', () => {
    expect(report.engine).toBe('sf17.1'); expect(report.nodes).toBe(1500000); expect(report.multipv).toBe(5);
  });
  it('audit : les alternatives refusées sont désormais acceptées (Tb7 « Mat en 2 », Txe6 « Attaque la pièce clouée »)', () => {
    expect(A['6k1/8/8/8/8/8/R7/1R4K1 w - -']?.b1b7?.s).toBe('m2');
    expect(A['6k1/8/8/8/8/8/R7/1R4K1 w - -']?.b1b7?.pv?.length).toBeGreaterThan(0);
    expect(A['4k3/8/4n3/8/3P4/8/8/4R1K1 w - -']?.e1e6).toBeTruthy();
  });
  it('audit : les positions illégales de Débutant sont refusées par le vérificateur', () => {
    expect(positionIssues('7k/8/6K1/8/8/8/8/Q7 w - - 0 1')).toBeTruthy();
    expect(positionIssues('6k1/8/5K2/8/8/8/8/6Q1 w - - 0 1')).toBeTruthy();
  });
  it('la base de finales confirme toutes les finales de 7 pièces au plus', () => { expect(report.counts.tbChecked).toBeGreaterThan(100); });
});
