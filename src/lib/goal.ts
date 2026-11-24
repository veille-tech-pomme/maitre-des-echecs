// Objectifs des exercices joués contre le moteur : quand une promotion compte-t-elle comme réussie ?
// Règle (audit P0) : la promotion n'est validée qu'APRÈS la réponse du moteur, et seulement si la position
// reste gagnante pour l'élève (mat donné, ou évaluation ≥ +3 du point de vue de l'élève, sans nulle sur l'échiquier).
import type { Chess, Move } from 'chess.js';
import { PIECE_NAME } from './chess';

export const PROMO_WIN_CP = 300;
export type PromoVerdict = { ok: true; msg: string } | { ok: false; why: string };

/**
 * @param userScore évaluation (centipions, mats ≈ ±10000) du point de vue de l'élève, position après sa promotion
 * @param after position après la réponse du moteur (ou après la promotion si la partie est finie)
 * @param promo le coup de promotion de l'élève ; reply la réponse du moteur (s'il y en a une)
 */
export function promotionVerdict(userScore: number, after: Chess, promo: Move, reply?: Move | null): PromoVerdict {
  const piece = PIECE_NAME[(promo.promotion || 'q') as 'q'];
  const fem = piece === 'dame' || piece === 'tour';
  const nouv = fem ? 'nouvelle' : 'nouveau';
  if (after.isCheckmate()) return after.turn() === promo.color ? { ok: false, why: 'Tu as été maté après ta promotion.' } : { ok: true, msg: 'Promotion et mat !' };
  if (after.isStalemate()) return { ok: false, why: `Pat ! Après ${promo.san}, l’adversaire n’a plus aucun coup légal sans être en échec : c’est nulle. ${promo.promotion === 'q' ? 'Une dame contrôle trop de cases : pense à une sous-promotion.' : ''}`.trim() };
  if (after.isInsufficientMaterial()) return { ok: false, why: `${reply?.captured && reply.to === promo.to ? `Ta ${nouv} ${piece} est prise aussitôt (…${reply.san}). ` : ''}Il ne reste pas assez de matériel pour mater : nulle.` };
  if (after.isDraw()) return { ok: false, why: 'La partie est nulle après ta promotion.' };
  if (userScore >= PROMO_WIN_CP) return { ok: true, msg: `Promotion réussie (${promo.san}), et la position reste gagnante.` };
  if (reply?.captured && reply.to === promo.to) return { ok: false, why: `Ta ${nouv} ${piece} est prise aussitôt (…${reply.san}) : la position n’est plus gagnante. Prépare la promotion pour que la case soit protégée.` };
  return { ok: false, why: `Tu as promu (${promo.san}), mais la position n’est plus gagnante : ${userScore > -PROMO_WIN_CP ? 'c’est nulle' : 'elle est même perdue'} selon le moteur.` };
}

/** Clé d'une position pour les défenses imposées (placement + trait). */
export const scriptKey = (fen: string) => fen.split(' ').slice(0, 2).join(' ');

/** L'adversaire n'a plus que son roi et l'élève garde de quoi mater (dame, tour, deux fous, fou + cavalier) :
 * la défense a rendu sa pièce pour le pion, c'est gagné même sans promotion. */
export function loneKingWin(after: Chess, user: 'w' | 'b'): boolean {
  const mine: string[] = []; let oppOther = 0;
  for (const row of after.board()) for (const p of row) if (p) { if (p.color === user) { if (p.type !== 'k') mine.push(p.type); } else if (p.type !== 'k') oppOther++; }
  if (oppOther) return false;
  if (mine.includes('q') || mine.includes('r')) return true;
  const b = mine.filter((x) => x === 'b').length, n = mine.filter((x) => x === 'n').length;
  return (b >= 1 && n >= 1) || b >= 2;
}

/**
 * Audit Magnus C3 : dans les finales à tenir nulle, vérifier la MÉTHODE, pas seulement le résultat.
 * Philidor (le camp `user` défend tour contre tour + pion) :
 *  1. tant que le pion le plus avancé n'a pas atteint la 6e rangée (vue de l'attaquant), la tour défend la 6e rangée ;
 *  2. dès que le pion arrive en 6e, la tour descend tout en bas (1re ou 2e rangée de l'attaquant) pour les échecs par derrière.
 * Renvoie null si le coup respecte la méthode, sinon l'explication.
 */
export function philidorMethodIssue(after: Chess, user: 'w' | 'b'): string | null {
  const att = user === 'w' ? 'b' : 'w';
  const rel = (sq: string) => (att === 'w' ? +sq[1] : 9 - +sq[1]); // rangée vue de l'attaquant
  const sqs = after.board().flat().filter(Boolean) as { square: string; type: string; color: string }[];
  const pawns = sqs.filter((p) => p.type === 'p' && p.color === att); const rook = sqs.find((p) => p.type === 'r' && p.color === user);
  const attRook = sqs.find((p) => p.type === 'r' && p.color === att);
  if (!pawns.length || !rook || !attRook) return null; // pion ou tours échangés : la méthode ne s'applique plus
  const adv = Math.max(...pawns.map((p) => rel(p.square)));
  const r = rel(rook.square);
  if (adv <= 5 && r !== 6) return 'Ce n’est pas la méthode Philidor : tant que le pion n’a pas atteint ta 3e rangée, ta tour reste sur cette rangée pour barrer la route au roi adverse. Recommence.';
  if (adv >= 6 && r > 2) return 'Ce n’est pas la méthode Philidor : le pion est arrivé sur ta 3e rangée, le roi adverse n’a plus d’abri devant lui. Il fallait descendre la tour tout en bas pour donner des échecs par derrière. Recommence.';
  return null;
}
export type DrawMethod = 'philidor';
export const methodIssue = (m: DrawMethod, after: Chess, user: 'w' | 'b') => (m === 'philidor' ? philidorMethodIssue(after, user) : null);
