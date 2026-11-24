// Légalité d'une position (au-delà de ce que vérifie chess.js) : rois, pions sur la 1re/8e rangée,
// camp qui n'a pas le trait déjà en échec, nombre de pièces, droits de roque, prise en passant.
import { Chess, validateFen } from 'chess.js';

/** diagram : schéma de règles sans rois (déplacement d'une pièce seule), toléré dans les leçons de règles */
export function positionIssues(fen: string, opts: { diagram?: boolean } = {}): string | null {
  const f = fen.trim().split(/\s+/);
  if (f.length === 4) f.push('0', '1'); else if (f.length === 2) f.push('-', '-', '0', '1');
  const full = f.join(' ');
  if (opts.diagram && !(/K/.test(f[0]) && /k/.test(f[0]))) {
    if (/[pP]/.test(f[0].split('/')[0] + f[0].split('/')[7])) return 'pion sur la 1re ou la 8e rangée';
    return /^[1-8pnbrqkPNBRQK/]+$/.test(f[0]) && f[0].split('/').length === 8 ? null : 'FEN invalide';
  }
  const v = validateFen(full); if (!v.ok) return v.error || 'FEN invalide';
  const rows = f[0].split('/'); const at = (sq: string) => { const file = sq.charCodeAt(0) - 97, rank = +sq[1]; let x = 0; for (const ch of rows[8 - rank]) { if (/\d/.test(ch)) { x += +ch; if (x > file) return ''; } else { if (x === file) return ch; x++; } } return ''; };
  const cnt: Record<string, number> = {}; for (const ch of f[0].replace(/[\d/]/g, '')) cnt[ch] = (cnt[ch] || 0) + 1;
  if ((cnt.K || 0) !== 1 || (cnt.k || 0) !== 1) return 'il faut exactement un roi de chaque couleur';
  if (/[pP]/.test(rows[0] + rows[7])) return 'pion sur la 1re ou la 8e rangée';
  for (const [side, up] of [['w', true], ['b', false]] as const) {
    const L = (s: string) => (up ? s.toUpperCase() : s);
    const pawns = cnt[L('p')] || 0; const total = ['p', 'n', 'b', 'r', 'q', 'k'].reduce((a, p) => a + (cnt[L(p)] || 0), 0);
    if (pawns > 8) return `trop de pions (${side})`; if (total > 16) return `trop de pièces (${side})`;
    const extra = Math.max(0, (cnt[L('q')] || 0) - 1) + Math.max(0, (cnt[L('r')] || 0) - 2) + Math.max(0, (cnt[L('b')] || 0) - 2) + Math.max(0, (cnt[L('n')] || 0) - 2);
    if (extra > 8 - pawns) return `trop de pièces promues (${side})`;
  }
  // le camp qui n'a pas le trait ne peut pas être en échec
  const flip = [...f]; flip[1] = f[1] === 'w' ? 'b' : 'w'; flip[3] = '-';
  try { if (new Chess(flip.join(' '), { skipValidation: true } as any).inCheck()) return 'le camp qui n’a pas le trait est en échec'; } catch { return 'position illisible'; }
  // au plus deux pièces donnent échec
  const c = new Chess(full); if (c.inCheck()) {
    const k = c.board().flat().find((p) => p && p.type === 'k' && p.color === c.turn())!; const opp = c.turn() === 'w' ? 'b' : 'w';
    if (c.attackers(k.square, opp).length > 2) return 'plus de deux pièces donnent échec';
  }
  // droits de roque cohérents
  const cr = f[2]; const need: Record<string, [string, string][]> = { K: [['e1', 'K'], ['h1', 'R']], Q: [['e1', 'K'], ['a1', 'R']], k: [['e8', 'k'], ['h8', 'r']], q: [['e8', 'k'], ['a8', 'r']] };
  if (cr !== '-') for (const r of cr) for (const [sq, p] of need[r] || []) if (at(sq) !== p) return `droit de roque ${r} sans ${p} en ${sq}`;
  // prise en passant cohérente
  const ep = f[3]; if (ep !== '-') {
    const r = ep[1]; const file = ep[0]; const w = f[1] === 'w';
    if ((w && r !== '6') || (!w && r !== '3')) return 'case de prise en passant impossible';
    if (at(file + (w ? '5' : '4')) !== (w ? 'p' : 'P') || at(ep) || at(file + (w ? '7' : '2'))) return 'prise en passant sans pion qui vient d’avancer de deux cases';
  }
  return null;
}
