// Pilier 1 (cahier GOAT) : diagnostic de l'erreur, point d'entrée unique pour leçons, cours, puzzles, finales,
// ouvertures, fil « Pour toi ». Ordre : (a) alternatives précalculées en CI (src/data/accepts.gen.json, identique
// hors ligne) ; (b) règles sans moteur (chess.js + SEE de geometry.ts : pat, mat manqué, mat permis, pièce en prise,
// échange perdant, objectif manqué) — réponse immédiate ; (c) moteur avec un BUDGET EN NŒUDS (fluide en mono-thread
// sur mobile) : équivalence (même mat ou plus rapide, ≤ EQUIV_CP), puis explication vérifiée sur la ligne (explain.ts).
// Règle d'or (COACH_ARCHITECTURE §2.2) : une affirmation de règle (pièce en prise…) est confirmée par la ligne du moteur
// dès qu'elle est disponible, sinon remplacée par l'explication du moteur.
import { Chess } from 'chess.js';
import ACCEPTS from '../data/accepts.gen.json';
import { equivalence, type Sc } from '../lib/judge-rule';
import { parseFen, sqIdx, sqName, see, attackers, kingSq, opp, applyMove, attacksFrom, inCheck, MAT, type Role, type Color, type Piece } from './geometry';
import { moveMotifs, MOTIF_LABEL, type MotifKey } from './motifs';
import { my, his, cap, sanOf, pick, agree, NAME, the } from './lang';
import { explainMove, type Arrow, type Mark, type Line } from './explain';
import { classifyMove } from './classify';
import { expectedStm } from './winprob';
import { MOTIF_CONCEPT, type ConceptId } from '../data/concepts';

export type MistakeKind = 'illegal' | 'stalemate' | 'missedMate' | 'ignoredCheck' | 'ignoredMateThreat' | 'hanging' | 'losingTrade' | 'allowedTactic' | 'missedTactic' | 'missedFree' | 'wrongGoal' | 'positional' | 'slower';
export const MISTAKE_KINDS: MistakeKind[] = ['illegal', 'stalemate', 'missedMate', 'ignoredCheck', 'ignoredMateThreat', 'hanging', 'losingTrade', 'allowedTactic', 'missedTactic', 'missedFree', 'wrongGoal', 'positional', 'slower'];
export type Audience = 'enfant' | 'debutant' | 'intermediaire' | 'avance';
export type GoalKind = 'mate' | 'check' | 'line' | 'any' | 'puzzle' | 'master' | 'opening' | 'play';
export interface Diagnosis {
  accept: boolean; kind?: MistakeKind; conceptId?: ConceptId;
  headline: string; why: string;
  /** UCI, 0 à 4 demi-coups APRÈS le coup joué (la réponse qui punit) */
  refutation: string[];
  /** une phrase par demi-coup de [coup joué, ...réfutation] (pour « Montre-moi ») */
  narration: string[];
  arrows: Arrow[]; marks: Mark[];
  continuation?: string[];
  source: 'rules' | 'symbolic' | 'engine' | 'precomputed';
  /** coup accepté : phrase positive */
  note?: string;
}
export interface Hint { level: 1 | 2 | 3; text: string; arrows: Arrow[]; marks: Mark[] }
export interface EngineLike { analyse(fen: string, o: { nodes?: number; depth?: number; movetime?: number; multipv?: number; searchmoves?: string[] }): Promise<{ lines: { move: string; pv: string[]; cp: number | null; mate: number | null }[] }> }
export interface DiagnoseCtx {
  fen: string; played: string; expected: string[]; goal: GoalKind; elo?: number; audience?: Audience;
  /** accepter un coup équivalent (leçons) ; sinon on l'explique seulement (puzzles notés) */
  allowEquivalent?: boolean;
  engine?: EngineLike; nodes?: number;
}
export const audienceFor = (elo: number): Audience => (elo < 1000 ? 'debutant' : elo < 1600 ? 'intermediaire' : 'avance');
const ACC = ACCEPTS as Record<string, Record<string, { s: string; pv?: string[] }>>;
export const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
const parseS = (s: string): Sc => (s[0] === 'm' ? { cp: null, mate: +s.slice(1) } : { cp: +s, mate: null });
/** Alternatives précalculées pour une position (null si la position n'est pas du contenu validé). */
export function precomputed(fen: string) { return ACC[fenKey(fen)] || null; }

// ---------- utilitaires ----------
const U = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
function after(fen: string, u: string): Chess | null { try { const c = new Chess(fen); c.move(U(u)); return c; } catch { return null; } }
const mateIn1 = (fen: string): string | null => { const c = new Chess(fen); for (const m of c.moves({ verbose: true })) { const d = new Chess(fen); d.move(m); if (d.isCheckmate()) return m.from + m.to + (m.promotion || ''); } return null; };
const nullFen = (fen: string): string | null => { const p = fen.split(' '); if (new Chess(fen).inCheck()) return null; p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); };
const sanEn = (fen: string, u: string) => { try { return new Chess(fen).move(U(u)).san; } catch { return u; } };
/** formes du coup solution qui ne doivent pas apparaître avant le niveau 3 (FR et EN, avec ou sans +/#) */
export function spoilers(fen: string, u: string): string[] { const en = sanEn(fen, u).replace(/[+#!?]/g, ''); const fr = sanOf(fen, u).replace(/[+#!?]/g, ''); return [...new Set([en, fr])].filter((x) => x.length >= 2); }
const containsAny = (t: string, xs: string[]) => xs.some((x) => new RegExp(`(^|[^A-Za-z0-9])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9])`).test(t));

/** Une phrase par demi-coup (« Montre-moi ») : qui joue, ce qui est pris, échec, mat. */
export function narrate(fen: string, ucis: string[], me: Color): string[] {
  const c = new Chess(fen); const out: string[] = [];
  for (const u of ucis) {
    let m; try { m = c.move(U(u)); } catch { break; }
    const mine = m.color === me;
    const s = sanFrOf(m.san); const pc = m.piece as Role; const cap0 = m.captured as Role | undefined;
    let t = mine ? `Tu joues ${s}` : `L’adversaire répond ${s}`;
    if (cap0) t += mine ? ` : ${my(pc)} prend ${his(cap0)}` : ` : ${his(pc).replace(' adverse', '')} prend ${my(cap0)}`;
    if (m.promotion) t += ` et devient ${m.promotion === 'q' ? 'une dame' : NAME[m.promotion as Role]}`;
    t += c.isCheckmate() ? '. Échec et mat.' : c.isStalemate() ? '. Pat : nulle.' : c.inCheck() ? ', échec.' : '.';
    out.push(t);
  }
  return out;
}
const FRL: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };
const sanFrOf = (san: string) => san.replace(/[KQRBN]/g, (x, i) => (i === 0 || san[i - 1] === '=' ? FRL[x] : x));

// ---------- illégal (sans moteur) ----------
/** Explique pourquoi un coup est illégal (règle, sans moteur). null si le coup est légal. */
export function explainIllegal(fen: string, from: string, to: string): Diagnosis | null {
  const c = new Chess(fen); if (c.moves({ verbose: true }).some((m) => m.from === from && m.to === to)) return null;
  const pos = parseFen(fen); const me = pos.turn; const f = sqIdx(from), t = sqIdx(to); const p = pos.b[f];
  const D = (headline: string, why: string, marks: Mark[] = [], arrows: Arrow[] = []): Diagnosis => ({ accept: false, kind: 'illegal', conceptId: 'moves', headline, why, refutation: [], narration: [], arrows, marks, source: 'rules' });
  if (!p) return D('Il n’y a pas de pièce ici', `La case ${from} est vide : choisis une de tes pièces.`);
  if (p.c !== me) return D('Ce n’est pas ta pièce', `C’est au tour des ${me === 'w' ? 'Blancs' : 'Noirs'} : joue une de tes pièces.`);
  const tgt = pos.b[t]; if (tgt && tgt.c === me) return D('Case occupée par ta pièce', `On ne peut pas prendre ses propres pièces : ${my(tgt.t)} est déjà en ${to}.`, [{ sq: to, kind: 'danger' }]);
  // roque
  if (p.t === 'k' && Math.abs(t - f) === 2 && f % 8 === 4) {
    const side = t > f ? 'K' : 'Q'; const right = me === 'w' ? side : side.toLowerCase();
    if (!pos.castling.includes(right)) return { ...D('Roque interdit', 'Ton roi ou cette tour a déjà bougé : le roque n’est plus possible de ce côté.'), conceptId: 'castling' };
    if (inCheck(pos.b, me)) return { ...D('Roque interdit', 'On ne peut pas roquer quand son roi est en échec.'), conceptId: 'castling' };
    const step = t > f ? 1 : -1; const between = step > 0 ? [f + 1, f + 2] : [f - 1, f - 2, f - 3];
    if (between.some((s) => pos.b[s])) return { ...D('Roque interdit', 'Il ne doit y avoir aucune pièce entre le roi et la tour.'), conceptId: 'castling' };
    const through = [f + step, f + 2 * step].find((s) => attackers(pos.b, s, opp(me)).length);
    if (through != null) { const a = attackers(pos.b, through, opp(me))[0]; return { ...D('Roque interdit', `Ton roi ne peut pas traverser ni atteindre une case attaquée : ${his(pos.b[a]!.t)} en ${sqName(a)} contrôle ${sqName(through)}.`, [{ sq: sqName(through), kind: 'danger' }], [{ orig: sqName(a), dest: sqName(through), brush: 'red' }]), conceptId: 'castling' }; }
  }
  // géométrie : la pièce peut-elle atteindre la case (sans regarder l'échec) ?
  const pseudo = (() => {
    if (p.t === 'p') { const dir = me === 'w' ? 8 : -8; const startRank = me === 'w' ? 1 : 6;
      if (t === f + dir && !tgt) return true; if (t === f + 2 * dir && !tgt && !pos.b[f + dir] && (f >> 3) === startRank) return true;
      if ((t === f + dir - 1 || t === f + dir + 1) && Math.abs((t & 7) - (f & 7)) === 1) return !!tgt || t === pos.ep; return false; }
    return attacksFrom(pos.b, f).includes(t);
  })();
  if (!pseudo) {
    const RULE: Record<Role, string> = { p: 'Le pion avance tout droit d’une case (deux au premier coup) et prend en diagonale.', n: 'Le cavalier saute en L : deux cases puis une sur le côté.', b: 'Le fou se déplace en diagonale, sans sauter par-dessus les pièces.', r: 'La tour se déplace en ligne droite, sans sauter par-dessus les pièces.', q: 'La dame va en ligne droite ou en diagonale, sans sauter par-dessus les pièces.', k: 'Le roi avance d’une seule case, dans n’importe quelle direction.' };
    const blocked = p.t !== 'n' && p.t !== 'k' && p.t !== 'p' && (() => { const nb = pos.b.slice(); for (let s = 0; s < 64; s++) if (s !== f && nb[s]) nb[s] = null; return attacksFrom(nb, f).includes(t); })();
    return D(blocked ? `${cap(my(p.t))} est ${agree(p.t, 'bloqué')}` : `${cap(the(p.t))} ne va pas là`, blocked ? `Une pièce est sur le chemin entre ${from} et ${to}. ${RULE[p.t]}` : RULE[p.t], [{ sq: from, kind: 'target' }]);
  }
  // le coup laisserait (ou mettrait) le roi en échec
  const nb = applyMove(pos.b, f, t, undefined, pos.ep); const ks = kingSq(nb, me); const att = attackers(nb, ks, opp(me));
  const a0 = att[0] != null ? nb[att[0]] as Piece : null; const aS = att[0] != null ? sqName(att[0]) : '';
  const arrows: Arrow[] = att[0] != null ? [{ orig: aS, dest: sqName(ks), brush: 'red' }] : [];
  if (p.t === 'k') return { ...D('Ton roi serait en échec', `En ${to}, ton roi serait attaqué : ${a0 ? `${his(a0.t)} en ${aS} contrôle cette case` : 'cette case est contrôlée'}. Le roi ne va jamais sur une case attaquée.`, [{ sq: to, kind: 'danger' }], arrows), conceptId: 'check' };
  if (inCheck(pos.b, me)) { const a1 = attackers(pos.b, kingSq(pos.b, me), opp(me))[0]; return { ...D('Ton roi est en échec', `${a1 != null ? cap(his(pos.b[a1]!.t)) + ' en ' + sqName(a1) + ' attaque ton roi' : 'Ton roi est attaqué'} : ce coup ne pare pas l’échec. Fuis avec le roi, interpose une pièce ou prends l’attaquant.`, [{ sq: sqName(kingSq(pos.b, me)), kind: 'danger' }], a1 != null ? [{ orig: sqName(a1), dest: sqName(kingSq(pos.b, me)), brush: 'red' }] : []), conceptId: 'check' }; }
  return { ...D(`${cap(my(p.t))} est ${agree(p.t, 'cloué')}`, `Si ${my(p.t)} quitte ${from}, ${a0 ? `${his(a0.t)} en ${aS}` : 'une pièce adverse'} attaque ton roi. Une pièce clouée devant son roi ne peut pas bouger.`, [{ sq: from, kind: 'danger' }], arrows), conceptId: 'pin' };
}

// ---------- indices gradués (toujours 3 niveaux) ----------
/** Niveau 1 : où regarder ; niveau 2 : quelle pièce ; niveau 3 : quel coup (flèche, l'élève le joue). Les niveaux 1 et 2 ne contiennent jamais le coup solution. */
export function graduatedHints(ctx: { fen: string; expected: string[]; authored?: string[]; audience?: Audience; mateGoal?: boolean }): Hint[] {
  const { fen } = ctx; const u = ctx.expected[0]; if (!u) return [];
  const pos = parseFen(fen); const me = pos.turn; const f = sqIdx(u.slice(0, 2)), t = sqIdx(u.slice(2, 4)); const p = pos.b[f];
  const a = after(fen, u); const sp = spoilers(fen, u); const seed = fen + u;
  const authored = (ctx.authored || []).filter((h) => !containsAny(h, sp));
  const oppK = sqName(kingSq(pos.b, opp(me)));
  const acc = precomputed(fen)?.[u]; const mateLine = !!a?.isCheckmate() || ctx.mateGoal || (acc?.s?.[0] === 'm' && +acc.s.slice(1) > 0);
  const motifs = (() => { try { return moveMotifs(pos, { from: f, to: t, promo: (u[4] as Role) || undefined }, false); } catch { return []; } })();
  const tac = motifs.find((m) => !['check', 'sacrifice', 'mate'].includes(m.key) && m.targets.length);
  let l1: Hint;
  if (mateLine) l1 = { level: 1, text: pick(['Regarde le roi adverse : il a peu de cases.', 'Le roi adverse est presque enfermé. Quelles cases lui restent ?'], seed), arrows: [], marks: [{ sq: oppK, kind: 'target' }] };
  else if (tac) { const ts = tac.targets.slice(0, 2).map(sqName); l1 = { level: 1, text: `Regarde ${ts.length > 1 ? 'les pièces adverses en ' + ts.join(' et ') : his(pos.b[tac.targets[0]]?.t || 'p') + ' en ' + ts[0]} : ${pick(['elles sont vulnérables ensemble.', 'une seule pièce peut les attaquer.'], seed)}`.replace(/ adverse en (\w\d) : elles sont vulnérables ensemble\./, ' adverse en $1 : il y a quelque chose à gagner.').replace(/ adverse en (\w\d) : une seule pièce peut les attaquer\./, ' adverse en $1 : elle est vulnérable.'), arrows: [], marks: ts.map((sq) => ({ sq, kind: 'target' as const })) }; }
  else if (pos.b[t] && pos.b[t]!.c !== me) l1 = { level: 1, text: `Regarde ${his(pos.b[t]!.t)} en ${sqName(t)} : est-elle bien protégée ?`.replace(/est-elle/, ['r', 'q'].includes(pos.b[t]!.t) ? 'est-elle' : 'est-il'), arrows: [], marks: [{ sq: sqName(t), kind: 'target' }] };
  else if (a?.inCheck()) l1 = { level: 1, text: 'Un échec peut forcer la suite : regarde le roi adverse.', arrows: [], marks: [{ sq: oppK, kind: 'target' }] };
  else if (u[4]) l1 = { level: 1, text: 'Regarde tes pions les plus avancés.', arrows: [], marks: [{ sq: u.slice(0, 2), kind: 'target' }] };
  else { const file = t & 7; const zone = file <= 2 ? 'à l’aile dame' : file >= 5 ? 'à l’aile roi' : 'au centre'; l1 = { level: 1, text: `Le coup important se joue ${zone}. Cherche d’abord les échecs, les prises et les menaces.`, arrows: [], marks: [] }; }
  if (authored[0]) l1 = { ...l1, text: authored[0] };
  const role = (p?.t || 'p') as Role;
  let l2: Hint = { level: 2, text: `${cap(my(role))} en ${sqName(f)} peut faire quelque chose.`.replace('peut', role === 'p' ? 'peut' : 'peut'), arrows: [], marks: [{ sq: sqName(f), kind: 'hint' }] };
  if (authored[1]) l2 = { ...l2, text: authored[1] };
  const san = sanOf(fen, u);
  const l3: Hint = { level: 3, text: `Le coup : ${san}. À toi de le jouer.`, arrows: [{ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'green' }], marks: [] };
  return [l1, l2, l3];
}

// ---------- règles (immédiates) ----------
const conceptOfKind = (k: MistakeKind, motif?: string): ConceptId => (motif && MOTIF_CONCEPT[motif]) || ({ illegal: 'moves', stalemate: 'stalemate', missedMate: 'mate-in-1', ignoredCheck: 'check', ignoredMateThreat: 'threat', hanging: 'hanging', losingTrade: 'captures', allowedTactic: 'threat', missedTactic: 'calculation', missedFree: 'hanging', wrongGoal: 'checkmate', positional: 'planning', slower: 'calculation' } as Record<MistakeKind, ConceptId>)[k];
function ruleDiagnosis(ctx: DiagnoseCtx): Diagnosis | null {
  const { fen, played } = ctx; const a = after(fen, played); if (!a) return null;
  const pos = parseFen(fen); const me = pos.turn; const seed = fen + played; const aud = ctx.audience || 'debutant';
  const sanP = sanOf(fen, played); const fa = a.fen(); const exp = ctx.expected[0];
  const base = (kind: MistakeKind, headline: string, why: string, refutation: string[] = [], marks: Mark[] = [], arrows: Arrow[] = [], motif?: string): Diagnosis =>
    ({ accept: false, kind, conceptId: conceptOfKind(kind, motif), headline, why, refutation, narration: narrate(fen, [played, ...refutation], me), arrows, marks, source: 'rules' });
  const expA = exp ? after(fen, exp) : null; const acc = precomputed(fen); const expS = exp && acc?.[exp] ? parseS(acc[exp].s) : null;
  const expMates = !!expA?.isCheckmate() || (expS?.mate != null && expS.mate > 0) || ctx.goal === 'mate';
  // 2. pat
  if (a.isStalemate()) return base('stalemate', 'Pat : la partie est nulle', `Après ${sanP}, l’adversaire n’a plus aucun coup légal mais n’est pas en échec : c’est pat, donc nulle. ${aud === 'avance' ? 'Laisse toujours une case au roi adverse.' : 'Laisse toujours au moins une case au roi adverse !'}`, [], [{ sq: sqName(kingSq(parseFen(fa).b, opp(me))), kind: 'danger' }]);
  // 2b. objectif « donne échec » : le coup ne met pas le roi en échec
  if (ctx.goal === 'check' && !a.inCheck()) {
    const ksq = sqName(kingSq(parseFen(fa).b, opp(me)));
    return base('wrongGoal', 'Ce coup ne donne pas échec', `La consigne demande un échec : après ${sanP}, le roi adverse en ${ksq} n’est attaqué par aucune de tes pièces. Cherche une pièce qui peut viser ${ksq} en un coup.`, [], [{ sq: ksq, kind: 'hint' }], [], 'check');
  }
  // 3. mat manqué (mat en 1 sur l'échiquier, ou mat de l'exercice d'après les alternatives précalculées)
  const m1 = mateIn1(fen);
  if (m1 && !a.isCheckmate()) return base('missedMate', 'Il y avait un mat en 1', pick(['Le roi adverse n’a presque plus de cases : un seul coup le mate tout de suite. Cherche les échecs.', 'Regarde tous tes échecs : l’un d’eux est mat.'], seed), [], [{ sq: sqName(kingSq(pos.b, opp(me))), kind: 'target' }]);
  // 4. mat permis (menace de mat ignorée)
  const theirMate = !a.isGameOver() ? mateIn1(fa) : null;
  if (theirMate) {
    const before = nullFen(fen); const existed = !!(before && mateIn1(before));
    return base(existed ? 'ignoredMateThreat' : 'allowedTactic', existed ? 'Tu n’as pas vu la menace de mat' : 'Ce coup permet un mat', `Après ${sanP}, ${sanOf(fa, theirMate)} est mat. ${existed ? 'L’adversaire menaçait déjà ce mat : pare-le d’abord.' : 'Vérifie toujours les échecs de l’adversaire avant de jouer.'}`, [theirMate], [{ sq: sqName(kingSq(parseFen(fa).b, me)), kind: 'danger' }], [{ orig: theirMate.slice(0, 2), dest: theirMate.slice(2, 4), brush: 'red' }], 'mateThreat');
  }
  // 4b. échec à la découverte (qui gagne du matériel) déjà menacé et ignoré, ou permis par le coup
  const disc = discoveredWin(fa, me);
  if (disc) {
    const before = nullFen(fen); const existed = !!(before && discoveredWin(before, me));
    const mvSan = sanOf(fa, disc.u);
    return base(existed ? 'ignoredCheck' : 'allowedTactic', existed ? 'Tu n’as pas vu l’échec à la découverte' : 'Ce coup permet un échec à la découverte',
      `Après ${sanP}, ${mvSan} : ${his(disc.mover).replace(' adverse', '')} adverse s’écarte en donnant échec avec ${his(disc.checker)}${disc.gain ? ` et prend ${my(disc.gain)}` : ''}. ${existed ? 'Cette menace existait déjà : mets ton roi hors de la ligne d’abord.' : 'Méfie-toi des pièces adverses alignées avec ton roi.'}`,
      [disc.u], [{ sq: sqName(kingSq(parseFen(fa).b, me)), kind: 'danger' }], [{ orig: disc.u.slice(0, 2), dest: disc.u.slice(2, 4), brush: 'red' }], 'discoveredCheck');
  }
  if (expMates && !a.isCheckmate() && expS) {
    const sp = acc?.[played] ? parseS(acc[played].s) : null;
    if (!sp) return null; // le moteur dira si c'est aussi un mat
  }
  // 5-6. pièce en prise / échange perdant (SEE)
  const pa = parseFen(fa); const to = sqIdx(played.slice(2, 4)); const from = sqIdx(played.slice(0, 2)); const moved = pa.b[to]!;
  const capd = pos.b[to];
  if (capd && capd.c !== me) { const g = see(pos.b, to, me, from); if (g < 0 && MAT[moved.t] >= 3) { const re = leastAtt(pa.b, to, opp(me)); return base('losingTrade', 'Cet échange te coûte du matériel', `${cap(my(moved.t))} prend ${his(capd.t)} (${MAT[capd.t]}), mais il est repris : tu donnes ${MAT[moved.t]} pour ${MAT[capd.t]}.`, re ? [re] : [], [{ sq: sqName(to), kind: 'danger' }], re ? [{ orig: re.slice(0, 2), dest: re.slice(2, 4), brush: 'red' }] : []); } }
  const risk = (() => { const g = see(pa.b, to, opp(me)); return g > 0 && (MAT[moved.t] >= 3 || g >= 1) ? g : 0; })();
  if (risk > 0 && !(capd && MAT[capd.t] >= MAT[moved.t])) {
    const re = leastAtt(pa.b, to, opp(me)); const att = re ? pa.b[sqIdx(re.slice(0, 2))] : null;
    return base('hanging', pick([`${cap(my(moved.t))} peut être ${agree(moved.t, 'pris')}`, `${cap(my(moved.t))} n’est pas ${agree(moved.t, 'protégé')}`], seed),
      `Après ${sanP}, ${att ? `${his(att.t).replace(' adverse', '')} ${att.t === 'p' ? 'adverse ' : ''}prend ${my(moved.t)} en ${sqName(to)}` : `${my(moved.t)} en ${sqName(to)} tombe`}${risk >= MAT[moved.t] ? ' gratuitement' : ''}.`.replace('adverse adverse', 'adverse'), re ? [re] : [], [{ sq: sqName(to), kind: 'danger' }], re ? [{ orig: re.slice(0, 2), dest: re.slice(2, 4), brush: 'red' }] : []);
  }
  const newly = (() => { for (let s = 0; s < 64; s++) { const q = pa.b[s]; if (!q || q.c !== me || q.t === 'k' || q.t === 'p' || s === to) continue; const g = see(pa.b, s, opp(me)); if (g >= 3 && see(pos.b, s, opp(me)) <= 0) return { s, q, g }; } return null; })();
  if (newly) { const re = leastAtt(pa.b, newly.s, opp(me)); return base('hanging', `Ce coup laisse ${my(newly.q.t)} sans défense`, `${cap(my(newly.q.t))} en ${sqName(newly.s)} était ${agree(newly.q.t, 'protégé')} ; après ${sanP}, l’adversaire peut ${agree(newly.q.t, 'la').replace('lae', 'la') === 'la' ? 'la' : 'le'} prendre.`.replace(/peut l[ae] prendre/, (x) => (['r', 'q'].includes(newly.q.t) ? 'peut la prendre' : 'peut le prendre')), re ? [re] : [], [{ sq: sqName(newly.s), kind: 'danger' }], re ? [{ orig: re.slice(0, 2), dest: re.slice(2, 4), brush: 'red' }] : []); }
  // 9. objectif : on demandait un mat, le coup gagne du matériel (formulation valorisante)
  if ((ctx.goal === 'mate' || (expMates && ['line', 'any'].includes(ctx.goal))) && !a.isCheckmate() && capd && capd.c !== me && see(pos.b, to, me, from) > 0)
    return base('wrongGoal', 'Bien vu, mais on cherche le mat', `${sanP} gagne ${his(capd.t)}, c’est un bon réflexe. Ici pourtant, il y a encore mieux : un mat. ${aud === 'avance' ? 'Les coups forçants d’abord.' : 'Cherche les échecs.'}`, [], [{ sq: sqName(kingSq(pos.b, opp(me))), kind: 'target' }]);
  return null;
}
/** Échec à la découverte de l'adversaire (dans `fen`, au trait) qui prend une pièce ≥ 3 ou la dame. */
function discoveredWin(fen: string, me: Color): { u: string; mover: Role; checker: Role; gain?: Role } | null {
  let c: Chess; try { c = new Chess(fen); } catch { return null; }
  for (const m of c.moves({ verbose: true })) {
    const d = new Chess(fen); d.move(m); if (!d.inCheck() || d.isCheckmate()) continue;
    const b = parseFen(d.fen()).b; const ks = kingSq(b, me); const att = attackers(b, ks, opp(me));
    const other = att.find((x) => sqName(x) !== m.to); if (other == null) continue;
    const gain = m.captured as Role | undefined; if (!gain || MAT[gain] < 3) continue;
    return { u: m.from + m.to + (m.promotion || ''), mover: m.piece as Role, checker: b[other]!.t, gain };
  }
  return null;
}
function leastAtt(b: (Piece | null)[], s: number, by: Color): string | null {
  let best = -1, bv = 1e9; for (const x of attackers(b, s, by)) { const v = b[x]!.t === 'k' ? 100 : MAT[b[x]!.t]; if (v < bv) { bv = v; best = x; } }
  if (best < 0) return null; if (b[best]!.t === 'k' && attackers(b, s, by === 'w' ? 'b' : 'w').length) return null;
  const promo = b[best]!.t === 'p' && ((s >> 3) === 7 || (s >> 3) === 0) ? 'q' : '';
  return sqName(best) + sqName(s) + promo;
}

// ---------- point d'entrée ----------
/** Diagnostic immédiat (sans moteur) : précalculé, puis règles. Peut renvoyer une phrase provisoire (source « symbolic »). */
export function diagnoseFast(ctx: DiagnoseCtx): Diagnosis {
  const pre = precomputedVerdict(ctx); if (pre) return pre;
  const r = ruleDiagnosis(ctx); if (r) return r;
  const me = parseFen(ctx.fen).turn;
  return { accept: false, headline: 'Le coach regarde ton coup…', why: '', refutation: [], narration: narrate(ctx.fen, [ctx.played], me), arrows: [], marks: [], source: 'symbolic' };
}
function precomputedVerdict(ctx: DiagnoseCtx): Diagnosis | null {
  const acc = precomputed(ctx.fen); const exp = ctx.expected[0]; if (!acc || !exp || !ctx.allowEquivalent) return null;
  const e = acc[exp], p = acc[ctx.played]; if (!e || !p || ctx.played === exp) return null;
  const eq = equivalence(parseS(e.s), parseS(p.s)); if (eq === 'worse') return null;
  const sanP = sanOf(ctx.fen, ctx.played), sanE = sanOf(ctx.fen, exp); const me = parseFen(ctx.fen).turn;
  const mateN = parseS(p.s).mate;
  return { accept: true, headline: 'Ta solution marche aussi', why: '', note: eq === 'mate-equal' ? `Ta solution marche aussi : ${sanP} mate en ${mateN} comme ${sanE}. Termine le mat.` : `${sanP} est aussi bon selon le moteur. L’idée de la leçon était ${sanE}.`,
    continuation: eq === 'mate-equal' ? p.pv || [] : [], refutation: [], narration: narrate(ctx.fen, [ctx.played], me), arrows: [], marks: [], source: 'precomputed' };
}
const KIND_OF_TAG = (tag: string): { kind: MistakeKind; motif?: string } => {
  if (tag.startsWith('missedMate')) return { kind: 'missedMate', motif: 'mate' };
  if (tag.startsWith('allowedMate')) return { kind: 'allowedTactic', motif: 'mateThreat' };
  if (tag.startsWith('allowed:hanging') || tag.startsWith('allowed:threat') || tag === 'allowed:material') return { kind: 'hanging', motif: 'hanging' };
  if (tag.startsWith('allowed:')) return { kind: 'allowedTactic', motif: tag.split(':')[1] };
  if (tag.startsWith('ignored:')) return { kind: 'hanging', motif: 'threat' };
  if (tag === 'missed:material' || tag.startsWith('missed:hangingCapture')) return { kind: 'missedFree', motif: 'hanging' };
  if (tag.startsWith('missed:')) return { kind: 'missedTactic', motif: tag.split(':')[1] };
  return { kind: 'positional' };
};
/** Diagnostic complet : précalculé → règles (confirmées par le moteur) → moteur (budget en nœuds). */
export async function diagnose(ctx: DiagnoseCtx): Promise<Diagnosis> {
  const pre = precomputedVerdict(ctx); if (pre) return pre;
  const rule = ruleDiagnosis(ctx); const eng = ctx.engine; const N = ctx.nodes ?? 150_000;
  if (rule && rule.kind === 'wrongGoal' && ctx.goal === 'check') return rule; // objectif vérifiable sans moteur
  if (!eng) return rule || diagnoseFast(ctx);
  const { fen, played } = ctx; const exp = ctx.expected[0]; const me = parseFen(fen).turn; const elo = ctx.elo ?? 1000; const a = after(fen, played)!;
  const fa = a.fen();
  // séquentiel : un seul moteur (worker WASM ou processus UCI) ne traite qu'une recherche à la fois
  const rb = await eng.analyse(fen, { nodes: N, multipv: 2 });
  const rp = a.isGameOver() ? { lines: [] as any[] } : await eng.analyse(fa, { nodes: N, multipv: 1 });
  const before: Line[] = rb.lines.map((l) => ({ move: l.move, pv: l.pv, cp: l.cp, mate: l.mate }));
  if (exp && before[0]?.move !== exp) { const re = await eng.analyse(fen, { nodes: N, searchmoves: [exp] }); const x = re.lines[0]; if (x) before.unshift({ move: exp, pv: x.pv, cp: x.cp, mate: x.mate }); }
  const reply = rp.lines[0] ? { move: rp.lines[0].move, pv: rp.lines[0].pv, cp: rp.lines[0].cp, mate: rp.lines[0].mate } : null;
  // score du coup joué, du point de vue du joueur
  const playedSc: Sc = a.isCheckmate() ? { cp: null, mate: 1 } : a.isGameOver() ? { cp: 0, mate: null } : reply ? { cp: reply.cp != null ? -reply.cp : null, mate: reply.mate != null ? (reply.mate > 0 ? -reply.mate : -reply.mate + 1) : null } : { cp: 0, mate: null };
  const expLine = exp ? before.find((l) => l.move === exp) : before[0]; const expA = exp ? after(fen, exp) : null;
  const expSc: Sc = expA?.isCheckmate() ? { cp: null, mate: 1 } : { cp: expLine?.cp ?? null, mate: expLine?.mate ?? null };
  const eq = equivalence(expSc, playedSc);
  const sanP = sanOf(fen, played), sanE = exp ? sanOf(fen, exp) : '';
  if (eq !== 'worse' && ctx.allowEquivalent) {
    return { accept: true, headline: 'Ta solution marche aussi', why: '', note: eq === 'mate-equal' ? `Ta solution marche aussi : ${sanP} mate en ${playedSc.mate} comme ${sanE}. Termine le mat.` : `${sanP} est aussi bon selon le moteur. L’idée de la leçon était ${sanE}.`,
      continuation: eq === 'mate-equal' ? (reply?.pv || []) : [], refutation: [], narration: narrate(fen, [played], me), arrows: [], marks: [], source: 'engine' };
  }
  const refutation: string[] = ((reply?.pv || []) as string[]).slice(0, 3);
  // coup aussi bon selon le moteur, mais l'exercice veut autre chose (méthode, réponse précise) : jamais « Excellent » refusé
  if (eq !== 'worse') return { accept: false, kind: 'positional', conceptId: 'planning', headline: 'Ce coup tient aussi, mais ce n’est pas l’idée ici', why: ctx.goal === 'mate' ? 'Il ne perd rien, mais ce n’est pas le mat demandé. Cherche un coup qui force (échecs, prises, menaces).' : 'Selon le moteur, ton coup ne perd rien. L’exercice travaille une autre idée : relis la consigne.', refutation: [], narration: narrate(fen, [played], me), arrows: [], marks: [], source: 'engine' };
  // règle confirmée par la ligne : la pièce annoncée en prise est bien prise dans la réfutation
  if (rule && rule.kind !== 'positional') {
    const markSq = rule.marks.find((m) => m.kind === 'danger')?.sq;
    const confirmed = rule.kind === 'stalemate' || rule.kind === 'missedMate' || rule.kind === 'wrongGoal' || ((rule.kind === 'allowedTactic' || rule.kind === 'ignoredMateThreat') && reply?.mate != null && reply.mate > 0)
      || (!!rule.refutation[0] && rule.refutation[0] === refutation[0])
      || (!!markSq && refutation.slice(0, 3).some((u, i) => i % 2 === 0 && u.slice(2, 4) === markSq));
    if (confirmed && eq === 'worse') return { ...rule, refutation: rule.refutation.length ? rule.refutation : refutation, narration: narrate(fen, [played, ...(rule.refutation.length ? rule.refutation : refutation)], me), source: 'engine' };
  }
  // tactique permise, confirmée par la ligne du moteur : la réfutation (3 demi-coups au plus, puis ta reprise) te
  // coûte au moins 2 points de matériel ; motif de la réponse adverse (fourchette, clouage…) si on le reconnaît
  if (reply && refutation.length) {
    const matOf = (f: string) => { const P = parseFen(f); let x = 0; for (const q of P.b) if (q) x += (q.c === me ? 1 : -1) * MAT[q.t]; return x; };
    const ch2 = new Chess(fa); const pv = (reply.pv as string[]).slice(0, 4); let ok = true;
    for (const u of pv) { try { ch2.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as any }); } catch { ok = false; break; } }
    const loss = ok ? matOf(fa) - matOf(ch2.fen()) : 0;
    if (loss >= 2 && (expSc.mate == null || expSc.mate > 3)) {
      const Pa = parseFen(fa); const r0 = reply.move as string; const mo = moveMotifs(Pa, { from: sqIdx(r0.slice(0, 2)), to: sqIdx(r0.slice(2, 4)) })[0];
      const lab = mo ? MOTIF_LABEL[mo.key] : null; const sanR = sanOf(fa, r0);
      return { accept: false, kind: 'allowedTactic', conceptId: conceptOfKind('allowedTactic', mo?.key), headline: lab ? `Ce coup permet une tactique : ${lab.toLowerCase()}` : 'Ce coup permet une tactique adverse', why: `Après ${sanP}, l’adversaire a ${sanR}${lab ? ` (${lab.toLowerCase()})` : ''} : tu perds du matériel (${loss} point${loss > 1 ? 's' : ''}). Avant de jouer, regarde les échecs, prises et menaces de l’adversaire.`, refutation, narration: narrate(fen, [played, ...refutation], me), arrows: [{ orig: r0.slice(0, 2), dest: r0.slice(2, 4), brush: 'red' }], marks: [], source: 'engine' };
    }
  }
  // matériel gratuit manqué : le coup attendu prend une pièce (≥ 3) que l'échange gagne, et ton coup ne la prend pas
  if (exp && played.slice(2, 4) !== exp.slice(2, 4)) {
    const P0 = parseFen(fen); const fr = sqIdx(exp.slice(0, 2)), to = sqIdx(exp.slice(2, 4)); const tgt = P0.b[to];
    if (tgt && tgt.c !== me && MAT[tgt.t] >= 3 && see(P0.b, to, me, fr) >= 3) {
      const sq = exp.slice(2, 4);
      return { accept: false, kind: 'missedFree', conceptId: 'hanging', headline: 'Du matériel était à prendre', why: `${cap(his(tgt.t))} n’était pas assez protégé${tgt.t === 'q' || tgt.t === 'r' ? 'e' : ''}. Avant chaque coup, regarde ce que tu peux prendre gratuitement.`, refutation, narration: narrate(fen, [played, ...refutation], me), arrows: [], marks: [{ sq, kind: 'hint' }], source: 'engine' };
    }
  }
  // mat plus lent
  if (expSc.mate != null && expSc.mate > 0 && playedSc.mate != null && playedSc.mate > 0)
    return { accept: false, kind: 'slower', conceptId: 'calculation', headline: 'Ça mate aussi, mais plus lentement', why: `Après ${sanP}, le mat arrive en ${playedSc.mate} coups ; il y a plus rapide (mat en ${expSc.mate}). Cherche le coup le plus forçant.`, refutation, narration: narrate(fen, [played, ...refutation], me), arrows: [], marks: [], source: 'engine' };
  // explication vérifiée du coach (explain.ts), sans dévoiler la solution
  const eBest = expectedStm({ cp: before[0]?.cp ?? 0, mate: before[0]?.mate ?? null }, elo);
  const ePlayed = a.isCheckmate() ? 1 : reply ? 1 - expectedStm({ cp: reply.cp, mate: reply.mate }, elo) : 0.5;
  const dE = Math.max(0, eBest - ePlayed); const gap12 = before[1] ? eBest - expectedStm(before[1], elo) : null;
  const cls = classifyMove({ dE, eBest, ePlayed, eBefore: eBest, isBest: false, book: false, sacrifice: false, gap12, mate: a.isCheckmate(), elo });
  const ex = explainMove({ fenBefore: fen, uci: played, cls, dE, eBefore: eBest, ePlayed, eBest, lines: before, reply, elo, ply: 0, history: [], mine: true });
  // priorité : ce que ton coup permet (concret, vérifiable dans la réfutation) avant ce qu'il manque ; un mat manqué
  // n'est annoncé que s'il est court (≤ 3 coups)
  const shortMate = expSc.mate != null && expSc.mate > 0 && expSc.mate <= 3;
  const order = [/^allowedMate/, /^allowed:/, /^ignored/, ...(shortMate ? [/^missedMate/] : []), /^missed:/, /^missed/];
  const tag = order.map((re) => ex.tags.find((t) => re.test(t) && (shortMate || t !== 'missedMate'))).find(Boolean) || ex.tags.find((t) => !/^(missed|allowed|ignored)/.test(t)) || '';
  const { kind, motif } = KIND_OF_TAG(tag);
  const sp = exp ? spoilers(fen, exp) : []; const hide = (x: string) => sp.reduce((s, w) => s.split(w).join('le bon coup'), x);
  let headline = hide(ex.headline), why = hide(ex.why);
  if (kind === 'missedTactic') { const lab = MOTIF_LABEL[motif as MotifKey]; headline = lab ? `Une tactique t’échappe : ${lab.toLowerCase()}` : 'Il y a une tactique à trouver'; why = 'Ton coup laisse passer l’occasion. Repère les pièces adverses mal protégées et les coups forçants (échecs, prises, menaces).'; }
  if (kind === 'missedFree') { headline = 'Du matériel était à prendre'; why = 'Une pièce adverse était mal protégée. Avant chaque coup, regarde ce que tu peux prendre gratuitement.'; }
  if (kind === 'missedMate') { headline = 'Il y avait un mat'; why = `Le roi adverse n’a presque plus de cases. Après ${sanP}, ${playedSc.mate != null && playedSc.mate > 0 ? `le mat est plus lent (${playedSc.mate} coups)` : 'il n’y a plus de mat'}. Cherche les échecs.`; }
  if (kind === 'positional') { headline = 'Il y a plus fort ici'; if (!why || containsAny(why, sp)) why = 'Ton coup n’est pas une faute grave, mais il y a nettement mieux. Cherche un coup qui crée une menace ou améliore ta pièce la moins active.'; }
  return { accept: false, kind, conceptId: conceptOfKind(kind, motif), headline, why, refutation, narration: narrate(fen, [played, ...refutation], me), arrows: ex.arrows.filter((x) => !(exp && x.orig === exp.slice(0, 2) && x.dest === exp.slice(2, 4))), marks: ex.marks, source: 'engine' };
}
