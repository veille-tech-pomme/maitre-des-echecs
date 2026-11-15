// Déplacements d'une pièce seule (exercices « étoiles »), sans roi ni règles complètes.
const DIRS: Record<string, [number, number][]> = {
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]], B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};
const sq = (f: number, r: number) => 'abcdefgh'[f] + (r + 1);
export function pieceDests(piece: string, from: string, blockers: Set<string>): string[] {
  const f = from.charCodeAt(0) - 97, r = +from[1] - 1; const out: string[] = [];
  const ok = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;
  if (piece === 'N') { for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (ok(f + dx, r + dy) && !blockers.has(sq(f + dx, r + dy))) out.push(sq(f + dx, r + dy)); }
  else if (piece === 'K') { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && ok(f + dx, r + dy) && !blockers.has(sq(f + dx, r + dy))) out.push(sq(f + dx, r + dy)); }
  else for (const [dx, dy] of DIRS[piece]) { let x = f + dx, y = r + dy; while (ok(x, y) && !blockers.has(sq(x, y))) { out.push(sq(x, y)); x += dx; y += dy; } }
  return out;
}
/** Nombre minimal de coups pour ramasser toutes les étoiles (BFS), ou -1. */
export function minStarMoves(piece: string, from: string, stars: string[], blockers: string[] = []): number {
  const bl = new Set(blockers); const idx = new Map(stars.map((s, i) => [s, i])); const full = (1 << stars.length) - 1;
  const start = `${from}|${idx.has(from) ? 1 << idx.get(from)! : 0}`;
  const seen = new Set([start]); let q = [start]; let d = 0;
  while (q.length) {
    const n: string[] = [];
    for (const st of q) {
      const [p, m] = st.split('|'); if (+m === full) return d;
      for (const t of pieceDests(piece, p, bl)) { const nm = idx.has(t) ? +m | (1 << idx.get(t)!) : +m; const k = `${t}|${nm}`; if (!seen.has(k)) { seen.add(k); n.push(k); } }
    }
    q = n; d++; if (d > 64) break;
  }
  return -1;
}
