import { Chess, type Square, type Move, type PieceSymbol, type Color } from 'chess.js';
export { Chess };
export type { Square, Move, PieceSymbol, Color };

export const FILES = 'abcdefgh';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_NAME: Record<PieceSymbol, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
export const PIECE_ART: Record<PieceSymbol, string> = { p: 'le pion', n: 'le cavalier', b: 'le fou', r: 'la tour', q: 'la dame', k: 'le roi' };
export const FR_LETTER: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C', P: '' };

/** Convertit une notation SAN anglaise (Nf3) en notation française (Cf3). */
export function sanFr(san: string): string {
  return san.replace(/[KQRBN]/g, (c, i) => (i === 0 || san[i - 1] === '=' ? FR_LETTER[c] : c)).replace('O-O-O', 'O-O-O');
}

export function uciToObj(u: string) {
  return { from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: (u[4] as any) || undefined };
}
export function moveToUci(m: { from: string; to: string; promotion?: string }) {
  return m.from + m.to + (m.promotion || '');
}
/** Joue un coup UCI ou SAN ; renvoie le Move ou null si illégal. */
export function tryMove(ch: Chess, mv: string | { from: string; to: string; promotion?: string }): Move | null {
  try {
    if (typeof mv === 'string') {
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv)) return ch.move(uciToObj(mv));
      return ch.move(mv);
    }
    return ch.move(mv as any);
  } catch {
    return null;
  }
}
/** Cases de destination légales pour chessground. */
export function legalDests(ch: Chess): Map<Square, Square[]> {
  const d = new Map<Square, Square[]>();
  for (const m of ch.moves({ verbose: true })) {
    const a = d.get(m.from) || [];
    if (!a.includes(m.to)) a.push(m.to);
    d.set(m.from, a);
  }
  return d;
}
export const colorName = (c: Color) => (c === 'w' ? 'white' : 'black');
export const turnColor = (ch: Chess) => colorName(ch.turn()) as 'white' | 'black';
export function checkSquare(ch: Chess): Square | undefined {
  if (!ch.inCheck()) return undefined;
  const b = ch.board();
  for (const row of b) for (const p of row) if (p && p.type === 'k' && p.color === ch.turn()) return p.square;
}
export function isPromotion(ch: Chess, from: string, to: string) {
  const p = ch.get(from as Square);
  return !!p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
}
export function material(ch: Chess) {
  let w = 0, b = 0;
  for (const row of ch.board()) for (const p of row) if (p) (p.color === 'w' ? (w += VALUES[p.type]) : (b += VALUES[p.type]));
  return { w, b, diff: w - b };
}
/** Pièces capturées pour l'affichage (à partir de la position). */
export function captured(ch: Chess) {
  const full: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const cnt: Record<string, number> = {};
  for (const row of ch.board()) for (const p of row) if (p && p.type !== 'k') cnt[p.color + p.type] = (cnt[p.color + p.type] || 0) + 1;
  const res = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] }; // pièces prises PAR w / PAR b
  for (const t of ['q', 'r', 'b', 'n', 'p'] as PieceSymbol[]) {
    for (let i = 0; i < Math.max(0, full[t] - (cnt['b' + t] || 0)); i++) res.w.push(t);
    for (let i = 0; i < Math.max(0, full[t] - (cnt['w' + t] || 0)); i++) res.b.push(t);
  }
  return res;
}
export function gameOverText(ch: Chess): string | null {
  if (ch.isCheckmate()) return ch.turn() === 'w' ? 'Échec et mat — les Noirs gagnent' : 'Échec et mat — les Blancs gagnent';
  if (ch.isStalemate()) return 'Pat — partie nulle';
  if (ch.isThreefoldRepetition()) return 'Nulle par triple répétition';
  if (ch.isInsufficientMaterial()) return 'Nulle — matériel insuffisant';
  if (ch.isDraw()) return 'Nulle (règle des 50 coups)';
  return null;
}
/** Formate une liste de coups SAN en notation lisible « 1. e4 e5 2. Cf3 ». */
export function formatLine(sans: string[], startPly = 0, fr = true): string {
  let s = '';
  sans.forEach((m, i) => {
    const ply = startPly + i;
    const num = Math.floor(ply / 2) + 1;
    if (ply % 2 === 0) s += `${num}. `;
    else if (i === 0) s += `${num}… `;
    s += (fr ? sanFr(m) : m) + ' ';
  });
  return s.trim();
}
/** Convertit une suite UCI en SAN depuis une position. */
export function uciLineToSan(fen: string, ucis: string[], max = 99): string[] {
  const ch = new Chess(fen);
  const out: string[] = [];
  for (const u of ucis.slice(0, max)) {
    const m = tryMove(ch, u);
    if (!m) break;
    out.push(m.san);
  }
  return out;
}
export function squareColorIsLight(sq: string) {
  const f = FILES.indexOf(sq[0]);
  const r = +sq[1];
  return (f + r) % 2 === 1;
}
