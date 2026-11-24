// Règle d'équivalence des coups dans les leçons (audit P1) : un autre mat aussi rapide, ou un coup à moins de
// 30 centipions du coup prévu, est accepté. Fonction pure, partagée par l'app (coach/client.ts) et les tests de contenu.
export const EQUIV_CP = 30;
export interface Sc { cp: number | null; mate: number | null }
/** score du point de vue du camp au trait ; mats = ±(100000 − distance) */
export const pts = (l?: Sc | null) => (!l ? 0 : l.mate != null ? (l.mate > 0 ? 100000 - l.mate : -100000 - l.mate) : l.cp ?? 0);
export type Equiv = 'mate-equal' | 'equal' | 'worse';
export function equivalence(expected: Sc | null | undefined, played: Sc | null | undefined): Equiv {
  if (!played) return 'worse';
  const expMate = expected?.mate != null && expected.mate > 0;
  if (expMate) return played.mate != null && played.mate > 0 && played.mate <= expected!.mate! ? 'mate-equal' : 'worse';
  if (played.mate != null && played.mate > 0) return 'equal';
  return pts(played) >= pts(expected) - EQUIV_CP && pts(played) > -200 ? 'equal' : 'worse';
}
