// Thèmes tactiques lus sur une LIGNE complète (coup déclencheur + suite du moteur), et non sur un coup isolé.
// Format « puzzle » : moves[0] = coup qui crée l'occasion (souvent l'erreur de l'adversaire), puis le camp `pov`
// joue moves[1], moves[3]… Définitions inspirées des conventions de classement des puzzles Lichess (CC0),
// réécrites ici et appliquées aux lignes de Stockfish : un thème n'est annoncé que s'il se produit sur la ligne.
import { Chess } from 'chess.js';
import { parseFen, type Piece, type Role, type Color, opp, attackers, attacksFrom, kingSq, pins, applyMove, fileOf, rankOf, onBoard, slider, MAT } from './geometry';

export type ThemeKey = 'fork' | 'pin' | 'skewer' | 'discoveredAttack' | 'discoveredCheck' | 'doubleCheck' | 'hangingPiece' | 'trappedPiece'
  | 'backRankMate' | 'deflection' | 'attraction' | 'xRayAttack' | 'capturingDefender' | 'overload';
export interface Theme { key: ThemeKey; ply: number; sq: number[]; piece?: Role }
type B = (Piece | null)[];
interface Mv { from: number; to: number; promo?: Role; piece: Role; captured: Role | null; castle: boolean }

const V: Record<Role, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const idx = (s: string) => (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 8;
export function between(a: number, z: number): number[] {
  const df = Math.sign(fileOf(z) - fileOf(a)), dr = Math.sign(rankOf(z) - rankOf(a));
  const ax = Math.abs(fileOf(z) - fileOf(a)), ay = Math.abs(rankOf(z) - rankOf(a));
  if ((ax && ay && ax !== ay) || (!ax && !ay)) return [];
  const out: number[] = []; let x = fileOf(a) + df, y = rankOf(a) + dr;
  while (x !== fileOf(z) || y !== rankOf(z)) { out.push(y * 8 + x); x += df; y += dr; }
  return out;
}
/** Défendue, y compris en rayons X (un défenseur caché derrière l'attaquant à longue portée). */
export function isDefended(b: B, sq: number): boolean {
  const p = b[sq]; if (!p) return false;
  if (attackers(b, sq, p.c).length) return true;
  for (const a of attackers(b, sq, opp(p.c))) { if (!slider(b[a]!.t)) continue; const nb = b.slice(); nb[a] = null; if (attackers(nb, sq, p.c).length) return true; }
  return false;
}
export const isHanging = (b: B, sq: number) => !isDefended(b, sq);
function takenByLower(b: B, sq: number) { const p = b[sq]!; return attackers(b, sq, opp(p.c)).some((a) => b[a]!.t !== 'k' && V[b[a]!.t] < V[p.t]); }
/** Attaquée et (non défendue ou prenable par une pièce de moindre valeur). */
export function inBadSpot(b: B, sq: number) { const p = b[sq]; return !!p && attackers(b, sq, opp(p.c)).length > 0 && (isHanging(b, sq) || takenByLower(b, sq)); }
const inCheck = (b: B, c: Color) => { const k = kingSq(b, c); return k >= 0 && attackers(b, k, opp(c)).length > 0; };
const absPins = (b: B, c: Color) => { const out = new Map<number, number>(); for (const [s, i] of pins(b, c)) if (i.absolute) out.set(s, i.pinner); return out; };
/** La pièce en sq (camp au trait) est attaquée et n'a aucune case de repli sûre. */
export function isTrappedAt(fen: string, sq: number): boolean {
  const pos = parseFen(fen); const b = pos.b; const p = b[sq]; if (!p || p.c !== pos.turn || p.t === 'p' || p.t === 'k') return false;
  if (inCheck(b, p.c) || absPins(b, p.c).has(sq)) return false;
  if (!inBadSpot(b, sq)) return false;
  let ms: any[]; try { ms = new Chess(fen).moves({ square: 'abcdefgh'[sq & 7] + ((sq >> 3) + 1) as any, verbose: true }); } catch { return false; }
  for (const m of ms) {
    const to = idx(m.to); const cap = b[to]; if (cap && V[cap.t] >= V[p.t]) return false;
    const nb = applyMove(b, sq, to, m.promotion); if (!inBadSpot(nb, to)) return false;
  }
  return true;
}
const matDiff = (b: B, c: Color) => { let m = 0; for (const p of b) if (p) m += (p.c === c ? 1 : -1) * MAT[p.t]; return m; };

/** Thèmes réalisés sur la ligne. `moves` en UCI ; si `setup` est faux, moves[0] est déjà un coup du camp pov. */
export function lineThemes(fen: string, moves: string[], setup = true): Theme[] {
  const ch = new Chess(fen); const F: string[] = [fen]; const P: B[] = [parseFen(fen).b]; const M: Mv[] = [];
  const list = setup ? moves : ['', ...moves];
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u) { // coup fictif : on garde la position (sert seulement d'ancrage aux indices)
      M.push({ from: -1, to: -1, piece: 'p', captured: null, castle: false }); F.push(F[F.length - 1]); P.push(P[P.length - 1]); continue;
    }
    let r: any; try { r = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    M.push({ from: idx(r.from), to: idx(r.to), promo: r.promotion, piece: r.piece, captured: r.captured || null, castle: r.flags.includes('k') || r.flags.includes('q') });
    F.push(ch.fen()); P.push(parseFen(ch.fen()).b);
  }
  const n = M.length; if (n < 2) return [];
  const pov: Color = parseFen(F[1]).turn; const them = opp(pov);
  const out: Theme[] = []; const add = (key: ThemeKey, ply: number, sq: number[], piece?: Role) => { if (!out.some((t) => t.key === key)) out.push({ key, ply, sq, piece }); };
  const mateEnd = (() => { try { return new Chess(F[n]).isCheckmate(); } catch { return false; } })();
  const player = (from: number) => { const a: number[] = []; for (let i = from; i < n; i += 2) a.push(i); return a; };

  for (const i of player(1)) {
    const m = M[i]; const b = P[i + 1];
    // échecs à la découverte / doubles
    const k = kingSq(b, them); const checkers = k >= 0 ? attackers(b, k, pov) : [];
    if (checkers.length >= 2) add('doubleCheck', i, [k]);
    if (checkers.some((c) => c !== m.to)) add('discoveredCheck', i, [k, checkers.find((c) => c !== m.to)!]);
    // fourchette (pas sur le dernier coup du camp)
    if (i < n - 1 && m.piece !== 'k' && !inBadSpot(b, m.to)) {
      const tg = attacksFrom(b, m.to).filter((t) => { const q = b[t]; if (!q || q.c !== them || q.t === 'p') return false; return V[q.t] > V[m.piece] || (isHanging(b, t) && !attackers(b, m.to, them).includes(t)); });
      if (tg.length > 1) add('fork', i, [m.to, ...tg], m.piece);
    }
    // clouage : la pièce clouée ne peut ni fuir ni attaquer
    for (const [ps, pinner] of absPins(b, them)) {
      const line = new Set([...between(kingSq(b, them), pinner), pinner]); const pp = b[ps]!;
      const blocksAttack = attacksFrom(b, ps).some((t) => { const q = b[t]; return q && q.c === pov && !line.has(t) && (V[q.t] > V[pp.t] || isHanging(b, t)); });
      const cantEscape = attackers(b, ps, pov).some((a) => line.has(a) && (V[pp.t] > V[b[a]!.t] || (isHanging(b, ps) && !attacksFrom(b, ps).includes(a) && hasMoveOff(F[i + 1], ps, line))));
      if (blocksAttack || cantEscape) { add('pin', i, [ps, pinner, kingSq(b, them)], pp.t); break; }
    }
    if (i < 3) continue;
    const prev = M[i - 1], mine = M[i - 2];
    // enfilade : la pièce de valeur s'écarte de la ligne, on prend celle de derrière
    if (m.captured && slider(m.piece) && !(i === n - 1 && mateEnd)) {
      const btw = between(m.from, m.to);
      if (prev.to !== m.to && btw.includes(prev.from) && V[prev.piece] > V[m.captured] && inBadSpot(P[i], m.to)) add('skewer', i, [prev.from, m.to], m.piece);
    }
    // attaque à la découverte : notre coup précédent a ouvert la ligne de la prise
    if (m.captured && prev.to !== m.to && between(m.from, m.to).includes(mine.from) && m.to !== mine.to && m.from !== mine.to && !mine.castle) add('discoveredAttack', i, [m.from, m.to], m.piece);
    // rayons X : prise, reprise, et on reprend à travers la case libérée
    if (m.captured && prev.to === m.to && prev.piece !== 'k' && mine.to === prev.to && between(m.from, m.to).includes(prev.from)) add('xRayAttack', i, [m.from, m.to], m.piece);
    // pièce piégée puis prise
    if (m.captured && m.captured !== 'p') { const sq = prev.to === m.to ? prev.from : m.to; if (isTrappedAt(F[i - 1], sq)) add('trappedPiece', i, [sq], m.captured); }
    // déviation : le défenseur a été détourné (il a pris notre appât ou paré un échec) et ne garde plus la case
    if (m.captured || m.promo) {
      const bait = P[i - 2][mine.to];
      const sac = !bait || V[bait.t] < V[mine.piece];
      if (sac && m.to !== prev.to && m.to !== mine.to && (prev.to === mine.to || inCheck(P[i - 1], them))
        && (attacksFrom(P[i - 1], prev.from).includes(m.to) || (!!m.promo && fileOf(m.to) === fileOf(prev.from) && attacksFrom(P[i - 1], prev.from).includes(m.from))) && !attacksFrom(P[i], prev.to).includes(m.to)) add('deflection', i, [prev.to, m.to], prev.piece);
    }
    // élimination du défenseur : on prend la pièce qui gardait une cible, puis la cible
    if (m.captured && prev.to !== m.to && mine.captured && mine.to !== m.to && !M.slice(0, i).some((x, j) => j % 2 === 0 && x.to === m.to)) {
      const defBoard = P[i - 2]; const def = defBoard[mine.to];
      if (def && def.t !== 'k' && attacksFrom(defBoard, mine.to).includes(m.to) && isHanging(P[i], m.to) && !isHanging(defBoard, m.to)) add('capturingDefender', i, [mine.to, m.to], def.t);
    }
  }
  // attraction : on attire roi/dame/tour sur une case, puis on l'y attaque (échec) ou on la gagne
  for (const i of player(1)) {
    const r = M[i + 1], nx = M[i + 2]; if (!r || !nx || r.to !== M[i].to || !['k', 'q', 'r'].includes(r.piece)) continue;
    if (!attackers(P[i + 3], r.to, pov).includes(nx.to)) continue;
    if (r.piece === 'k' || M[i + 4]?.to === r.to) add('attraction', i, [r.to], r.piece);
  }
  // surcharge : une pièce adverse garde deux cibles ; on en prend une, elle reprend, l'autre tombe
  for (const i of player(1)) {
    const r = M[i + 1], nx = M[i + 2]; if (!r || !nx || !M[i].captured || r.to !== M[i].to || !nx.captured || nx.to === r.to) continue;
    const b0 = P[i]; const d = b0[r.from]; if (!d || d.t === 'k') continue;
    if (attacksFrom(b0, r.from).includes(nx.to) && attackers(b0, nx.to, them).length === 1 && MAT[nx.captured] >= 3) add('overload', i, [r.from, M[i].to, nx.to], d.t);
  }
  // mat du couloir
  if (mateEnd) {
    const b = P[n]; const k = kingSq(b, them); const back = them === 'w' ? 0 : 7;
    if (rankOf(k) === back) {
      const fr = back === 0 ? 1 : 6; const sqs = [-1, 0, 1].map((d) => fileOf(k) + d).filter((f) => onBoard(f, fr)).map((f) => fr * 8 + f);
      const blocked = sqs.every((s) => { const q = b[s]; return q && q.c === them && !attackers(b, s, pov).length; });
      if (blocked && attackers(b, k, pov).some((c) => rankOf(c) === back)) add('backRankMate', n - 1, [k]);
    }
  }
  // un échec à la découverte simple (pas un échec double) est aussi une attaque à la découverte
  if (!out.some((t) => t.key === 'doubleCheck') && out.some((t) => t.key === 'discoveredCheck')) add('discoveredAttack', out.find((t) => t.key === 'discoveredCheck')!.ply, []);
  // pièce en prise : le premier coup prend une pièce non défendue (pas un simple échange) et l'avantage tient
  {
    const m = M[1]; const cap = P[1][m.to];
    const checked = inCheck(P[1], pov);
    if (cap && cap.t !== 'p' && !(checked) && isHanging(P[1], m.to)) {
      const op = M[0]; const opCap = op && op.from >= 0 ? P[0][op.to] : null;
      const trade = opCap && V[opCap.t] >= V[cap.t] && op.to === m.to;
      if (!trade && (n < 4 || matDiff(P[4], pov) >= matDiff(P[2], pov))) add('hangingPiece', 1, [m.to], cap.t);
    }
  }
  return out;
}
function hasMoveOff(fen: string, sq: number, line: Set<number>): boolean {
  // coups pseudo-légaux de la pièce clouée hors de la ligne (elle « voudrait » fuir)
  const pos = parseFen(fen); const p = pos.b[sq]; if (!p) return false;
  if (p.t === 'p') { const d = p.c === 'w' ? 8 : -8; const t = sq + d; return (t >= 0 && t < 64 && !pos.b[t] && !line.has(t)) || attacksFrom(pos.b, sq).some((x) => pos.b[x] && pos.b[x]!.c !== p.c && !line.has(x)); }
  return attacksFrom(pos.b, sq).some((t) => !line.has(t) && (!pos.b[t] || pos.b[t]!.c !== p.c));
}
