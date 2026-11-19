// Géométrie de l'échiquier pour le raisonnement symbolique du coach :
// représentation 64 cases, attaques (avec x-ray), clouages, échange statique (SEE).
export type Color = 'w' | 'b';
export type Role = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece { c: Color; t: Role }
export interface Pos { b: (Piece | null)[]; turn: Color; castling: string; ep: number; fen: string }

export const VAL: Record<Role, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const MAT: Record<Role, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const fileOf = (s: number) => s & 7;
export const rankOf = (s: number) => s >> 3;
export const sqName = (s: number) => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
export const sqIdx = (n: string) => (n.charCodeAt(0) - 97) + (n.charCodeAt(1) - 49) * 8;
export const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const dist = (a: number, b: number) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

const ROLE: Record<string, Role> = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' };
export function parseFen(fen: string): Pos {
  const [placement, turn = 'w', castling = '-', ep = '-'] = fen.trim().split(/\s+/);
  const b: (Piece | null)[] = new Array(64).fill(null);
  const rows = placement.split('/');
  for (let i = 0; i < 8; i++) {
    let f = 0; const r = 7 - i;
    for (const ch of rows[i] || '') {
      if (ch >= '1' && ch <= '8') f += +ch;
      else { const lo = ch.toLowerCase(); b[r * 8 + f] = { c: ch === lo ? 'b' : 'w', t: ROLE[lo] }; f++; }
    }
  }
  return { b, turn: turn as Color, castling, ep: ep === '-' ? -1 : sqIdx(ep), fen };
}

export const KNIGHT: [number, number][] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
export const KING: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const dirsOf = (t: Role) => (t === 'b' ? DIAG : t === 'r' ? ORTH : t === 'q' ? KING : []);
export const slider = (t: Role) => t === 'b' || t === 'r' || t === 'q';

/** Cases attaquées par la pièce en s (occupation `b`). */
export function attacksFrom(b: (Piece | null)[], s: number): number[] {
  const p = b[s]; if (!p) return [];
  const f = fileOf(s), r = rankOf(s); const out: number[] = [];
  if (p.t === 'p') { const d = p.c === 'w' ? 1 : -1; for (const df of [-1, 1]) if (onBoard(f + df, r + d)) out.push((r + d) * 8 + f + df); }
  else if (p.t === 'n' || p.t === 'k') { for (const [df, dr] of p.t === 'n' ? KNIGHT : KING) if (onBoard(f + df, r + dr)) out.push((r + dr) * 8 + f + df); }
  else for (const [df, dr] of dirsOf(p.t)) { let x = f + df, y = r + dr; while (onBoard(x, y)) { const t = y * 8 + x; out.push(t); if (b[t]) break; x += df; y += dr; } }
  return out;
}
/** Pièces de `by` qui attaquent la case s. */
export function attackers(b: (Piece | null)[], s: number, by: Color): number[] {
  const out: number[] = []; const f = fileOf(s), r = rankOf(s);
  const pd = by === 'w' ? -1 : 1; // un pion blanc attaque vers le haut : il est une rangée plus bas
  for (const df of [-1, 1]) if (onBoard(f + df, r + pd)) { const t = (r + pd) * 8 + f + df; const p = b[t]; if (p && p.c === by && p.t === 'p') out.push(t); }
  for (const [df, dr] of KNIGHT) if (onBoard(f + df, r + dr)) { const t = (r + dr) * 8 + f + df; const p = b[t]; if (p && p.c === by && p.t === 'n') out.push(t); }
  for (const [df, dr] of KING) if (onBoard(f + df, r + dr)) { const t = (r + dr) * 8 + f + df; const p = b[t]; if (p && p.c === by && p.t === 'k') out.push(t); }
  for (const [df, dr] of KING) {
    const diag = df !== 0 && dr !== 0; let x = f + df, y = r + dr;
    while (onBoard(x, y)) { const t = y * 8 + x; const p = b[t]; if (p) { if (p.c === by && (p.t === 'q' || (diag ? p.t === 'b' : p.t === 'r'))) out.push(t); break; } x += df; y += dr; }
  }
  return out;
}
export function kingSq(b: (Piece | null)[], c: Color): number { for (let i = 0; i < 64; i++) { const p = b[i]; if (p && p.t === 'k' && p.c === c) return i; } return -1; }
export function inCheck(b: (Piece | null)[], c: Color) { const k = kingSq(b, c); return k >= 0 && attackers(b, k, opp(c)).length > 0; }

/** Pièces clouées de la couleur c : case clouée → {pinner, target(case derrière), absolute}. */
export function pins(b: (Piece | null)[], c: Color): Map<number, { pinner: number; behind: number; absolute: boolean }> {
  const res = new Map<number, { pinner: number; behind: number; absolute: boolean }>();
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || p.c === c || !slider(p.t)) continue;
    for (const [df, dr] of dirsOf(p.t)) {
      let x = fileOf(s) + df, y = rankOf(s) + dr; let first = -1;
      while (onBoard(x, y)) {
        const t = y * 8 + x; const q = b[t];
        if (q) {
          if (first < 0) { if (q.c !== c || q.t === 'k') break; first = t; }
          else {
            if (q.c === c && (q.t === 'k' || VAL[q.t] > VAL[b[first]!.t])) {
              const absolute = q.t === 'k';
              const prev = res.get(first); if (!prev || absolute) res.set(first, { pinner: s, behind: t, absolute });
            }
            break;
          }
        }
        x += df; y += dr;
      }
    }
  }
  return res;
}

/** Échange statique : gain (en points) pour `side` qui commence les prises sur `s` (≤ 0 : la prise ne rapporte rien). */
export function see(b: (Piece | null)[], s: number, side: Color, firstFrom?: number): number {
  const target = b[s]; if (!target || target.c === side) return 0;
  const bb = b.slice(); let from = firstFrom ?? leastAttacker(bb, s, side);
  if (from < 0) return 0;
  const g: number[] = [target.t === 'k' ? 100 : MAT[target.t]];
  let cur: Color = side;
  for (;;) {
    const att = bb[from]!; bb[s] = att; bb[from] = null; cur = opp(cur);
    from = leastAttacker(bb, s, cur);
    if (from < 0) break;
    g.push((att.t === 'k' ? 100 : MAT[att.t]) - g[g.length - 1]);
  }
  for (let i = g.length - 1; i > 0; i--) g[i - 1] = -Math.max(-g[i - 1], g[i]);
  return g[0];
}
function leastAttacker(b: (Piece | null)[], s: number, by: Color): number {
  let best = -1, bv = 1e9;
  for (const a of attackers(b, s, by)) { const v = VAL[b[a]!.t]; if (v < bv) { bv = v; best = a; } }
  // le roi ne peut prendre que sur une case non défendue
  if (best >= 0 && b[best]!.t === 'k' && attackers(b, s, opp(by)).length) return -1;
  return best;
}
/** Valeur que l'adversaire peut gagner sur la pièce en s (0 si sûre). */
export function threatOn(b: (Piece | null)[], s: number): number {
  const p = b[s]; if (!p) return 0; return Math.max(0, see(b, s, opp(p.c)));
}
/** Copie de l'occupation après un coup (sans validation ; gère roque, prise en passant, promotion). */
export function applyMove(b: (Piece | null)[], from: number, to: number, promo?: Role, ep = -1): (Piece | null)[] {
  const n = b.slice(); const p = n[from]; if (!p) return n;
  if (p.t === 'p' && to === ep && !n[to]) n[to + (p.c === 'w' ? -8 : 8)] = null;
  n[to] = promo ? { c: p.c, t: promo } : p; n[from] = null;
  if (p.t === 'k' && Math.abs(to - from) === 2) { const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1; n[rt] = n[rf]; n[rf] = null; }
  return n;
}
export function materialOf(b: (Piece | null)[], c: Color) { let m = 0; for (const p of b) if (p && p.c === c) m += MAT[p.t]; return m; }
export function balance(b: (Piece | null)[], c: Color) { return materialOf(b, c) - materialOf(b, opp(c)); }
export function nonPawnMat(b: (Piece | null)[], c: Color) { let m = 0; for (const p of b) if (p && p.c === c && p.t !== 'p' && p.t !== 'k') m += MAT[p.t]; return m; }
export function count(b: (Piece | null)[], c: Color | null, t: Role) { let n = 0; for (const p of b) if (p && p.t === t && (c == null || p.c === c)) n++; return n; }
