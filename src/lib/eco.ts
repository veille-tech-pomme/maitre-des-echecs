// Explorateur d'ouvertures : ~3 900 lignes nommées (jeu de données Lichess chess-openings, CC0), chargé à la demande.
export type EcoLine = [eco: string, name: string, moves: string];
let data: EcoLine[] | null = null; let loading: Promise<EcoLine[]> | null = null;
export function loadEco(): Promise<EcoLine[]> {
  if (data) return Promise.resolve(data);
  return (loading ||= import('../data/eco.json').then((m) => (data = (m.default as unknown) as EcoLine[])));
}
export interface EcoNext { san: string; lines: number; name: string; eco: string }
/** Continuations connues après une suite de coups SAN (par préfixe). */
export function ecoNext(lines: EcoLine[], sans: string[]): EcoNext[] {
  const pre = sans.join(' '); const n = sans.length; const map = new Map<string, EcoNext & { depth: number }>();
  for (const [eco, name, mv] of lines) {
    if (n && !(mv === pre || mv.startsWith(pre + ' '))) continue;
    const ms = mv.split(' '); if (ms.length <= n) continue;
    const san = ms[n]; const e = map.get(san);
    if (!e) map.set(san, { san, lines: 1, name, eco, depth: ms.length });
    else { e.lines++; if (ms.length < e.depth) { e.depth = ms.length; e.name = name; e.eco = eco; } }
  }
  return [...map.values()].sort((a, b) => b.lines - a.lines).map(({ depth, ...x }) => x);
}
/** Nom de la position actuelle : la ligne nommée la plus longue qui est un préfixe des coups joués. */
export function ecoName(lines: EcoLine[], sans: string[]): { eco: string; name: string } | null {
  let best: EcoLine | null = null; let bl = 0; const s = sans.join(' ');
  for (const l of lines) { const len = l[2].length; if (len > bl && (s === l[2] || s.startsWith(l[2] + ' '))) { best = l; bl = len; } }
  return best ? { eco: best[0], name: best[1] } : null;
}
