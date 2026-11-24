// Pièges classiques d'ouverture (audit Magnus) : explications écrites à la main, reconnues par position + coup.
// Le moteur à faible profondeur voit la perte de matériel mais pas l'idée (ex. le faux clouage du piège de l'éléphant) :
// pour ces coups précis, on remplace l'explication générée. Non-régression : tests/coach-traps.test.ts.
import { Chess } from 'chess.js';
import type { Explanation } from './explain';

interface TrapMove { at: number; headline: string; why: string; plan?: string; tag: string }
interface Trap { name: string; line: string; moves: TrapMove[] }
export const TRAPS: Trap[] = [
  { name: 'le piège de l’éléphant', line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8', moves: [
    { at: 10, tag: 'trap:elephant:blunder', headline: 'Le piège de l’éléphant', why: 'Le cavalier f6 n’est cloué qu’en apparence. Après 6…Cxd5 !, si 7.Fxd8 ?, 7…Fb4+ ! oblige 8.Dd2 Fxd2+ 9.Rxd2 Rxd8 : les dames sont échangées et les Noirs ont gagné une pièce contre un pion. Sinon (7.Fxd8 refusé), le pion d5 est simplement perdu pour rien.', plan: 'Mieux : 6.e3 ou 6.Cf3, en développant, avant de penser au pion d5.' },
    { at: 11, tag: 'trap:elephant:refute', headline: 'Le piège de l’éléphant !', why: 'Tu « lâches » ta dame : 7.Fxd8 Fb4+ ! 8.Dd2 Fxd2+ 9.Rxd2 Rxd8 et tu gagnes une pièce. Le clouage du cavalier f6 était un faux clouage.' },
    { at: 12, tag: 'trap:elephant:bxd8', headline: 'La dame se prend… mais c’est le piège', why: 'Après 7…Fb4+ ! 8.Dd2 Fxd2+ 9.Rxd2 Rxd8, les Noirs récupèrent la dame et gardent le cavalier de plus. Le mal était fait au coup précédent (6.Cxd5 ?).' },
  ] },
  { name: 'le piège de Légal', line: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#', moves: [
    { at: 7, tag: 'trap:legal:g6', headline: 'Attention au piège de Légal', why: 'Le fou g4 ne cloue le cavalier f3 qu’en apparence : 5.Cxe5 ! menace déjà Fxf7+ et Cd5#. Ton coup ne fait rien contre cette idée.', plan: 'Mieux : 4…Cc6 ou 4…Cf6, en développant.' },
    { at: 8, tag: 'trap:legal:nxe5', headline: 'Le piège de Légal !', why: 'Tu offres ta dame : si 5…Fxd1 ??, 6.Fxf7+ Re7 7.Cd5# — mat avec trois pièces mineures. Si 5…dxe5, 6.Dxg4 et tu as gagné un pion.' },
    { at: 9, tag: 'trap:legal:bxd1', headline: 'Prendre la dame perd : piège de Légal', why: 'Après 5…Fxd1 ??, 6.Fxf7+ Re7 7.Cd5# : mat. Il fallait 5…dxe5 6.Dxg4 : tu perds un pion, pas la partie.' },
  ] },
  { name: 'l’arche de Noé', line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4', moves: [
    { at: 14, tag: 'trap:noah:qxd4', headline: 'Le piège de l’arche de Noé', why: 'Après 8.Dxd4 ?, 8…c5 ! puis …c4 enferme le fou b3 derrière les pions a6-b5-c4 : il est perdu (9.Dd5 Fe6 10.Dc6+ Fd7 11.Dd5 c4).', plan: 'Mieux : 8.c3 (gambit) ou 8.Fd5, sans laisser le fou se faire enfermer.' },
    { at: 15, tag: 'trap:noah:c5', headline: 'L’arche de Noé !', why: '8…c5 ! menace …c4 : le fou b3 n’a plus de retraite derrière la chaîne a6-b5-c4. La dame blanche ne peut pas tout défendre.' },
  ] },
];
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
let INDEX: Map<string, TrapMove & { name: string }> | null = null;
function index() {
  if (INDEX) return INDEX; INDEX = new Map();
  for (const t of TRAPS) { const c = new Chess(); const sans = t.line.split(' ');
    sans.forEach((s, i) => { const f = c.fen(); const m = c.move(s); const tm = t.moves.find((x) => x.at === i); if (tm) INDEX!.set(key(f) + ' ' + m.from + m.to + (m.promotion || ''), { ...tm, name: t.name }); }); }
  return INDEX;
}
/** Explication d'un coup de piège connu (position avant le coup + coup UCI), ou null. */
export function trapExplanation(fenBefore: string, uci: string): Explanation | null {
  const t = index().get(key(fenBefore) + ' ' + uci); if (!t) return null;
  return { headline: t.headline, why: t.why, plan: t.plan, arrows: [], marks: [], tags: [t.tag], facts: [{ kind: 'trap', name: t.name }] };
}
