// Vocabulaire français du coach : noms de pièces, genres, possessifs, cases, lignes de coups.
import { Chess } from 'chess.js';
import type { Role, Color } from './geometry';
export const NAME: Record<Role, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const FEM: Record<Role, boolean> = { p: false, n: false, b: false, r: true, q: true, k: false };
export const my = (t: Role) => (FEM[t] ? 'ta ' : 'ton ') + NAME[t];
export const his = (t: Role) => (FEM[t] ? 'la ' : 'le ') + NAME[t] + ' adverse';
export const the = (t: Role) => (FEM[t] ? 'la ' : 'le ') + NAME[t];
export const a = (t: Role) => (FEM[t] ? 'une ' : 'un ') + NAME[t];
export const fem = (t: Role) => FEM[t];
/** Accord : « protégé » / « protégée ». */
export const agree = (t: Role | undefined, w: string) => (t && FEM[t] ? w + 'e' : w);
/** « a, b et c ». */
export const list = (xs: string[]) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' et ' + xs[xs.length - 1] : xs[0] || '');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FR: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };
export const sanFr = (san: string) => san.replace(/[KQRBN]/g, (c, i) => (i === 0 || san[i - 1] === '=' ? FR[c] : c));
/** Hachage stable (choix de formulation déterministe). */
export function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const pick = <T>(arr: T[], seed: string): T => arr[hash(seed) % arr.length];
/** Ligne UCI → SAN français numéroté, à partir d'une FEN. */
export function lineFr(fen: string, ucis: string[], max = 6): string {
  const ch = new Chess(fen); const parts: string[] = [];
  let num = +(fen.split(' ')[5] || 1); let turn: Color = ch.turn();
  for (let i = 0; i < Math.min(max, ucis.length); i++) {
    const u = ucis[i]; let san = '';
    try { san = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch { break; }
    if (turn === 'w') parts.push(`${num}. ${sanFr(san)}`); else parts.push(i === 0 ? `${num}… ${sanFr(san)}` : sanFr(san));
    if (turn === 'b') num++; turn = turn === 'w' ? 'b' : 'w';
  }
  return parts.join(' ');
}
export function sanOf(fen: string, uci: string): string { try { const ch = new Chess(fen); return sanFr(ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san); } catch { return uci; } }
/** Matériel en mots : « une tour », « deux pions », « la dame »… */
export function materialWords(roles: Role[]): string {
  if (!roles.length) return '';
  const c: Record<string, number> = {}; for (const r of roles) c[r] = (c[r] || 0) + 1;
  const NUM = ['', 'un', 'deux', 'trois', 'quatre', 'cinq'];
  const parts = (['q', 'r', 'b', 'n', 'p'] as Role[]).filter((r) => c[r]).map((r) => {
    const n = c[r]; if (r === 'q' && n === 1) return 'la dame';
    if (n === 1) return a(r);
    const nm = r === 'r' ? 'tours' : r === 'q' ? 'dames' : NAME[r] + 's';
    return `${NUM[n] || n} ${nm}`;
  });
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1] : parts[0];
}
export const plural = (n: number, s: string, p = s + 's') => `${n} ${n > 1 ? p : s}`;
