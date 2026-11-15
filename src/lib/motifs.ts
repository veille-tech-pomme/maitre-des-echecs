// Détection de motifs tactiques et de principes, pour expliquer « pourquoi » en français.
import { Chess, VALUES, PIECE_ART, PIECE_NAME, type Square, type Move, type Color, type PieceSymbol } from './chess';

const DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
const sq = (f: number, r: number) => ('abcdefgh'[f] + (r + 1)) as Square;
const fr = (s: string) => [s.charCodeAt(0) - 97, +s[1] - 1];
const val = (t: PieceSymbol) => (t === 'k' ? 100 : VALUES[t]);
const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function attackersOf(ch: Chess, s: Square, by: Color): Square[] {
  try { return (ch as any).attackers(s, by) as Square[]; } catch { return []; }
}
/** Pièces de `color` attaquées par l'adversaire et insuffisamment défendues. */
export function hangingPieces(ch: Chess, color: Color) {
  const out: { square: Square; type: PieceSymbol; gain: number }[] = [];
  for (const row of ch.board()) for (const p of row) {
    if (!p || p.color !== color || p.type === 'k') continue;
    const atk = attackersOf(ch, p.square, opp(color));
    if (!atk.length) continue;
    const def = attackersOf(ch, p.square, color);
    const minAtk = Math.min(...atk.map((a) => val(ch.get(a)!.type)));
    const gain = def.length === 0 ? VALUES[p.type] : VALUES[p.type] - minAtk;
    if (gain > 0) out.push({ square: p.square, type: p.type, gain });
  }
  return out.sort((a, b) => b.gain - a.gain);
}
/** Cases attaquées par la pièce située en `from` (après le coup). */
function attackedBy(ch: Chess, from: Square): Square[] {
  const p = ch.get(from); if (!p) return [];
  const [f, r] = fr(from); const res: Square[] = [];
  const add = (x: number, y: number) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) res.push(sq(x, y)); };
  if (p.type === 'n') { for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(f + dx, r + dy); }
  else if (p.type === 'k') { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (dx || dy) add(f + dx, r + dy); } }
  else if (p.type === 'p') { const d = p.color === 'w' ? 1 : -1; add(f - 1, r + d); add(f + 1, r + d); }
  else for (const [dx, dy] of DIRS[p.type]) { let x = f + dx, y = r + dy; while (x >= 0 && x < 8 && y >= 0 && y < 8) { res.push(sq(x, y)); if (ch.get(sq(x, y))) break; x += dx; y += dy; } }
  return res;
}
export interface Motif { key: string; label: string; detail: string }
/** Analyse le coup `m` déjà joué dans `after`. */
export function detectMotifs(before: Chess, m: Move, after: Chess): Motif[] {
  const res: Motif[] = []; const me = m.color; const them = opp(me);
  const mover = after.get(m.to);
  if (m.san.includes('#')) res.push({ key: 'mate', label: 'Échec et mat', detail: 'Le roi adverse est attaqué et ne peut plus s’échapper.' });
  if (m.promotion) res.push({ key: 'promotion', label: 'Promotion', detail: `Le pion devient ${PIECE_ART[m.promotion as PieceSymbol]}.` });
  // échec double
  if (after.inCheck()) {
    const k = findKing(after, them); const a = k ? attackersOf(after, k, me) : [];
    if (a.length >= 2) res.push({ key: 'doubleCheck', label: 'Échec double', detail: 'Deux pièces donnent échec en même temps : seul un déplacement du roi est possible.' });
  }
  if (mover) {
    // fourchette
    const targets = attackedBy(after, m.to).map((s) => ({ s, p: after.get(s) })).filter((x) => x.p && x.p.color === them) as { s: Square; p: { type: PieceSymbol } }[];
    const juicy = targets.filter((t) => t.p.type === 'k' || val(t.p.type) > val(mover.type) || attackersOf(after, t.s, them).length === 0);
    if (juicy.length >= 2 && !attackersOf(after, m.to, them).some(() => false)) {
      const names = juicy.slice(0, 3).map((t) => `${t.p.type === 'k' ? 'le roi' : PIECE_ART[t.p.type]} en ${t.s}`);
      res.push({ key: 'fork', label: 'Fourchette', detail: `${cap(PIECE_ART[mover.type])} attaque à la fois ${names.join(' et ')}.` });
    }
    // clouage / enfilade
    if ('bqr'.includes(mover.type)) {
      const [f, r] = fr(m.to);
      for (const [dx, dy] of DIRS[mover.type]) {
        let x = f + dx, y = r + dy; let first: { s: Square; t: PieceSymbol; c: Color } | null = null;
        while (x >= 0 && x < 8 && y >= 0 && y < 8) {
          const p = after.get(sq(x, y));
          if (p) {
            if (!first) { if (p.color !== them) break; first = { s: sq(x, y), t: p.type, c: p.color }; }
            else {
              if (p.color === them) {
                if (p.type === 'k' && first.t !== 'k') res.push({ key: 'pin', label: 'Clouage absolu', detail: `${cap(PIECE_ART[first.t])} en ${first.s} est cloué(e) devant le roi : il est interdit de le bouger.` });
                else if (val(p.type) > val(first.t) && first.t !== 'k') res.push({ key: 'pin', label: 'Clouage', detail: `${cap(PIECE_ART[first.t])} en ${first.s} est cloué(e) devant ${PIECE_ART[p.type]} en ${sq(x, y)}.` });
                else if (val(first.t) > val(p.type) && (first.t === 'k' || first.t === 'q' || first.t === 'r')) res.push({ key: 'skewer', label: 'Enfilade', detail: `${first.t === 'k' ? 'Le roi' : cap(PIECE_ART[first.t])} doit s’écarter et ${PIECE_ART[p.type]} en ${sq(x, y)} tombera derrière.` });
              }
              break;
            }
          }
          x += dx; y += dy;
        }
      }
    }
    // attaque à la découverte
    const beforeAtk = new Set<string>();
    for (const row of before.board()) for (const p of row) if (p && p.color === me && 'bqr'.includes(p.type) && p.square !== m.from) attackedBy(before, p.square).forEach((s) => beforeAtk.add(p.square + s));
    for (const row of after.board()) for (const p of row) if (p && p.color === me && 'bqr'.includes(p.type) && p.square !== m.to) {
      for (const s of attackedBy(after, p.square)) {
        const t = after.get(s);
        if (t && t.color === them && (t.type === 'k' || val(t.type) >= 3) && !beforeAtk.has(p.square + s)) {
          res.push({ key: t.type === 'k' ? 'discoveredCheck' : 'discoveredAttack', label: t.type === 'k' ? 'Échec à la découverte' : 'Attaque à la découverte', detail: `En bougeant, ${PIECE_ART[m.piece]} ouvre la ligne de ${PIECE_ART[p.type]} en ${p.square} vers ${t.type === 'k' ? 'le roi' : PIECE_ART[t.type]} en ${s}.` });
          break;
        }
      }
    }
    // sacrifice
    const atk = attackersOf(after, m.to, them);
    if (atk.length && mover.type !== 'k') {
      const capturedVal = m.captured ? VALUES[m.captured as PieceSymbol] : 0;
      const def = attackersOf(after, m.to, me).length;
      const minA = Math.min(...atk.map((a) => val(after.get(a)!.type)));
      if ((def === 0 && VALUES[mover.type] > capturedVal + 0.5) || (minA < VALUES[mover.type] && VALUES[mover.type] - capturedVal >= 2)) res.push({ key: 'sacrifice', label: 'Sacrifice', detail: `${cap(PIECE_ART[mover.type])} se laisse prendre volontairement.` });
    }
  }
  if (m.captured) {
    const wasDefended = attackersOf(before, m.to, them).length > 0;
    if (!wasDefended) res.push({ key: 'freePiece', label: 'Pièce gratuite', detail: `${cap(PIECE_ART[m.captured as PieceSymbol])} en ${m.to} n’était pas protégé(e).` });
  }
  return dedupe(res);
}
function dedupe(a: Motif[]) { const seen = new Set<string>(); return a.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true))); }
export function findKing(ch: Chess, c: Color): Square | undefined { for (const row of ch.board()) for (const p of row) if (p && p.type === 'k' && p.color === c) return p.square; }
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Conseils de principes pour l'ouverture (ply = demi-coup 0-based). */
export function openingPrinciples(before: Chess, m: Move, ply: number, history: Move[]): string[] {
  const tips: string[] = [];
  if (ply > 24) return tips;
  const mine = history.filter((h) => h.color === m.color);
  const minorsHome = (m.color === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8']).filter((s) => { const p = before.get(s as Square); return p && p.color === m.color && (p.type === 'n' || p.type === 'b'); }).length;
  if (m.piece === 'q' && ply < 12 && minorsHome >= 2 && !m.captured) tips.push('Sortir la dame trop tôt l’expose aux attaques : développe d’abord cavaliers et fous.');
  if ((m.piece === 'n' || m.piece === 'b') && mine.some((h) => h.to === m.from) && minorsHome >= 2 && !m.captured && ply < 16) tips.push('Évite de jouer deux fois la même pièce dans l’ouverture tant que d’autres pièces dorment encore.');
  if (m.piece === 'n' && /^[ah]/.test(m.to) && ply < 16) tips.push('« Cavalier au bord, cavalier mort » : au centre il contrôle 8 cases, au bord seulement 4.');
  if (m.piece === 'p' && /^[fgh]/.test(m.from) && ply < 14 && !m.captured && (m.color === 'w' ? before.get('e1')?.type === 'k' : before.get('e8')?.type === 'k') && m.from[0] === 'f') tips.push('Avancer le pion f affaiblit la diagonale de ton roi (attention aux échecs en h5/h4).');
  if (m.piece === 'k' && !m.san.startsWith('O-O') && ply < 30) tips.push('Bouger le roi sans roquer t’empêche de roquer ensuite : le roque met le roi à l’abri et active la tour.');
  if (m.san.startsWith('O-O')) tips.push('Bon réflexe : le roque met ton roi en sécurité et connecte tes tours.');
  if ((m.piece === 'n' || m.piece === 'b') && (m.from[1] === '1' || m.from[1] === '8') && tips.length === 0) tips.push('Tu développes une pièce mineure : c’est le principe n°1 de l’ouverture.');
  if (m.piece === 'p' && ['e4', 'd4', 'e5', 'd5'].includes(m.to) && ply < 6) tips.push('Tu occupes le centre avec un pion : il contrôle des cases clés et ouvre des lignes à tes pièces.');
  return tips;
}
export function materialSwing(fen: string, ucis: string[], plies: number, me: Color): number {
  const ch = new Chess(fen);
  const m0 = matFor(ch, me);
  for (const u of ucis.slice(0, plies)) { try { ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } }
  return matFor(ch, me) - m0;
}
function matFor(ch: Chess, me: Color) { let s = 0; for (const row of ch.board()) for (const p of row) if (p) s += (p.color === me ? 1 : -1) * VALUES[p.type]; return s; }
export { PIECE_NAME };
