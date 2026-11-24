// Audit Magnus : qualité du contenu rédigé (B4 parties célèbres, B5 cours thématiques).
import { describe, it, expect } from 'vitest';
import DATA from '../src/data/lessons/course-data.json';
const MECH = /^(Le|La|Les|L’)\s?\S+( \S+)? (va|avance|prend|se développe|recule|roquent) (en|le|la|les|côté)/;
describe('B4 — parties célèbres', () => {
  const F = (DATA as any).famous as { id: string; sans: string[]; comments: string[] }[];
  it('aucun commentaire mécanique (« La dame va en d2. »)', () => {
    const bad = F.flatMap((g) => g.comments.filter((c) => c && MECH.test(c) && !c.startsWith('**')).map((c) => `${g.id}: ${c}`));
    expect(bad).toEqual([]);
  });
  it('8 à 12 moments clés par partie, un commentaire par coup au plus', () => {
    for (const g of F) {
      const key = g.comments.filter((c) => c.startsWith('**')).length;
      expect(key, g.id).toBeGreaterThanOrEqual(8); expect(key, g.id).toBeLessThanOrEqual(12);
      expect(g.comments.length, g.id).toBe(g.sans.length);
    }
  });
});
