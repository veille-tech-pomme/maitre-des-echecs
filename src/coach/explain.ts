// Moteur d'explication : raisonnement symbolique ancré sur les lignes de Stockfish, puis texte français
// adapté au niveau. Règle d'or : un motif n'est annoncé que si la ligne du moteur le réalise.
import { Chess } from 'chess.js';
import { parseFen, applyMove, sqIdx, sqName, opp, threatOn, attackers, MAT, type Color, type Role, type Pos } from './geometry';
import { moveMotifs, verifyOnLine, hanging, features, opposition, squareRule, rookPawnPattern, endgameKind, type Motif, type MotifKey } from './motifs';
import { my, his, the, a, cap, pick, lineFr, sanOf, materialWords, NAME, agree, list, fem } from './lang';
import type { MoveClass } from './classify';
import { pct } from './winprob';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export const levelOf = (elo: number): Level => (elo < 1000 ? 'beginner' : elo < 1800 ? 'intermediate' : 'advanced');
export interface Line { move: string; pv: string[]; cp: number | null; mate: number | null }
export interface Arrow { orig: string; dest: string; brush: 'red' | 'green' | 'blue' | 'yellow' }
export interface Mark { sq: string; kind: 'danger' | 'target' | 'good' | 'hint' }
export interface Fact { kind: string; [k: string]: unknown }
export interface Explanation { headline: string; why: string; refutation?: string; plan?: string; tip?: string; arrows: Arrow[]; marks: Mark[]; tags: string[]; facts: Fact[] }
export interface MoveCtx {
  fenBefore: string; uci: string; cls: MoveClass; dE: number; eBefore: number; ePlayed: number; eBest: number;
  lines: Line[]; reply: Line | null; elo: number; ply: number; history: string[]; mine: boolean;
}

const applyU = (fen: string, u: string): string | null => { try { const c = new Chess(fen); c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c.fen(); } catch { return null; } };
const isMateFen = (fen: string) => { try { return new Chess(fen).isCheckmate(); } catch { return false; } };
const mvOf = (u: string) => ({ from: sqIdx(u.slice(0, 2)), to: sqIdx(u.slice(2, 4)), promo: (u[4] as Role) || undefined });

/** Suit une ligne et compte les prises de chaque camp. */
export function trace(fen: string, ucis: string[], me: Color, horizon = 8) {
  let f = fen; const lost: Role[] = [], won: Role[] = []; let mate: Color | null = null; let n = 0; let promoMe = 0, promoThem = 0;
  const firstLoss: { ply: number; sq: number; t: Role } [] = [];
  for (const u of ucis.slice(0, horizon)) {
    const p = parseFen(f); const to = sqIdx(u.slice(2, 4)); const from = sqIdx(u.slice(0, 2));
    const mover = p.b[from]; if (!mover) break;
    let victim = p.b[to]; if (!victim && mover.t === 'p' && to === p.ep) victim = { c: opp(mover.c), t: 'p' };
    if (victim) { if (victim.c === me) { lost.push(victim.t); firstLoss.push({ ply: n, sq: to, t: victim.t }); } else won.push(victim.t); }
    if (u[4]) { if (mover.c === me) { won.push(u[4] as Role); promoMe++; } else { lost.push(u[4] as Role); promoThem++; } /* promotion ≈ gain */ }
    const nf = applyU(f, u); if (!nf) break; f = nf; n++;
    if (isMateFen(f)) { mate = mover.c; break; }
  }
  // annule les échanges de même type
  const L = [...lost], W = [...won];
  for (let i = L.length - 1; i >= 0; i--) { const j = W.indexOf(L[i]); if (j >= 0) { W.splice(j, 1); L.splice(i, 1); } }
  const val = (rs: Role[]) => rs.reduce((s, r) => s + MAT[r], 0);
  return { lostNet: L, wonNet: W, net: val(W) - val(L), mate, end: f, firstLoss, plies: n, promoMe, promoThem };
}
type Tr = ReturnType<typeof trace>;
/** Sépare les promotions du matériel capturé (une dame promue n'est pas « perdue »). */
function splitPromo(roles: Role[], promos: number): [Role[], boolean] {
  const r = [...roles]; let promo = false;
  for (let k = 0; k < promos; k++) { const i = r.findIndex((x) => x === 'q' || x === 'n' || x === 'r' || x === 'b'); if (i >= 0 && r[i] === 'q') { r.splice(i, 1); promo = true; } }
  return [r, promo];
}
/** « tu perds une tour », « l’adversaire fait dame », « tu perds un fou et l’adversaire fait dame ». */
export function lossPhrase(tr: Tr): string {
  const [r, promo] = splitPromo(tr.lostNet, tr.promoThem); const w = materialWords(r);
  const [g] = splitPromo(tr.wonNet, tr.promoMe); const comp = g.length ? ` contre ${materialWords(g)}` : '';
  return promo ? (w ? `tu perds ${w}${comp} et l’adversaire fait dame` : 'l’adversaire fait dame') : `tu perds ${w || 'du matériel'}${comp}`;
}
/** « gagner une tour », « faire dame », « gagner un fou et faire dame ». */
export function gainPhrase(tr: Tr): string {
  const [r, promo] = splitPromo(tr.wonNet, tr.promoMe); const w = materialWords(r);
  return promo ? (w ? `gagner ${w} et faire dame` : 'faire dame') : `gagner ${w || 'du matériel'}`;
}
const inCheckAfter = (p: Pos) => { const k = p.b.findIndex((x) => x?.t === 'k' && x.c === p.turn); return k >= 0 && attackers(p.b, k, opp(p.turn)).length > 0; };
const NOUN = '(?=(pion|cavalier|fou|roi)\\b)';
const fixDe = (s: string) => s.replace(new RegExp('\\bde le ' + NOUN, 'g'), 'du ').replace(new RegExp('\\bà le ' + NOUN, 'g'), 'au ');

const TACTIC_ORDER: MotifKey[] = ['doubleCheck', 'fork', 'skewer', 'discoveredAttack', 'discoveredCheck', 'pin', 'trappedPiece', 'capturingDefender', 'overload', 'hangingCapture', 'promotion'];
function bestTactic(ms: Motif[]): Motif | undefined { for (const k of TACTIC_ORDER) { const m = ms.find((x) => x.key === k); if (m) return m; } }

/** Phrase décrivant un motif, du point de vue de celui qui le subit (`victim` = 'me') ou le réalise ('me' joue). */
function motifSentence(m: Motif, pos: Pos, actorIsMe: boolean, seed: string, prev?: Pos): string { return fixDe(motifSentence0(m, pos, actorIsMe, seed, prev)); }
function motifSentence0(m: Motif, pos: Pos, actorIsMe: boolean, seed: string, prev?: Pos): string {
  // les cibles sont nommées d'après la position avant le coup si la case a changé de propriétaire (prise)
  const pieceAt = (t: number) => { const p = pos.b[t]; const q = prev?.b[t]; return q && (!p || p.c !== q.c) ? q : p; };
  const owner = (t: number) => { const p = pieceAt(t); if (!p) return 'une pièce'; return actorIsMe ? his(p.t) : my(p.t); };
  const at = (t: number) => `${owner(t)} en ${sqName(t)}`;
  const g = (t: number, w: string) => agree(pieceAt(t)?.t, w);
  const actor = actorIsMe ? my(m.piece) : his(m.piece);
  const T = m.targets; const TL = list(T.map(at));
  switch (m.key) {
    case 'fork': return pick([`${cap(actor)} attaque en même temps ${TL} : impossible de tout sauver.`, `C’est une fourchette : ${actor} vise à la fois ${TL}.`, `${cap(actor)} fait une fourchette sur ${TL}.`], seed);
    case 'skewer': return `Enfilade : ${at(T[0])} doit s’écarter, et ${at(T[1])}, derrière, tombe.`;
    case 'pin': return pieceAt(T[1])?.t === 'k' ? `${cap(at(T[0]))} est ${g(T[0], 'cloué')} devant le roi : ${fem(pieceAt(T[0])?.t || 'p') ? 'elle' : 'il'} ne peut plus bouger.` : `${cap(at(T[0]))} est ${g(T[0], 'cloué')} : si ${fem(pieceAt(T[0])?.t || 'p') ? 'elle' : 'il'} bouge, ${owner(T[1])} en ${sqName(T[1])} tombe.`;
    case 'discoveredAttack': return `En bougeant, ${actorIsMe ? 'ta pièce' : 'la pièce adverse'} libère la ligne ${actorIsMe ? 'de ' + my(m.piece) : 'de ' + his(m.piece)} vers ${at(T[0])} : c’est une attaque à la découverte.`;
    case 'discoveredCheck': return `Échec à la découverte : le roi est attaqué par une pièce cachée, et la pièce qui a bougé est libre de frapper ailleurs.`;
    case 'doubleCheck': return 'Échec double : deux pièces donnent échec à la fois, seul le roi peut bouger.';
    case 'trappedPiece': return `${cap(at(T[0]))} est ${g(T[0], 'piégé')} : toutes ses cases de fuite sont contrôlées.`;
    case 'capturingDefender': return `La prise élimine le défenseur de ${at(T[1])}, qui devient prenable.`;
    case 'overload': return `${cap(at(T[0]))} doit défendre deux choses à la fois : ${fem(pieceAt(T[0])?.t || 'p') ? 'elle est surchargée' : 'il est surchargé'}.`;
    case 'hangingCapture': {
      const q = pieceAt(T[0]); const src = prev || pos; const def = q ? attackers(src.b, T[0], q.c).length : 0;
      return def ? `La prise de ${at(T[0])} gagne du matériel : l’échange est en ta faveur.` : `${cap(at(T[0]))} n’était pas ${g(T[0], 'protégé')} : il suffisait de ${fem(q?.t || 'p') ? 'la' : 'le'} prendre.`;
    }
    case 'promotion': { const r = pos.b[T[0]]?.t; return r && r !== 'q' && r !== 'p' ? `Le pion se promeut en ${NAME[r]} : une sous-promotion${pos.b[T[0]] && inCheckAfter(pos) ? ' avec échec' : ''}.` : 'Le pion va à dame.'; }
    default: return '';
  }
}
function matePattern(fen: string, pv: string[]): { key: MotifKey | null; len: number } {
  let f = fen;
  for (let i = 0; i < pv.length; i++) {
    const nf = applyU(f, pv[i]); if (!nf) break;
    if (isMateFen(nf)) { const ms = moveMotifs(parseFen(f), mvOf(pv[i]), true).map((x) => x.key); return { key: ms.includes('smotheredMate') ? 'smotheredMate' : ms.includes('backRankMate') ? 'backRankMate' : ms.includes('doubleCheck') ? 'doubleCheck' : null, len: i + 1 }; }
    f = nf;
  }
  return { key: null, len: pv.length };
}
const PATTERN_TXT: Partial<Record<MotifKey, string>> = {
  backRankMate: 'un mat du couloir : le roi est enfermé sur sa première rangée par ses propres pions',
  smotheredMate: 'un mat à l’étouffée : le roi est entouré de ses propres pièces',
  doubleCheck: 'un mat par échec double',
};
const TIPS: Record<string, string[]> = {
  hanging: ['Réflexe avant chaque coup : « qu’est-ce que l’adversaire peut prendre après mon coup ? »', 'Compte attaquants et défenseurs sur chaque pièce que tu bouges ou que tu laisses.'],
  fork: ['Surveille les cases d’où un cavalier ou un pion pourrait attaquer deux de tes pièces.', 'Deux pièces non protégées sont une invitation à la fourchette.'],
  pin: ['Évite d’aligner ta pièce la plus précieuse derrière une autre sur une ligne ouverte.'],
  skewer: ['Roi et dame sur la même ligne, c’est dangereux : une enfilade guette.'],
  discovered: ['Quand une pièce adverse est devant une tour ou un fou, demande-toi ce qu’elle découvre en bougeant.'],
  mate: ['Avant de jouer, vérifie les échecs que l’adversaire peut donner.', 'Compte les cases de fuite de ton roi après ton coup.'],
  missed: ['Cherche toujours dans l’ordre : échecs, prises, menaces.', 'Quand l’adversaire laisse une pièce sans défense, prends le temps de la compter.'],
  smothered: ['Quand ton roi est entouré de ses propres pièces, surveille chaque case d’où un cavalier adverse pourrait donner échec.'],
  backrank: ['Garde une case de fuite à ton roi (un « luft », par exemple h3 ou g3) : ta dernière rangée est fragile.'],
  opening: ['Dans l’ouverture : développe cavaliers et fous, contrôle le centre, roque tôt.'],
};
function tipFor(tag: string, level: Level, seed: string): string | undefined {
  if (level === 'advanced') return undefined;
  const k = tag.startsWith('allowed:fork') ? 'fork' : tag.startsWith('allowed:pin') ? 'pin' : tag.startsWith('allowed:skewer') ? 'skewer' : tag.startsWith('allowed:discovered') ? 'discovered' : tag.startsWith('missed') ? 'missed' : tag.includes('Mate:smothered') ? 'smothered' : tag.includes('Mate:backRank') ? 'backrank' : tag.includes('Mate') ? 'mate' : tag.startsWith('missed') ? 'missed' : tag.startsWith('allowed:hanging') || tag === 'hanging' ? 'hanging' : tag.startsWith('opening') ? 'opening' : '';
  return k ? pick(TIPS[k], seed) : undefined;
}
const lineLen = (l: Level) => (l === 'beginner' ? 2 : l === 'intermediate' ? 4 : 6);

/** Différence positionnelle la plus parlante entre le coup joué et le meilleur coup (null si rien de net). */
function positional(before: Pos, afterPlayed: Pos, afterBest: Pos | null, me: Color, ply: number): { bad?: string; good?: string; tag?: string } {
  const F0 = features(before, me), F1 = features(afterPlayed, me), FB = afterBest ? features(afterBest, me) : null;
  const O0 = features(before, opp(me)), O1 = features(afterPlayed, opp(me));
  const res: { bad?: string; good?: string; tag?: string } = {};
  // roi
  if (F0.king.canCastle && !F1.king.canCastle && !F1.king.castled && (!FB || FB.king.canCastle || FB.king.castled)) return { bad: 'Ton roi perd le droit de roquer : il risque de rester au centre, exposé.', tag: 'king:castling' };
  if (F1.king.shield < F0.king.shield && F0.king.castled && (!FB || FB.king.shield >= F0.king.shield) && ply > 8) return { bad: 'Ce coup de pion affaiblit l’abri de ton roi : les cases autour de lui deviennent des cibles.', tag: 'king:shield' };
  // structure
  const nw = (k: keyof typeof F1.pawns) => F1.pawns[k].length > F0.pawns[k].length && (!FB || FB.pawns[k].length <= F0.pawns[k].length);
  if (nw('isolated')) return { bad: `Ton coup crée un pion isolé (${sqName(F1.pawns.isolated.find((s) => !F0.pawns.isolated.includes(s)) ?? F1.pawns.isolated[0])}) : sans voisin, il sera difficile à défendre.`, tag: 'pawns:isolated' };
  if (nw('doubled')) return { bad: 'Ton coup double tes pions : ils se gênent et protègent moins bien les cases.', tag: 'pawns:doubled' };
  if (nw('backward')) return { bad: 'Ton coup laisse un pion arriéré, fixé sur une colonne semi-ouverte.', tag: 'pawns:backward' };
  if (O1.pawns.passed.length > O0.pawns.passed.length) return { bad: 'Ce coup laisse l’adversaire créer un pion passé : rien ne l’arrêtera plus sur sa colonne.', tag: 'pawns:passed' };
  if (O1.outposts.length > O0.outposts.length) return { bad: 'L’adversaire obtient un avant-poste : une case forte que tes pions ne peuvent plus chasser.', tag: 'pieces:outpost' };
  // développement
  if (ply < 20 && FB && F1.undeveloped > FB.undeveloped && F1.undeveloped >= 2) return { bad: 'Tes pièces mineures dorment encore : le meilleur coup développait une pièce.', tag: 'opening:development' };
  if (FB && FB.mobility - F1.mobility >= 6) return { bad: 'Ton coup réduit l’activité de tes pièces ; le meilleur coup leur donnait beaucoup plus de cases.', tag: 'pieces:activity' };
  // côté positif
  if (!F0.king.castled && F1.king.castled) res.good = 'Tu roques : ton roi est à l’abri et ta tour entre en jeu.';
  else if (F1.outposts.length > F0.outposts.length) res.good = 'Ta pièce s’installe sur un avant-poste : aucun pion adverse ne peut la chasser.';
  else if (F1.pawns.passed.length > F0.pawns.passed.length) res.good = 'Tu crées un pion passé : un futur candidat à la promotion.';
  else if (F1.rooksOpen > F0.rooksOpen) res.good = 'Ta tour prend une colonne ouverte : c’est là qu’elle est la plus active.';
  else if (ply < 16 && F1.undeveloped < F0.undeveloped) res.good = 'Tu développes une pièce mineure : principe n°1 de l’ouverture.';
  return res;
}
/** Principes d'ouverture enfreints par le coup (ply < 20). */
function openingFault(before: Pos, u: string, ply: number, history: string[]): { txt: string; tag: string } | null {
  if (ply >= 20) return null;
  const from = sqIdx(u.slice(0, 2)), to = sqIdx(u.slice(2, 4)); const p = before.b[from]; if (!p) return null;
  const me = p.c; const und = features(before, me).undeveloped;
  if (p.t === 'q' && ply < 10 && und >= 3 && !before.b[to]) return { txt: 'Sortir la dame si tôt l’expose : elle va perdre du temps à fuir les pièces adverses. Développe d’abord cavaliers et fous.', tag: 'opening:queen' };
  if (p.t === 'n' && (u[2] === 'a' || u[2] === 'h') && ply < 16) return { txt: '« Cavalier au bord, cavalier mort » : au centre il contrôle 8 cases, au bord seulement 4.', tag: 'opening:rim' };
  if (p.t === 'k' && !(Math.abs(to - from) === 2) && ply < 24) return { txt: 'Bouger le roi sans roquer t’enlève le roque, le meilleur moyen de le mettre à l’abri.', tag: 'opening:king' };
  if (p.t === 'p' && u[0] === 'f' && ply < 14 && features(before, me).king.canCastle) return { txt: 'Avancer le pion f ouvre la diagonale de ton roi : attention aux échecs sur h5 / h4.', tag: 'opening:fpawn' };
  const mine = history.filter((_, i) => (i % 2 === 0) === (me === 'w'));
  if ((p.t === 'n' || p.t === 'b') && und >= 2 && mine.length >= 2 && ply < 16 && !before.b[to] && mine.some((s) => s.replace(/[+#x]/g, '').endsWith(u.slice(0, 2)))) return { txt: 'Tu joues deux fois la même pièce alors que d’autres dorment encore : chaque coup d’ouverture doit développer.', tag: 'opening:tempo' };
  return null;
}
const kingMoved = (a: Pos, b: Pos, c: Color) => a.b.findIndex((p) => p?.t === 'k' && p.c === c) !== b.b.findIndex((p) => p?.t === 'k' && p.c === c);
function endgameNote(before: Pos, afterPlayed: Pos, afterBest: Pos | null, me: Color, good: boolean, bestSan: string): { txt: string; tag: string } | null {
  const kind = endgameKind(before.b); if (!kind) return null;
  if (kind === 'pawn') {
    const op = opposition(afterPlayed), ob = afterBest ? opposition(afterBest) : null;
    if (good && op?.holder === me && kingMoved(before, afterPlayed, me)) return { txt: `Tu prends l’opposition${op.kind === 'distant' ? ' (à distance)' : ''} : le roi adverse doit céder le passage.`, tag: 'endgame:opposition+' };
    if (!good && ob?.holder === me && op?.holder !== me && afterBest && kingMoved(before, afterBest, me)) return { txt: `Il fallait prendre l’opposition avec ${bestSan} : face à face, c’est le roi qui n’a pas le trait qui gagne la bataille.`, tag: 'endgame:opposition' };
    const s0 = squareRule(before), s1 = squareRule(afterPlayed);
    for (const x of s1) { const was = s0.find((y) => y.color === x.color && y.pawn === x.pawn); if (x.color !== me && was?.caught && !x.caught) return { txt: 'Ton roi sort du carré du pion : celui-ci file maintenant à dame. Règle du carré : trace le carré entre le pion et sa case de promotion.', tag: 'endgame:square' }; }
  }
  if (kind === 'rook') {
    const rp = rookPawnPattern(before);
    if (rp?.kind === 'lucena' && rp.strong === me) return { txt: good ? 'Position de Lucena : tu construis le pont, la technique gagnante (tour en 4e rangée pour abriter le roi des échecs).' : `Position de Lucena : la méthode gagnante est de « construire le pont » ; le moteur proposait ${bestSan}.`, tag: 'endgame:lucena' };
    if (rp?.kind === 'philidor' && rp.strong !== me) { const after = rookPawnPattern(afterPlayed); if (!good && after?.kind !== 'philidor') return { txt: 'Défense Philidor : garde ta tour sur ta 3e rangée tant que le pion n’y est pas arrivé, puis va donner des échecs par derrière.', tag: 'endgame:philidor' }; if (good) return { txt: 'Défense Philidor bien tenue : ta tour coupe le roi adverse sur la 3e rangée.', tag: 'endgame:philidor+' }; }
  }
  return null;
}

/** Explique un coup. Toutes les affirmations tactiques sont vérifiées sur les lignes du moteur. */
export function explainMove(c: MoveCtx): Explanation {
  const level = levelOf(c.elo); const seed = c.fenBefore + c.uci;
  const before = parseFen(c.fenBefore); const me = before.turn; const them = opp(me);
  const fenAfter = applyU(c.fenBefore, c.uci) || c.fenBefore; const after = parseFen(fenAfter);
  const best = c.lines[0]; const bestU = best?.move || c.uci; const isBest = bestU === c.uci;
  const san = sanOf(c.fenBefore, c.uci); const bestSan = sanOf(c.fenBefore, bestU);
  const fenBest = applyU(c.fenBefore, bestU); const afterBest = fenBest ? parseFen(fenBest) : null;
  const L = lineLen(level);
  const out: Explanation = { headline: '', why: '', arrows: [], marks: [], tags: [], facts: [] };
  const good = ['book', 'brilliant', 'great', 'best', 'excellent', 'good'].includes(c.cls);
  const replyPv = c.reply?.pv || [];
  const mateNow = isMateFen(fenAfter);
  const myMotifs = moveMotifs(before, mvOf(c.uci), mateNow);
  const myVer = verifyOnLine(myMotifs, c.fenBefore, [c.uci, ...replyPv], applyU, isMateFen).verified;
  const addBest = () => { if (!isBest && best) out.arrows.push({ orig: bestU.slice(0, 2), dest: bestU.slice(2, 4), brush: 'green' }); };
  const refut = (n = L) => (replyPv.length ? lineFr(fenAfter, replyPv, n) : '');

  // ——— 1. mats ———
  if (mateNow) {
    const pat = myMotifs.find((x) => x.key === 'backRankMate' || x.key === 'smotheredMate');
    out.headline = 'Échec et mat !';
    out.why = pat ? `C’est ${PATTERN_TXT[pat.key]}.` : pick(['Le roi adverse est attaqué et n’a plus aucune case.', 'Plus aucune case pour le roi adverse : la partie est terminée.'], seed);
    out.facts.push({ kind: 'mate', pattern: pat?.key || null }); out.tags.push('mate');
    return out;
  }
  if (c.reply?.mate != null && c.reply.mate > 0 && !good) {
    const pat = matePattern(fenAfter, replyPv); const n = c.reply.mate;
    out.headline = n === 1 ? 'Ce coup permet un mat immédiat' : `Ce coup permet un mat en ${n}`;
    const doomed = best?.mate != null && best.mate < 0;
    out.why = `${pat.key ? cap(PATTERN_TXT[pat.key]!) + '. ' : ''}${n === 1 ? `L’adversaire mate avec ${sanOf(fenAfter, replyPv[0])}.` : `Après ${sanOf(fenAfter, replyPv[0])}, ton roi ne peut plus échapper au mat.`}`;
    if (doomed) out.why += ' Mais le mat était déjà difficile à éviter : le vrai problème est venu avant.';
    out.refutation = refut(Math.min(2 * n - 1, 7));
    if (replyPv[0]) out.arrows.push({ orig: replyPv[0].slice(0, 2), dest: replyPv[0].slice(2, 4), brush: 'red' });
    addBest(); out.plan = best ? `Il fallait ${bestSan}${best.mate != null && best.mate > 0 ? `, qui matait en ${best.mate}` : best.mate != null && best.mate < 0 ? ', qui retardait le mat' : ', qui empêchait ce mat'}.` : undefined;
    out.tags.push('allowedMate' + (pat.key ? ':' + pat.key : '')); out.facts.push({ kind: 'allowedMate', n, pattern: pat.key, line: replyPv.slice(0, 2 * n - 1) });
    out.tip = tipFor('allowedMate' + (pat.key ? ':' + pat.key : ''), level, seed); return out;
  }
  if (!good && best?.mate != null && best.mate > 0) {
    const pat = matePattern(c.fenBefore, best.pv);
    out.headline = best.mate === 1 ? `Tu avais un mat en un coup : ${bestSan}` : `Tu avais un mat en ${best.mate}`;
    out.why = pat.key ? `C’était ${PATTERN_TXT[pat.key]}.` : 'Une suite d’échecs forcés menait au mat.';
    out.plan = lineFr(c.fenBefore, best.pv, Math.min(2 * best.mate - 1, 7)); addBest();
    out.tags.push('missedMate' + (pat.key ? ':' + pat.key : '')); out.facts.push({ kind: 'missedMate', n: best.mate, pattern: pat.key, line: best.pv.slice(0, 2 * best.mate - 1) });
    out.tip = tipFor('missedMate', level, seed); return out;
  }

  // ——— 2. coups faibles : réfutation matérielle ———
  if (!good) {
    const tr = trace(c.fenBefore, [c.uci, ...replyPv], me, 9);
    const trBest = best ? trace(c.fenBefore, best.pv, me, 9) : null;
    if (tr.net <= -1 && (!trBest || trBest.net > tr.net)) {
      const oppMotifs = replyPv[0] ? moveMotifs(after, mvOf(replyPv[0]), false) : [];
      const ver = replyPv.length ? verifyOnLine(oppMotifs, fenAfter, replyPv, applyU, isMateFen).verified : [];
      // cohérence : le motif doit expliquer ce qui est réellement perdu (une de ses cibles tombe)
      const explainsLoss = (x: Motif) => x.key === 'promotion' ? tr.promoThem > 0 : x.targets.some((t) => { const r = after.b[t]?.t; return !!r && r !== 'k' && tr.lostNet.includes(r); }) || (x.key === 'discoveredCheck' || x.key === 'doubleCheck') && tr.lostNet.length > 0;
      const tac = bestTactic(ver.filter((x) => x.key !== 'hangingCapture' && explainsLoss(x)));
      const lostTxt = materialWords(tr.lostNet) || 'du matériel'; const lp = lossPhrase(tr); void lostTxt;
      const movedTo = sqIdx(c.uci.slice(2, 4)); const movedPiece = after.b[movedTo];
      const hb = new Set(hanging(before.b, me).map((h) => h.sq)); const ha = hanging(after.b, me);
      const fl = tr.firstLoss.find((x) => x.ply >= 1);
      if (replyPv[0]) out.arrows.push({ orig: replyPv[0].slice(0, 2), dest: replyPv[0].slice(2, 4), brush: 'red' });
      addBest();
      if (tac) {
        out.headline = pick([`Ce coup permet ${tac.key === 'fork' ? 'une fourchette' : tac.key === 'skewer' ? 'une enfilade' : tac.key === 'pin' ? 'un clouage' : tac.key === 'trappedPiece' ? 'de piéger une pièce' : 'une tactique'} adverse`, `Attention : ${tac.key === 'fork' ? 'fourchette' : tac.key === 'skewer' ? 'enfilade' : tac.key === 'pin' ? 'clouage' : 'tactique'} en vue`], seed);
        out.why = `Après ${sanOf(fenAfter, replyPv[0])}, ${motifSentence(tac, parseFen(applyU(fenAfter, replyPv[0]) || fenAfter), false, seed, after).replace(/^./, (x) => x.toLowerCase())} ${cap(lp)}.`;
        for (const t of tac.targets) out.marks.push({ sq: sqName(t), kind: 'danger' });
        out.tags.push(`allowed:${tac.key}:${tac.piece}`); out.facts.push({ kind: 'allowedTactic', motif: tac.key, piece: tac.piece, targets: tac.targets.map(sqName), lost: tr.lostNet, net: tr.net });
        out.tip = tipFor('allowed:' + tac.key, level, seed);
      } else if (movedPiece && fl && fl.sq === movedTo && threatOn(after.b, movedTo) > 0) {
        const same = tr.lostNet.length === 1 && tr.lostNet[0] === movedPiece.t;
        out.headline = same ? `${cap(my(movedPiece.t))} n’est pas ${agree(movedPiece.t, 'protégé')}` : cap(lp);
        out.why = same ? `Sur ${sqName(movedTo)}, ${my(movedPiece.t)} peut être ${agree(movedPiece.t, 'pris')} : ${sanOf(fenAfter, replyPv[0])}.` : `Sur ${sqName(movedTo)}, ${my(movedPiece.t)} n’est pas ${agree(movedPiece.t, 'protégé')}. Après ${refut(Math.min(6, Math.max(2, tr.plies)))} : au bout du compte, ${lp}.`;
        out.marks.push({ sq: sqName(movedTo), kind: 'danger' }); out.tags.push('allowed:hanging:' + movedPiece.t);
        out.facts.push({ kind: 'hangingMoved', piece: movedPiece.t, sq: sqName(movedTo), lost: tr.lostNet, net: tr.net }); out.tip = tipFor('hanging', level, seed);
      } else {
        const newly = ha.find((h) => !hb.has(h.sq) && fl && h.sq === fl.sq);
        const old = fl ? [...hb].includes(fl.sq) : false;
        if (newly) {
          out.headline = `Ce coup laisse ${my(newly.t)} sans défense`;
          out.why = `${cap(my(newly.t))} en ${sqName(newly.sq)} était ${agree(newly.t, 'protégé')} ; après ton coup, ${sanOf(fenAfter, replyPv[0])} et ${lp}.`;
          out.marks.push({ sq: sqName(newly.sq), kind: 'danger' }); out.tags.push('allowed:hanging:' + newly.t); out.tip = tipFor('hanging', level, seed);
          out.facts.push({ kind: 'removedDefender', piece: newly.t, sq: sqName(newly.sq), lost: tr.lostNet, net: tr.net });
        } else if (old && fl) {
          out.headline = 'Tu n’as pas paré la menace';
          out.why = `${cap(my(fl.t))} en ${sqName(fl.sq)} était déjà ${agree(fl.t, 'attaqué')} : il fallait ${isBest ? 'le' : bestSan.includes('x') ? 'riposter avec ' + bestSan : bestU.slice(0, 2) === sqName(fl.sq) ? (fem(fl.t) ? 'la' : 'le') + ' mettre à l’abri (' + bestSan + ')' : 's’en occuper (' + bestSan + ')'}.`;
          out.marks.push({ sq: sqName(fl.sq), kind: 'danger' }); out.tags.push('ignored:threat:' + fl.t); out.facts.push({ kind: 'ignoredThreat', piece: fl.t, sq: sqName(fl.sq) });
          out.tip = tipFor('hanging', level, seed);
        } else {
          out.headline = cap(lp);
          out.why = `Après la suite ${refut(Math.min(6, Math.max(2, tr.plies)))}, ${lp}.`;
          out.tags.push('allowed:material'); out.facts.push({ kind: 'materialLoss', lost: tr.lostNet, net: tr.net, line: replyPv.slice(0, 6) });
        }
      }
      out.refutation = refut();
      out.plan = planOf(c, before, afterBest, bestU, bestSan, level, seed);
      return out;
    }
    // ——— 3. occasion manquée ———
    if (best && trBest && trBest.net >= 1 && trBest.net > tr.net) {
      const bm = moveMotifs(before, mvOf(bestU), false);
      const ver = verifyOnLine(bm, c.fenBefore, best.pv, applyU, isMateFen).verified;
      const tac = bestTactic(ver);
      const wp = gainPhrase(trBest); const free = tac?.key === 'hangingCapture' && !attackers(before.b, tac.targets[0], them).length;
      addBest();
      out.headline = tac && tac.key !== 'promotion' ? `Tu pouvais ${wp} : ${tac.key === 'fork' ? 'fourchette' : tac.key === 'skewer' ? 'enfilade' : tac.key === 'pin' ? 'clouage' : tac.key === 'hangingCapture' ? (free ? 'pièce gratuite' : 'prise gagnante') : tac.key === 'discoveredAttack' ? 'découverte' : tac.key === 'trappedPiece' ? 'pièce piégée' : 'tactique'} !` : `Tu pouvais ${wp}`;
      const promoOnly = !tac && trBest.promoMe > 0 && wp === 'faire dame';
      const tgtRole = tac ? before.b[tac.targets[0]]?.t : undefined;
      const chain = tac?.key === 'hangingCapture' && tgtRole && !trBest.wonNet.includes(tgtRole);
      out.why = chain ? `Avec ${bestSan}, tu prends ${his(tgtRole!)} en ${sqName(tac!.targets[0])}, et la suite te permet de ${wp}.` : tac ? `Avec ${bestSan}, ${motifSentence(tac, parseFen(fenBest!), true, seed, before).replace(/^./, (x) => x.toLowerCase())}` : promoOnly ? `Avec ${bestSan}, plus rien n’empêche ton pion d’aller à dame.` : `Avec ${bestSan}, l’adversaire ne peut pas tout défendre.`;
      out.plan = lineFr(c.fenBefore, best.pv, L + 1);
      if (tac) for (const t of tac.targets) out.marks.push({ sq: sqName(t), kind: 'target' });
      out.tags.push('missed:' + (tac ? tac.key + ':' + tac.piece : 'material')); out.facts.push({ kind: 'missedTactic', motif: tac?.key || null, won: trBest.wonNet, line: best.pv.slice(0, 5) });
      out.tip = tipFor('missed', level, seed); return out;
    }
    // ——— 4. ouverture, finale, positionnel ———
    addBest();
    const eg = endgameNote(before, after, afterBest, me, false, bestSan);
    const of = openingFault(before, c.uci, c.ply, c.history);
    const po = positional(before, after, afterBest, me, c.ply);
    const drop = `tes chances passent de ${pct(c.eBest)} % à ${pct(c.ePlayed)} %`;
    const replyFen = replyPv[0] ? applyU(fenAfter, replyPv[0]) : null;
    const hangA = new Set(hanging(after.b, me).map((h) => h.sq));
    const newThreats = replyFen ? hanging(parseFen(replyFen).b, me).filter((h) => !hangA.has(h.sq) && MAT[h.t] >= 3) : [];
    if (eg) { out.headline = 'Technique de finale'; out.why = eg.txt; out.tags.push(eg.tag); }
    else if (newThreats.length && c.dE >= 0.08 && !of) {
      const rs = sanOf(fenAfter, replyPv[0]);
      out.headline = pick([`Ce coup permet ${rs}`, `Attention à la réponse ${rs}`], seed);
      out.why = `Après ${rs}, ${list(newThreats.slice(0, 2).map((h) => `${my(h.t)} en ${sqName(h.sq)}`))} ${newThreats.length > 1 ? 'sont menacés' : `est ${agree(newThreats[0].t, 'menacé')}`} et l’adversaire prend l’initiative : ${drop}.`;
      for (const h of newThreats) out.marks.push({ sq: sqName(h.sq), kind: 'danger' });
      out.arrows.push({ orig: replyPv[0].slice(0, 2), dest: replyPv[0].slice(2, 4), brush: 'red' });
      out.tags.push('allowed:threat:' + newThreats[0].t); out.tip = tipFor('hanging', level, seed);
    }
    else if (of) { out.headline = 'Principe d’ouverture'; out.why = of.txt; out.tags.push(of.tag); out.tip = tipFor('opening', level, seed); }
    else if (po.bad) { out.headline = pick(['Le moteur préfère ' + bestSan, 'Il y avait mieux : ' + bestSan], seed); out.why = po.bad; out.tags.push(po.tag!); }
    else { out.headline = `Le meilleur coup était ${bestSan}`; out.why = level === 'beginner' ? `Ton coup n’est pas une faute grave, mais ${bestSan} était plus fort.` : `Ton coup ne perd pas de matériel tout de suite, mais ${drop}.`; out.tags.push('positional'); }
    out.plan = planOf(c, before, afterBest, bestU, bestSan, level, seed);
    out.facts.push({ kind: 'positional', tag: out.tags[0], eBest: c.eBest, ePlayed: c.ePlayed });
    return out;
  }

  // ——— 5. bons coups ———
  const tac = bestTactic(myVer.filter((x) => x.key !== 'hangingCapture' || MAT[before.b[x.targets[0]]?.t || 'p'] >= 3));
  const eg = endgameNote(before, after, afterBest, me, true, bestSan);
  const po = positional(before, after, afterBest, me, c.ply);
  const saved = hanging(before.b, me).find((h) => !hanging(after.b, me).some((x) => x.sq === h.sq) && h.gain >= 2);
  if (best?.mate != null && best.mate < 0 && !mateNow) {
    out.headline = c.cls === 'best' ? 'La meilleure résistance' : 'Position perdue';
    out.why = `L’adversaire a un mat forcé quoi que tu joues${replyPv.length ? ' : ' + refut(Math.min(2 * Math.abs(best.mate) - 1, 5)) : ''}. Le tournant de la partie est venu plus tôt.`;
    out.tags.push('lostAnyway'); out.facts.push({ kind: 'good', cls: c.cls, tags: out.tags }); return out;
  }
  if (c.cls === 'book') { out.headline = 'Coup de théorie'; out.why = pick(['Un coup classique, joué par les maîtres dans cette position.', 'Tu restes dans les sentiers de la théorie.'], seed); out.tags.push('book'); }
  else if (c.cls === 'brilliant') {
    const sac = myMotifs.find((x) => x.key === 'sacrifice');
    out.headline = 'Coup brillant !';
    out.why = `Tu offres ${sac ? the(after.b[sqIdx(c.uci.slice(2, 4))]?.t || 'n') : 'du matériel'}, mais le moteur confirme que c’est le meilleur coup${replyPv.length ? ' : ' + refut(Math.min(L + 2, 6)) : ''}.`;
    out.tags.push('brilliant');
  } else if (tac) {
    out.headline = `${{ fork: 'Fourchette', skewer: 'Enfilade', pin: 'Clouage', discoveredAttack: 'Attaque à la découverte', discoveredCheck: 'Échec à la découverte', doubleCheck: 'Échec double', trappedPiece: 'Pièce piégée', capturingDefender: 'Élimination du défenseur', overload: 'Surcharge', hangingCapture: 'Bien vu', promotion: 'Promotion' }[tac.key as string] || 'Bien joué'} !`;
    out.why = motifSentence(tac, after, true, seed, before); for (const t of tac.targets) out.marks.push({ sq: sqName(t), kind: 'target' });
    out.tags.push('found:' + tac.key + ':' + tac.piece);
  } else if (c.cls === 'great') {
    out.headline = 'Le seul bon coup !';
    const second = c.lines[1]; const eg2 = second ? (second.mate != null ? (second.mate > 0 ? 'gagnaient aussi' : 'perdaient') : '') : '';
    out.why = eg2 === 'perdaient' ? 'Tous les autres coups perdaient : il fallait le trouver.' : 'Les autres coups laissaient filer une grosse partie de l’avantage.';
    out.tags.push('onlyMove');
  } else if (saved) { out.headline = 'Bonne défense'; out.why = `Tu mets ${my(saved.t)} hors de danger.`; out.tags.push('defended'); }
  else if (eg) { out.headline = 'Bonne technique'; out.why = eg.txt; out.tags.push(eg.tag); }
  else if (po.good) { out.headline = c.cls === 'best' ? 'Meilleur coup' : 'Bon coup'; out.why = po.good; out.tags.push('positional+'); }
  else {
    out.headline = c.cls === 'best' ? 'Meilleur coup' : c.cls === 'excellent' ? 'Excellent' : 'Bon coup';
    out.why = c.cls === 'good' ? `Solide. Le moteur préférait légèrement ${bestSan}.` : pick(['C’est le coup que le moteur recommande.', 'Exactement ce qu’il fallait.', 'Précis : rien à redire.'], seed);
  }
  if (c.cls === 'good') addBest();
  out.facts.push({ kind: 'good', cls: c.cls, tags: out.tags });
  return out;
}

/** Idée du meilleur coup : motif vérifié, sinon amélioration positionnelle, sinon la ligne. */
function planOf(c: MoveCtx, before: Pos, afterBest: Pos | null, bestU: string, bestSan: string, level: Level, seed: string): string | undefined {
  const best = c.lines[0]; if (!best || bestU === c.uci) return undefined;
  const ms = verifyOnLine(moveMotifs(before, mvOf(bestU), false), c.fenBefore, best.pv, applyU, isMateFen).verified;
  const tac = bestTactic(ms);
  if (tac && afterBest) return `Mieux : ${bestSan}. ${motifSentence(tac, afterBest, true, seed, before)}`;
  const tb = trace(c.fenBefore, best.pv, before.turn, 7);
  if (tb.net >= 1) return `Mieux : ${bestSan}, qui permet de ${gainPhrase(tb)}${level !== 'beginner' ? ' (' + lineFr(c.fenBefore, best.pv, 5) + ')' : ''}.`;
  const p = afterBest ? positional(before, afterBest, null, before.turn, c.ply).good : undefined;
  return `Mieux : ${bestSan}${p ? '. ' + p : level !== 'beginner' ? ' (' + lineFr(c.fenBefore, best.pv, 4) + ')' : ''}.`.replace('..', '.');
}
export { NAME };
