// Détecteurs de motifs (tactique, structure, roi, finales). Purement symboliques et déterministes :
// le moteur d'explication les confronte ensuite à la ligne de Stockfish (voir explain.ts).
import {
  parseFen as parseFenFn, type Pos, type Piece, type Color, type Role, VAL, MAT, opp, fileOf, rankOf, sqIdx, sqName, onBoard, dist,
  attacksFrom, attackers, kingSq, pins, see, threatOn, applyMove, nonPawnMat, count, KING, slider, dirsOf, inCheck,
} from './geometry';

export type MotifKey =
  | 'mate' | 'backRankMate' | 'smotheredMate' | 'doubleCheck' | 'discoveredCheck' | 'discoveredAttack'
  | 'fork' | 'pin' | 'skewer' | 'hangingCapture' | 'trappedPiece' | 'overload' | 'capturingDefender'
  | 'sacrifice' | 'promotion' | 'check' | 'mateThreat';
export interface Motif { key: MotifKey; by: Color; piece: Role; at: number; targets: number[]; gain: number }
export interface Mv { from: number; to: number; promo?: Role; san?: string }
export const MOTIF_LABEL: Record<MotifKey, string> = {
  mate: 'Échec et mat', backRankMate: 'Mat du couloir', smotheredMate: 'Mat à l’étouffée', doubleCheck: 'Échec double',
  discoveredCheck: 'Échec à la découverte', discoveredAttack: 'Attaque à la découverte', fork: 'Fourchette', pin: 'Clouage',
  skewer: 'Enfilade', hangingCapture: 'Pièce gratuite', trappedPiece: 'Pièce piégée', overload: 'Surcharge',
  capturingDefender: 'Élimination du défenseur', sacrifice: 'Sacrifice', promotion: 'Promotion', check: 'Échec', mateThreat: 'Menace de mat',
};

/** Analyse le coup `m` joué dans `before` (le camp au trait). `mate` : le coup mate (connu via chess.js). */
export function moveMotifs(before: Pos, m: Mv, mate = false): Motif[] {
  const me = before.b[m.from]?.c; if (!me) return [];
  const them = opp(me); const mover = before.b[m.from]!;
  const captured = before.b[m.to] || (mover.t === 'p' && m.to === before.ep ? { c: them, t: 'p' as Role } : null);
  const b = applyMove(before.b, m.from, m.to, m.promo, before.ep);
  const piece = b[m.to]!; const out: Motif[] = [];
  const add = (key: MotifKey, targets: number[], gain: number, at = m.to, pc: Role = piece.t) => out.push({ key, by: me, piece: pc, at, targets, gain });
  const ksq = kingSq(b, them); const checkers = ksq >= 0 ? attackers(b, ksq, me) : [];
  // — mats
  if (mate) {
    add('mate', [ksq], 100);
    const backRank = them === 'w' ? 0 : 7;
    if (rankOf(ksq) === backRank && checkers.some((c) => (b[c]!.t === 'r' || b[c]!.t === 'q') && rankOf(c) === backRank)) {
      const front = rankOf(ksq) + (them === 'w' ? 1 : -1);
      const fl = [-1, 0, 1].map((d) => fileOf(ksq) + d).filter((f) => f >= 0 && f < 8);
      const occ = fl.filter((f) => { const p = b[front * 8 + f]; return p && p.c === them; }).length;
      if (occ >= 2 && fl.every((f) => { const p = b[front * 8 + f]; return (p && p.c === them) || attackers(b, front * 8 + f, me).length > 0; })) add('backRankMate', [ksq], 100);
    }
    if (checkers.length === 1 && b[checkers[0]]!.t === 'n') {
      const nb = KING.map(([df, dr]) => [fileOf(ksq) + df, rankOf(ksq) + dr]).filter(([f, r]) => onBoard(f, r)).map(([f, r]) => r * 8 + f);
      if (nb.every((s) => b[s] && b[s]!.c === them)) add('smotheredMate', [ksq], 100);
    }
  }
  // — échecs
  if (checkers.length >= 2) add('doubleCheck', [ksq], 0);
  const disc = checkers.find((c) => c !== m.to);
  if (disc !== undefined) add('discoveredCheck', [ksq], 0, disc, b[disc]!.t);
  if (checkers.includes(m.to)) add('check', [ksq], 0);
  if (m.promo) add('promotion', [m.to], MAT[m.promo] - 1);
  // — prise gratuite / gagnante
  if (captured) {
    const g = see(before.b, m.to, me, m.from);
    if (g > 0 && (attackers(before.b, m.to, them).length === 0 || g >= 2)) add('hangingCapture', [m.to], g);
  }
  const moverSafe = threatOn(b, m.to) === 0 || (checkers.length > 0 && threatOn(b, m.to) === 0);
  // — fourchette : ≥ 2 cibles rentables attaquées par la pièce qui vient de bouger, elle-même sûre
  if (moverSafe) {
    const targets: number[] = []; let gains: number[] = [];
    for (const t of attacksFrom(b, m.to)) {
      const p = b[t]; if (!p || p.c !== them) continue;
      if (p.t === 'k') { targets.push(t); gains.push(0); continue; }
      const g = see(b, t, me, m.to);
      const def = attackers(b, t, them).length;
      if (VAL[p.t] > VAL[piece.t] || (def === 0 && g > 0)) { targets.push(t); gains.push(Math.max(g, VAL[p.t] - VAL[piece.t])); }
    }
    if (targets.length >= 2) { gains = gains.sort((a, z) => z - a); add('fork', targets, gains[1] || gains[0]); }
  }
  // — clouage créé par la pièce qui bouge
  if (slider(piece.t)) {
    const pb = pins(before.b, them); const pa = pins(b, them);
    for (const [s, info] of pa) {
      if (info.pinner !== m.to || pb.get(s)?.pinner === m.to) continue;
      const pinned = b[s]!; const behind = b[info.behind]!;
      if (!info.absolute && VAL[behind.t] <= VAL[piece.t]) continue; // clouage relatif sans enjeu
      if (!info.absolute && VAL[pinned.t] >= VAL[behind.t]) continue;
      add('pin', [s, info.behind], info.absolute ? MAT[pinned.t] : VAL[behind.t] - VAL[pinned.t]);
    }
    // — enfilade : pièce de valeur attaquée qui doit s'écarter, une autre derrière
    for (const [df, dr] of dirsOf(piece.t)) {
      let x = fileOf(m.to) + df, y = rankOf(m.to) + dr; let first = -1;
      while (onBoard(x, y)) {
        const t = y * 8 + x; const q = b[t];
        if (q) {
          if (first < 0) { if (q.c !== them) break; first = t; }
          else {
            if (q.c === them && q.t !== 'k') {
              const A = b[first]!; const forced = A.t === 'k' || (VAL[A.t] > VAL[piece.t] && (A.t === 'q' || A.t === 'r'));
              if (forced && VAL[A.t] > VAL[q.t]) {
                const nb = b.slice(); nb[first] = null; const g = see(nb, t, me, m.to);
                if (g > 0 && moverSafe) add('skewer', [first, t], g);
              }
            }
            break;
          }
        }
        x += df; y += dr;
      }
    }
  }
  // — exploitation d'un clouage : on attaque une pièce clouée (elle ne peut pas fuir)
  {
    const pa = pins(b, them);
    for (const t of attacksFrom(b, m.to)) {
      const info = pa.get(t); if (!info || info.pinner === m.to) continue;
      const q = b[t]!; if (VAL[q.t] <= VAL[piece.t] && attackers(b, t, them).length) { if (see(b, t, me, m.to) <= 0) continue; }
      if (!out.some((o) => o.key === 'pin')) add('pin', [t, info.behind], Math.max(0, see(b, t, me, m.to)));
    }
  }
  // — défenseur cloué : une pièce adverse qui pourrait reprendre / parer est clouée
  {
    const pa = pins(b, them);
    const between = (a: number, z: number) => { const out: number[] = []; const df = Math.sign(fileOf(z) - fileOf(a)), dr = Math.sign(rankOf(z) - rankOf(a)); if (df && dr && Math.abs(fileOf(z) - fileOf(a)) !== Math.abs(rankOf(z) - rankOf(a))) return out; if (!df && !dr) return out; let x = fileOf(a) + df, y = rankOf(a) + dr; while (x !== fileOf(z) || y !== rankOf(z)) { out.push(y * 8 + x); x += df; y += dr; } return out; };
    const key = new Set<number>([m.to]); if (checkers.length === 1 && slider(b[checkers[0]]!.t)) for (const q of between(checkers[0], ksq)) key.add(q);
    if (checkers.length) key.add(checkers[0]);
    for (const [ps, info] of pa) {
      if (!info.absolute || out.some((o) => o.key === 'pin')) continue;
      const blockers = attacksFrom(b, ps).filter((t) => key.has(t)).concat(b[ps]!.t === 'p' ? [...key].filter((t) => fileOf(t) === fileOf(ps) && Math.abs(rankOf(t) - rankOf(ps)) === 1 && !b[t]) : []);
      if (!blockers.length) continue;
      // la pièce clouée ne peut pas utiliser ces cases (hors de la ligne du clouage)
      const line = new Set([...between(info.pinner, info.behind), info.pinner]);
      if (blockers.some((t) => !line.has(t))) add('pin', [ps, info.behind], mate ? 100 : 0, info.pinner, b[info.pinner]!.t);
    }
  }
  // — attaque à la découverte : une ligne s'ouvre à travers la case de départ
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || p.c !== me || !slider(p.t) || s === m.to) continue;
    for (const [df, dr] of dirsOf(p.t)) {
      let x = fileOf(s) + df, y = rankOf(s) + dr; let through = false;
      while (onBoard(x, y)) {
        const t = y * 8 + x; if (t === m.from) through = true;
        const q = b[t];
        if (q) {
          if (through && q.c === them && q.t !== 'k' && !out.some((o) => o.key === 'discoveredCheck')) {
            const g = see(b, t, me, s);
            if (g >= 2 || (VAL[q.t] > VAL[p.t] && VAL[q.t] >= 5)) add('discoveredAttack', [t], Math.max(g, VAL[q.t] - VAL[p.t]), s, p.t);
          }
          break;
        }
        x += df; y += dr;
      }
    }
  }
  // — élimination du défenseur : la pièce prise défendait seule une autre pièce, désormais gagnable
  if (captured) {
    for (let t = 0; t < 64; t++) {
      const q = before.b[t]; if (!q || q.c !== them || t === m.to || q.t === 'k') continue;
      const defs = attackers(before.b, t, them);
      if (defs.length === 1 && defs[0] === m.to && attackers(before.b, t, me).length && see(before.b, t, me) <= 0) {
        // après la reprise éventuelle, la cible tombe-t-elle ?
        if (see(b, t, me) > 0) add('capturingDefender', [m.to, t], MAT[q.t]);
      }
    }
  }
  // — sacrifice : la pièce jouée peut être prise avec profit
  const loss = threatOn(b, m.to) - (captured ? MAT[captured.t] : 0);
  if (piece.t !== 'k' && threatOn(b, m.to) >= 2 && loss >= 2) add('sacrifice', [m.to], -loss);
  // — pièce piégée : une pièce adverse attaquée n'a plus de case sûre
  for (const t of attacksFrom(b, m.to)) {
    const q = b[t]; if (!q || q.c !== them || MAT[q.t] < 3 || q.t === 'k') continue;
    if (see(b, t, me) <= 0 && attackers(b, t, them).length) continue;
    if (isTrapped(b, t)) add('trappedPiece', [t], MAT[q.t]);
  }
  return dedupe(out);
}
function dedupe(a: Motif[]) { const seen = new Set<string>(); return a.filter((x) => { const k = x.key + x.targets.join(','); return seen.has(k) ? false : (seen.add(k), true); }); }

/** La pièce en s n'a aucune case de repli sûre (et elle est attaquée). */
export function isTrapped(b: (Piece | null)[], s: number): boolean {
  const p = b[s]; if (!p) return false;
  if (threatOn(b, s) <= 0 || inCheck(b, p.c) || pins(b, p.c).get(s)?.absolute) return false;
  for (const t of attacksFrom(b, s)) {
    if (p.t === 'p') break;
    const q = b[t]; if (q && q.c === p.c) continue;
    const nb = applyMove(b, s, t); if (inCheck(nb, p.c)) continue;
    const gainCap = q ? MAT[q.t] : 0;
    if (threatOn(nb, t) - gainCap <= 0) return false;
  }
  return true;
}
/** Pièces de c en prise (gain SEE de l'adversaire > 0). */
export function hanging(b: (Piece | null)[], c: Color): { sq: number; t: Role; gain: number }[] {
  const out: { sq: number; t: Role; gain: number }[] = [];
  for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || p.c !== c || p.t === 'k') continue; const g = threatOn(b, s); if (g > 0) out.push({ sq: s, t: p.t, gain: g }); }
  return out.sort((a, z) => z.gain - a.gain);
}
/** Défenseurs surchargés de c : seule protection d'au moins deux pièces attaquées. */
export function overloaded(b: (Piece | null)[], c: Color): { def: number; targets: number[] }[] {
  const by = new Map<number, number[]>();
  for (let t = 0; t < 64; t++) {
    const p = b[t]; if (!p || p.c !== c || p.t === 'k') continue;
    if (!attackers(b, t, opp(c)).length) continue;
    const d = attackers(b, t, c); if (d.length !== 1) continue;
    const nb = b.slice(); const dp = nb[d[0]]; nb[d[0]] = null;
    if (see(nb, t, opp(c)) > 0) { nb[d[0]] = dp; (by.get(d[0]) || by.set(d[0], []).get(d[0])!).push(t); }
  }
  return [...by].filter(([, ts]) => ts.length >= 2).map(([def, targets]) => ({ def, targets }));
}

// ———————————— traits statiques (structure, roi, développement, activité) ————————————
export interface PawnInfo { isolated: number[]; doubled: number[]; passed: number[]; backward: number[]; protectedPassed: number[] }
export function pawnInfo(b: (Piece | null)[], c: Color): PawnInfo {
  const mine: number[] = [], theirs: number[] = [];
  for (let s = 0; s < 64; s++) { const p = b[s]; if (p?.t === 'p') (p.c === c ? mine : theirs).push(s); }
  const fwd = c === 'w' ? 1 : -1;
  const filesMine = (f: number) => mine.filter((s) => fileOf(s) === f);
  const res: PawnInfo = { isolated: [], doubled: [], passed: [], backward: [], protectedPassed: [] };
  for (const s of mine) {
    const f = fileOf(s), r = rankOf(s);
    const adj = [f - 1, f + 1].filter((x) => x >= 0 && x < 8);
    if (!adj.some((x) => filesMine(x).length)) res.isolated.push(s);
    if (filesMine(f).length > 1) res.doubled.push(s);
    const ahead = (rr: number) => (c === 'w' ? rr > r : rr < r);
    const passed = !theirs.some((t) => Math.abs(fileOf(t) - f) <= 1 && ahead(rankOf(t)));
    if (passed && !filesMine(f).some((t) => ahead(rankOf(t)))) {
      res.passed.push(s);
      if (adj.some((x) => mine.includes((r - fwd) * 8 + x))) res.protectedPassed.push(s);
    }
    // arriéré : aucun pion voisin à sa hauteur ou derrière, case d'avance contrôlée par un pion adverse
    if (!res.isolated.includes(s) && !passed) {
      const support = adj.some((x) => mine.some((t) => fileOf(t) === x && (c === 'w' ? rankOf(t) <= r : rankOf(t) >= r)));
      const stop = (r + fwd) * 8 + f;
      if (!support && onBoard(f, r + fwd) && attackers(b, stop, opp(c)).some((a) => b[a]!.t === 'p')) res.backward.push(s);
    }
  }
  return res;
}
export interface KingInfo { sq: number; shield: number; openFiles: number; zoneAttackers: number; castled: boolean; canCastle: boolean; exposed: boolean }
export function kingInfo(pos: Pos, c: Color): KingInfo {
  const b = pos.b; const k = kingSq(b, c); const f = fileOf(k), r = rankOf(k); const fwd = c === 'w' ? 1 : -1;
  let shield = 0, openFiles = 0;
  for (const x of [f - 1, f, f + 1]) {
    if (x < 0 || x > 7) continue;
    for (const d of [1, 2]) { const y = r + fwd * d; if (onBoard(x, y)) { const p = b[y * 8 + x]; if (p && p.c === c && p.t === 'p') { shield++; break; } } }
    let own = false; for (let y = 0; y < 8; y++) { const p = b[y * 8 + x]; if (p?.t === 'p' && p.c === c) own = true; }
    if (!own) openFiles++;
  }
  const zone = new Set<number>([k]); for (const [df, dr] of KING) if (onBoard(f + df, r + dr)) zone.add((r + dr) * 8 + f + df);
  const atk = new Set<number>(); for (const z of zone) for (const a of attackers(b, z, opp(c))) if (b[a]!.t !== 'p' && b[a]!.t !== 'k') atk.add(a);
  const home = c === 'w' ? 0 : 7;
  const castled = r === home && (f >= 6 || f <= 2);
  const canCastle = c === 'w' ? /[KQ]/.test(pos.castling) : /[kq]/.test(pos.castling);
  const queens = count(b, opp(c), 'q') > 0;
  const exposed = nonPawnMat(b, opp(c)) >= 10 && (shield <= 1 || openFiles >= 2 || atk.size >= 3) && (queens || atk.size >= 2) && !(r === home && shield >= 2);
  return { sq: k, shield, openFiles, zoneAttackers: atk.size, castled, canCastle, exposed };
}
export function undeveloped(b: (Piece | null)[], c: Color): number {
  const home = c === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8'];
  return home.filter((n) => { const p = b[sqIdx(n)]; return p && p.c === c && (p.t === 'n' || p.t === 'b'); }).length;
}
export function outposts(b: (Piece | null)[], c: Color): number[] {
  const out: number[] = []; const fwd = c === 'w' ? 1 : -1;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || p.c !== c || (p.t !== 'n' && p.t !== 'b')) continue;
    const rr = c === 'w' ? rankOf(s) : 7 - rankOf(s); if (rr < 3 || rr > 5) continue;
    const supported = attackers(b, s, c).some((a) => b[a]!.t === 'p'); if (!supported) continue;
    const f = fileOf(s);
    const canBeHit = [f - 1, f + 1].some((x) => { if (x < 0 || x > 7) return false; for (let y = rankOf(s) + fwd; y >= 0 && y < 8; y += fwd) { const q = b[y * 8 + x]; if (q?.t === 'p' && q.c !== c) return true; } return false; });
    if (!canBeHit) out.push(s);
  }
  return out;
}
export function mobility(b: (Piece | null)[], c: Color): number {
  let n = 0; for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || p.c !== c || p.t === 'p' || p.t === 'k') continue; for (const t of attacksFrom(b, s)) if (!b[t] || b[t]!.c !== c) n++; } return n;
}
export function rooksOpenFiles(b: (Piece | null)[], c: Color): number {
  let n = 0;
  for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || p.c !== c || p.t !== 'r') continue; let own = false; for (let y = 0; y < 8; y++) { const q = b[y * 8 + fileOf(s)]; if (q?.t === 'p' && q.c === c) own = true; } if (!own) n++; }
  return n;
}
export interface Features { pawns: PawnInfo; king: KingInfo; undeveloped: number; outposts: number[]; mobility: number; rooksOpen: number; material: number }
export function features(pos: Pos, c: Color): Features {
  let m = 0; for (const p of pos.b) if (p) m += (p.c === c ? 1 : -1) * MAT[p.t];
  return { pawns: pawnInfo(pos.b, c), king: kingInfo(pos, c), undeveloped: undeveloped(pos.b, c), outposts: outposts(pos.b, c), mobility: mobility(pos.b, c), rooksOpen: rooksOpenFiles(pos.b, c), material: m };
}

// ———————————— finales ————————————
export type EndgameKind = 'pawn' | 'rook' | 'minor' | 'queen' | 'mixed' | null;
export function endgameKind(b: (Piece | null)[]): EndgameKind {
  const np = nonPawnMat(b, 'w') + nonPawnMat(b, 'b'); if (np > 26) return null;
  const has = (t: Role) => count(b, null, t) > 0;
  if (np === 0) return 'pawn';
  if (has('q') && !has('r') && !has('b') && !has('n')) return 'queen';
  if (has('r') && !has('q') && !has('b') && !has('n')) return 'rook';
  if (!has('q') && !has('r')) return 'minor';
  return 'mixed';
}
/** Opposition : finale de pions, rois sur la même colonne (ou rangée) séparés d'une case ; le camp qui ne joue pas l'a. */
export function opposition(pos: Pos): { holder: Color; kind: 'direct' | 'distant' } | null {
  if (endgameKind(pos.b) !== 'pawn') return null;
  const a = kingSq(pos.b, 'w'), z = kingSq(pos.b, 'b');
  const df = Math.abs(fileOf(a) - fileOf(z)), dr = Math.abs(rankOf(a) - rankOf(z));
  const holder = opp(pos.turn);
  if ((df === 0 && dr === 2) || (dr === 0 && df === 2)) return { holder, kind: 'direct' };
  if ((df === 0 && (dr === 4 || dr === 6)) || (dr === 0 && (df === 4 || df === 6))) return { holder, kind: 'distant' };
  return null;
}
/** Règle du carré : pour chaque pion passé sans pièces sur l'échiquier, le roi adverse rattrape-t-il le pion ? */
export function squareRule(pos: Pos): { pawn: number; color: Color; caught: boolean }[] {
  if (endgameKind(pos.b) !== 'pawn') return [];
  const out: { pawn: number; color: Color; caught: boolean }[] = [];
  for (const c of ['w', 'b'] as Color[]) {
    const k = kingSq(pos.b, opp(c));
    for (const s of pawnInfo(pos.b, c).passed) {
      const promo = (c === 'w' ? 7 : 0) * 8 + fileOf(s);
      let steps = Math.abs(rankOf(promo) - rankOf(s)); if ((c === 'w' && rankOf(s) === 1) || (c === 'b' && rankOf(s) === 6)) steps--;
      const kd = dist(k, promo) - (pos.turn === opp(c) ? 1 : 0);
      out.push({ pawn: s, color: c, caught: kd <= steps });
    }
  }
  return out;
}
/** Finales tour + pion contre tour : Lucena (côté fort) ou Philidor (côté faible). */
export function rookPawnPattern(pos: Pos): { kind: 'lucena' | 'philidor'; strong: Color } | null {
  const b = pos.b; if (endgameKind(b) !== 'rook') return null;
  for (const c of ['w', 'b'] as Color[]) {
    const d = opp(c);
    if (count(b, c, 'r') !== 1 || count(b, d, 'r') !== 1 || count(b, c, 'p') !== 1 || count(b, d, 'p') !== 0) continue;
    const ps = b.findIndex((p) => p?.t === 'p' && p.c === c); const rel = c === 'w' ? rankOf(ps) : 7 - rankOf(ps);
    const ks = kingSq(b, c), kd = kingSq(b, d); const promo = (c === 'w' ? 7 : 0) * 8 + fileOf(ps);
    if (rel === 6 && (ks === promo || dist(ks, promo) === 1 && fileOf(ks) === fileOf(ps)) && Math.abs(fileOf(kd) - fileOf(ps)) >= 2) return { kind: 'lucena', strong: c };
    const rd = b.findIndex((p) => p?.t === 'r' && p.c === d); const rdRel = d === 'w' ? rankOf(rd) : 7 - rankOf(rd);
    const kdRel = d === 'w' ? rankOf(kd) : 7 - rankOf(kd);
    if (rel <= 4 && Math.abs(fileOf(kd) - fileOf(ps)) <= 1 && kdRel <= 1 && rdRel === 2) return { kind: 'philidor', strong: c };
  }
  return null;
}
export { sqName, sqIdx };

// ———————————— vérification sur la ligne du moteur ————————————
const MATERIAL_MOTIFS: MotifKey[] = ['fork', 'pin', 'skewer', 'discoveredAttack', 'trappedPiece', 'overload', 'capturingDefender', 'hangingCapture'];
/**
 * Garde seulement les motifs que la ligne `line` (UCI, commence par le coup analysé) réalise vraiment :
 * mat sur la ligne, ou prise d'une cible du motif par le camp qui l'a joué, avec un bilan matériel positif.
 * `apply(fen, uci)` doit renvoyer la FEN suivante (ou null) et `isMate(fen)` si le camp au trait est maté.
 */
export function verifyOnLine(motifs: Motif[], fen: string, line: string[], apply: (fen: string, uci: string) => string | null, isMate: (fen: string) => boolean, horizon = 7): { verified: Motif[]; mate: boolean; gain: number } {
  const me = parseFenTurn(fen); let f = fen; let mate = false;
  const startBal = balanceFen(fen, me); let best = -99; const captured = new Set<number>();
  const fens: string[] = [];
  for (let k = 0; k < Math.min(horizon, line.length); k++) {
    const u = line[k]; const pos = parseFenLite(f); const to = sqIdx(u.slice(2, 4));
    if (k % 2 === 0 && pos[to] && pos[to]!.c !== me) captured.add(to);
    // une cible qui fuit puis est prise ailleurs : on suit la pièce
    const nf = apply(f, u); if (!nf) break; f = nf; fens.push(f);
    if (k % 2 === 0) best = Math.max(best, balanceFen(f, me) - startBal);
    if (isMate(f)) { mate = k % 2 === 0; break; }
  }
  const endBal = balanceFen(f, me) - startBal;
  const gain = mate ? 100 : Math.min(best, endBal + (line.length > horizon ? 0 : 0));
  const isMateMove = motifs.some((x) => x.key === 'mate');
  const verified = motifs.filter((x) => {
    if (!MATERIAL_MOTIFS.includes(x.key)) return true;
    // dans une ligne de mat, un motif matériel n'est retenu que si sa cible tombe avant le mat
    if (mate) return !isMateMove && x.key !== 'hangingCapture' ? x.targets.some((t) => captured.has(t)) && x.targets.some((t) => parseFenLite(fen)[t]?.t !== 'k') : x.key === 'hangingCapture' && !isMateMove;
    const hit = x.targets.some((t) => captured.has(t)) || capturedFled(x, fen, line, me);
    return hit && endBal >= 1;
  });
  return { verified, mate, gain };
}
function capturedFled(x: Motif, fen: string, line: string[], me: Color): boolean {
  // la cible a bougé (ex. roi en échec, pièce qui fuit) : on regarde si une pièce de ce type est prise ensuite
  const pos = parseFenLite(fen); const types = new Set(x.targets.map((t) => pos[t]?.t).filter(Boolean));
  let b = pos;
  for (let k = 0; k < Math.min(7, line.length); k++) {
    const u = line[k]; const from = sqIdx(u.slice(0, 2)), to = sqIdx(u.slice(2, 4));
    if (k % 2 === 0 && k > 0 && b[to] && b[to]!.c !== me && types.has(b[to]!.t) && b[to]!.t !== 'p') return true;
    b = applyMove(b, from, to, (u[4] as Role) || undefined);
  }
  return false;
}
function parseFenTurn(fen: string): Color { return (fen.split(' ')[1] || 'w') as Color; }
const lite = new Map<string, (Piece | null)[]>();
function parseFenLite(fen: string) { let b = lite.get(fen); if (!b) { b = parseFenBoard(fen); if (lite.size > 500) lite.clear(); lite.set(fen, b); } return b; }
function parseFenBoard(fen: string): (Piece | null)[] { return (parseFenFn(fen)).b; }
function balanceFen(fen: string, c: Color) { const b = parseFenLite(fen); let m = 0; for (const p of b) if (p) m += (p.c === c ? 1 : -1) * MAT[p.t]; return m; }
