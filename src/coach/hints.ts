// Indices gradués pendant une partie : 1) Menaces  2) Idées  3) Coups. Tout est dérivé du moteur et vérifié.
import { Chess } from 'chess.js';
import { parseFen, sqName } from './geometry';
import { moveMotifs, verifyOnLine, hanging, MOTIF_LABEL, type MotifKey } from './motifs';
import { my, his, cap, sanOf, list, agree } from './lang';
import type { Line, Arrow, Mark } from './explain';

export type HintLevel = 1 | 2 | 3;
export interface Hint { level: HintLevel; title: string; text: string; arrows: Arrow[]; marks: Mark[] }
const applyU = (fen: string, u: string): string | null => { try { const c = new Chess(fen); c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c.fen(); } catch { return null; } };
const isMateFen = (fen: string) => { try { return new Chess(fen).isCheckmate(); } catch { return false; } };
const mv = (u: string) => ({ from: (u.charCodeAt(0) - 97) + (+u[1] - 1) * 8, to: (u.charCodeAt(2) - 97) + (+u[3] - 1) * 8, promo: (u[4] as any) || undefined });

/** Passe le trait (coup nul) pour voir ce que l'adversaire menace. */
export function nullMoveFen(fen: string): string | null {
  const p = fen.split(' '); if (new Chess(fen).inCheck()) return null;
  p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' ');
}
/**
 * `threatLine` : meilleure ligne de l'adversaire si on passait (analyse de `nullMoveFen`), facultative.
 */
export function hintsFor(fen: string, lines: Line[], threatLine: Line | null): Hint[] {
  const pos = parseFen(fen); const me = pos.turn; const out: Hint[] = [];
  // 1. Menaces
  const hang = hanging(pos.b, me).filter((h) => h.t !== 'p' || hanging(pos.b, me).length === 1);
  const tMarks: Mark[] = hang.map((h) => ({ sq: sqName(h.sq), kind: 'danger' }));
  let tText = '';
  if (threatLine && threatLine.mate != null && threatLine.mate > 0) tText = `L’adversaire menace de mater en ${threatLine.mate}${threatLine.pv[0] ? ' (' + sanOf(nullMoveFen(fen)!, threatLine.pv[0]) + ')' : ''}. Mets ton roi à l’abri d’abord.`;
  else if (hang.length) tText = `${cap(list(hang.slice(0, 3).map((h) => `${my(h.t)} en ${sqName(h.sq)}`)))} ${hang.length > 1 ? 'peuvent être pris avec profit' : `peut être ${agree(hang[0].t, 'pris')} avec profit`}. Protège ${hang.length > 1 ? 'tes pièces' : agree(hang[0].t, 'le').replace('lee', 'la')} ou déplace-${hang.length > 1 ? 'les' : agree(hang[0].t, 'le').replace('lee', 'la')}.`;
  else if (threatLine?.pv[0]) {
    const nf = nullMoveFen(fen)!; const ms = verifyOnLine(moveMotifs(parseFen(nf), mv(threatLine.pv[0]), false), nf, threatLine.pv, applyU, isMateFen).verified;
    const k = ms.find((x) => x.key !== 'check');
    tText = k ? `Attention : l’adversaire prépare ${MOTIF_LABEL[k.key as MotifKey]?.toLowerCase() || 'une tactique'} avec ${sanOf(nf, threatLine.pv[0])}.` : 'Pas de menace directe : tu as le temps d’améliorer ta position.';
  } else tText = 'Pas de menace directe : tu as le temps d’améliorer ta position.';
  out.push({ level: 1, title: 'Menaces', text: tText, arrows: threatLine?.pv[0] && !hang.length ? [{ orig: threatLine.pv[0].slice(0, 2), dest: threatLine.pv[0].slice(2, 4), brush: 'red' }] : [], marks: tMarks });
  // 2. Idées
  const best = lines[0];
  if (best) {
    const ms = verifyOnLine(moveMotifs(pos, mv(best.move), false), fen, best.pv, applyU, isMateFen).verified;
    const k = ms.find((x) => x.key !== 'check' && x.key !== 'sacrifice');
    const from = best.move.slice(0, 2); const piece = pos.b[mv(best.move).from];
    let idea: string;
    if (best.mate != null && best.mate > 0) idea = `Il y a un mat en ${best.mate} : cherche les échecs.`;
    else if (k) idea = `Une tactique est possible : ${MOTIF_LABEL[k.key as MotifKey]?.toLowerCase() || 'cherche les prises'}${k.targets[0] != null && pos.b[k.targets[0]] ? `, autour de ${his(pos.b[k.targets[0]]!.t)} en ${sqName(k.targets[0])}` : ''}.`;
    else idea = piece ? `Pense à ${my(piece.t)} en ${from} : c’est là que se trouve le meilleur plan.` : 'Améliore ta pièce la moins active.';
    out.push({ level: 2, title: 'Idée', text: idea, arrows: [], marks: [{ sq: from, kind: 'hint' }] });
    out.push({ level: 3, title: 'Coup', text: `Le moteur joue ${sanOf(fen, best.move)}.`, arrows: [{ orig: from, dest: best.move.slice(2, 4), brush: 'green' }], marks: [] });
  }
  return out;
}
