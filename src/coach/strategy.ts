// Raisons stratégiques d'une erreur sans perte de matériel immédiate.
// 1) « la menace d'abord » : on lit la ligne de réfutation (menace de mat, série d'échecs, matériel perdu plus loin,
//    pion passé qui file) ; 2) attribution : on compare des termes d'évaluation classiques (roi, structure, activité,
//    développement, espace) au bout de la ligne jouée et de la meilleure ligne ; le terme le plus dégradé est la raison ;
// 3) prophylaxie : la réponse clé de l'adversaire était-elle empêchée par le meilleur coup ? 4) plans de structures types.
// Tout est déterministe et ancré sur les lignes de Stockfish : aucune phrase sans fait vérifiable sur l'échiquier.
import { Chess } from 'chess.js';
import { threatOn, parseFen, sqName, sqIdx, opp, fileOf, rankOf, attackers, attacksFrom, kingSq, count, nonPawnMat, MAT, onBoard, KING, type Color, type Pos, type Piece, type Role } from './geometry';
import { pawnInfo, kingInfo, outposts, undeveloped } from './motifs';
import { my, his, cap, list, lineFr, sanOf, materialWords, NAME, agree, fem } from './lang';

export type StratCat = 'kingSafety' | 'pawnStructure' | 'activity' | 'development' | 'space' | 'threat' | 'prophylaxis';
export interface StratLine { move: string; pv: string[]; cp: number | null; mate: number | null }
export interface StratReason {
  cat: StratCat; tag: string; why: string; headline?: string; plan?: string; tip?: string;
  marks: { sq: string; kind: 'danger' | 'target' | 'good' | 'hint' }[]; arrows: { orig: string; dest: string; brush: 'red' | 'green' | 'blue' | 'yellow' }[];
  terms?: Record<string, number>;
}
type B = (Piece | null)[];
const applyU = (fen: string, u: string): string | null => { try { const c = new Chess(fen); c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c.fen(); } catch { return null; } };
const walk = (fen: string, ucis: string[], n: number): string[] => { const out = [fen]; let f = fen; for (const u of ucis.slice(0, n)) { const nf = applyU(f, u); if (!nf) break; out.push(nf); f = nf; } return out; };
const rel = (s: number, c: Color) => (c === 'w' ? rankOf(s) : 7 - rankOf(s));
const FILES = 'abcdefgh';
const pawnAttacked = (b: B, s: number, by: Color) => attackers(b, s, by).some((a) => b[a]!.t === 'p');
const middlegame = (b: B) => nonPawnMat(b, 'w') + nonPawnMat(b, 'b') >= 30;

// ———————————— termes d'évaluation (centi-pions approximatifs, point de vue de c) ————————————
function kingDanger(pos: Pos, c: Color): number {
  const b = pos.b; const e = opp(c); if (nonPawnMat(b, e) < 10) return 0;
  const ki = kingInfo(pos, c); const q = count(b, e, 'q') > 0 ? 1 : 0.55;
  let d = 9 * ki.zoneAttackers + q * (14 * Math.max(0, 3 - ki.shield) + 9 * ki.openFiles);
  d += 6 * holes(b, c).length * q;
  if (!ki.castled && !ki.canCastle && middlegame(b)) d += 25;
  return d;
}
/** Cases devant le roi (2 rangées, 3 colonnes) qu'aucun pion ami ne peut plus défendre, et que l'adversaire vise. */
function holes(b: B, c: Color): number[] {
  const k = kingSq(b, c); if (k < 0) return []; const f = fileOf(k), r = rankOf(k); const fw = c === 'w' ? 1 : -1;
  if (rel(k, c) > 1) return [];
  const out: number[] = [];
  for (const x of [f - 1, f, f + 1]) for (const d of [1, 2]) {
    const y = r + fw * d; if (!onBoard(x, y)) continue; const s = y * 8 + x; if (b[s]?.c === c && b[s]?.t === 'p') continue;
    // un pion ami peut-il un jour couvrir s ? (pion sur colonne voisine, derrière s)
    const coverable = [x - 1, x + 1].some((xx) => { if (xx < 0 || xx > 7) return false; for (let yy = y - fw; yy >= 0 && yy < 8; yy -= fw) { const p = b[yy * 8 + xx]; if (p?.t === 'p' && p.c === c) return true; } return false; });
    if (!coverable && attackers(b, s, opp(c)).some((a) => b[a]!.t !== 'k')) out.push(s);
  }
  return out;
}
const PASSED = [0, 5, 10, 16, 28, 45, 70, 0];
/** Structure « stable » : on retire les pions en prise (ils relèvent du matériel, pas de la structure). */
export function stable(b: B): B { const o = b.slice(); for (let s = 0; s < 64; s++) if (b[s]?.t === 'p' && threatOn(b, s) > 0) o[s] = null; return o; }
function pawnScore(b: B, c: Color): number {
  const p = pawnInfo(b, c); let s = -14 * p.isolated.length - 9 * p.doubled.length - 12 * p.backward.length;
  for (const x of p.passed) s += PASSED[rel(x, c)] + (p.protectedPassed.includes(x) ? 8 : 0);
  return s;
}
function badBishop(b: B, c: Color): { sq: number; n: number }[] {
  const out: { sq: number; n: number }[] = [];
  for (let s = 0; s < 64; s++) { const p = b[s]; if (p?.c !== c || p.t !== 'b') continue; const col = (fileOf(s) + rankOf(s)) & 1; let n = 0;
    for (let t = 0; t < 64; t++) { const q = b[t]; if (q?.t === 'p' && q.c === c && ((fileOf(t) + rankOf(t)) & 1) === col && fileOf(t) >= 2 && fileOf(t) <= 5) { const fw = t + (c === 'w' ? 8 : -8); if (fw >= 0 && fw < 64 && b[fw]) n++; } }
    if (n >= 2) out.push({ sq: s, n }); }
  return out;
}
function safeMob(b: B, c: Color): number {
  let n = 0; for (let s = 0; s < 64; s++) { const p = b[s]; if (!p || p.c !== c || p.t === 'p' || p.t === 'k') continue; const w = p.t === 'q' ? 0.4 : p.t === 'r' ? 0.8 : 1.2;
    for (const t of attacksFrom(b, s)) if ((!b[t] || b[t]!.c !== c) && !pawnAttacked(b, t, opp(c))) n += w; }
  return n;
}
function fileKind(b: B, f: number, c: Color): 'open' | 'semi' | null {
  let own = false, their = false; for (let y = 0; y < 8; y++) { const q = b[y * 8 + f]; if (q?.t === 'p') q.c === c ? (own = true) : (their = true); }
  return own ? null : their ? 'semi' : 'open';
}
function activity(b: B, c: Color): number {
  let s = 2.2 * safeMob(b, c);
  for (const o of outposts(b, c)) s += b[o]!.t === 'n' ? 24 : 14;
  for (let x = 0; x < 64; x++) { const p = b[x]; if (p?.c !== c) continue;
    if (p.t === 'r') { const k = fileKind(b, fileOf(x), c); s += k === 'open' ? 16 : k === 'semi' ? 8 : 0; if (rel(x, c) === 6) s += 12; }
    if (p.t === 'n' && (fileOf(x) === 0 || fileOf(x) === 7)) s -= 14; }
  for (const bb of badBishop(b, c)) s -= 6 * bb.n;
  return s;
}
function development(b: B, c: Color, ply: number): number { if (ply > 30 || !middlegame(b)) return 0; return -20 * undeveloped(b, c); }
function space(b: B, c: Color): number {
  if (!middlegame(b)) return 0; let n = 0;
  for (let x = 2; x <= 5; x++) for (let r = 1; r <= 3; r++) { const s = (c === 'w' ? r : 7 - r) * 8 + x; if (b[s]?.t === 'p' && b[s]!.c === c) continue; if (!pawnAttacked(b, s, opp(c))) n++; }
  let ctr = 0; for (const n2 of ['d4', 'e4', 'd5', 'e5']) { const s = sqIdx(n2); const p = b[s]; if (p?.t === 'p' && p.c === c) ctr += rel(s, c) >= 3 ? 10 : 6; ctr += 3 * attackers(b, s, c).filter((a) => b[a]!.t === 'p').length; }
  let adv = 0; for (let x = 1; x <= 6; x++) for (const r of [4, 5]) { const s2 = (c === 'w' ? r : 7 - r) * 8 + x; const p = b[s2]; if (p?.t === 'p' && p.c === c && !pawnAttacked(b, s2, opp(c))) adv += 7; else if (!p && attackers(b, s2, c).some((a) => b[a]!.t === 'p') && !pawnAttacked(b, s2, opp(c))) adv += 3; }
  return 2.5 * n + ctr + adv;
}
export function terms(fen: string, me: Color, ply: number) {
  const pos = parseFen(fen); const b = pos.b; const e = opp(me);
  return {
    kingSafety: kingDanger(pos, e) - kingDanger(pos, me),
    pawnStructure: pawnScore(stable(b), me) - pawnScore(stable(b), e),
    activity: activity(b, me) - activity(b, e),
    development: development(b, me, ply) - development(b, e, ply),
    space: space(b, me) - space(b, e),
  };
}
type Terms = ReturnType<typeof terms>;
const THRESH: Terms = { kingSafety: 22, pawnStructure: 13, activity: 24, development: 18, space: 14 };

// ———————————— 1. la menace d'abord ————————————
function mateIn1(fen: string): string | null { try { const ch = new Chess(fen); for (const m of ch.moves({ verbose: true })) { ch.move(m); const ok = ch.isCheckmate(); ch.undo(); if (ok) return m.from + m.to + (m.promotion || ''); } } catch { /* */ } return null; }
const nullMove = (fen: string) => { const p = fen.split(' '); p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); };
const inCheckFen = (fen: string) => { try { return new Chess(fen).inCheck(); } catch { return false; } };
function material(fen: string, me: Color) { let m = 0; for (const p of parseFen(fen).b) if (p) m += (p.c === me ? 1 : -1) * MAT[p.t]; return m; }

function threatFirst(fenBefore: string, uci: string, best: StratLine, reply: StratLine | null, me: Color): StratReason | null {
  if (!reply?.pv.length) return null;
  const played = [uci, ...reply.pv]; const fp = walk(fenBefore, played, 16); const fb = walk(fenBefore, best.pv, 16);
  // (a) menace de mat : après la réponse adverse, s'il me laissait passer, l'adversaire materait.
  for (const k of [2, 4]) {
    const f = fp[k]; if (!f || inCheckFen(f)) continue; const m1 = mateIn1(nullMove(f));
    const fbk = fb[k]; const bestToo = fbk && !inCheckFen(fbk) && mateIn1(nullMove(fbk));
    if (m1 && !bestToo) {
      const keyMove = sanOf(fp[k - 1], played[k - 1]); const mateSan = sanOf(nullMove(f), m1);
      return { cat: 'threat', tag: 'threat:mate', headline: `Ce coup permet ${keyMove} et une menace de mat`,
        why: `Après ${lineFr(fp[0], played, k)}, l’adversaire menace ${mateSan.replace(/#?$/, '#')} : ton roi n’a plus assez de défenseurs. ${cap(sanOf(fenBefore, best.move))} gardait le contrôle.`,
        marks: [{ sq: m1.slice(2, 4), kind: 'danger' }], arrows: [{ orig: m1.slice(0, 2), dest: m1.slice(2, 4), brush: 'red' }] };
    }
  }
  // (b) série d'échecs adverses : le roi est pris en chasse
  let checks = 0; const chk: string[] = [];
  for (let k = 2; k < Math.min(fp.length, 10); k += 2) if (inCheckFen(fp[k])) { checks++; chk.push(sanOf(fp[k - 1], played[k - 1])); }
  let bchecks = 0; for (let k = 2; k < Math.min(fb.length, 10); k += 2) if (inCheckFen(fb[k])) bchecks++;
  // (c) matériel perdu plus loin dans la ligne (au-delà de l'horizon tactique)
  const qi = (fs: string[]) => { let k = Math.min(fs.length - 1, 14); while (k > 2 && fs[k - 1] && parseFen(fs[k - 1]).b.filter(Boolean).length !== parseFen(fs[k]).b.filter(Boolean).length) k--; return k; };
  const kp = qi(fp), kb = qi(fb);
  const dm = (material(fp[kp], me) - material(fp[0], me)) - (material(fb[kb], me) - material(fb[0], me));
  if (dm <= -1) {
    // premier coup adverse qui gagne du matériel : c'est la pointe de la ligne
    // la pointe : la dernière prise adverse qui fait tomber le bilan à sa valeur finale (pas un simple échange)
    const fin = material(fp[kp], me); let at = -1;
    for (let k = 1; k < kp; k += 2) { const v = parseFen(fp[k]).b[sqIdx(played[k].slice(2, 4))]; if (v && v.c === me && material(fp[k + 1], me) <= fin && material(fp[k], me) > fin) at = k; }
    const lost: Role[] = []; const b0 = parseFen(fp[0]).b, b1 = parseFen(fp[kp]).b;
    for (const t of ['q', 'r', 'b', 'n', 'p'] as Role[]) { const d = count(b0, me, t) - count(b1, me, t) - (count(b0, opp(me), t) - count(b1, opp(me), t)); for (let i = 0; i < d; i++) lost.push(t); }
    const promo = count(b1, opp(me), 'q') > count(b0, opp(me), 'q');
    if (promo) { const i = lost.indexOf('q'); if (i >= 0) lost.splice(i, 1); }
    const what = promo ? (lost.length ? `${materialWords(lost)}, et l’adversaire fait dame` : 'une promotion adverse') : materialWords(lost.length ? lost : ['p']);
    const point = at > 0 ? sanOf(fp[at], played[at]) : '';
    const cat: StratCat = checks >= 2 && checks > bchecks ? 'kingSafety' : 'threat';
    return { cat, tag: cat === 'kingSafety' ? 'king:checks' : 'threat:later', headline: promo ? 'Ce coup laisse filer un pion à dame' : `Ce coup coûte ${what} un peu plus loin`,
      why: `La suite ${lineFr(fp[0], played, Math.min(kp, 10))} finit par te coûter ${what}${point ? ` (la pointe : ${point})` : ''}${checks >= 2 ? `, avec des échecs (${list(chk.slice(0, 3))}) qui ne te laissent pas le temps de te défendre` : ''}.`,
      marks: at > 0 ? [{ sq: played[at].slice(2, 4), kind: 'danger' }] : [], arrows: reply.pv[0] ? [{ orig: reply.pv[0].slice(0, 2), dest: reply.pv[0].slice(2, 4), brush: 'red' }] : [] };
  }
  if (checks >= 2 && checks > bchecks) {
    return { cat: 'kingSafety', tag: 'king:checks', why: `Après ${lineFr(fp[0], played, 4)}, ton roi subit une série d’échecs (${list(chk.slice(0, 3))}) : il est trop exposé.`, marks: [{ sq: sqName(kingSq(parseFen(fp[2]).b, me)), kind: 'danger' }], arrows: [] };
  }
  // (d) pion passé adverse qui file vers la promotion
  const e = opp(me);
  for (let k = 1; k < Math.min(fp.length - 1, 12); k += 2) { const u = played[k]; const b = parseFen(fp[k]).b; const p = b[sqIdx(u.slice(0, 2))];
    if (p?.t === 'p' && p.c === e && rel(sqIdx(u.slice(2, 4)), e) >= 5 && pawnInfo(b, e).passed.includes(sqIdx(u.slice(0, 2)))) {
      const bp = parseFen(fb[Math.min(k + 1, fb.length - 1)]).b; if (pawnInfo(bp, e).passed.some((s) => rel(s, e) >= 5)) break;
      return { cat: 'pawnStructure', tag: 'pawns:passerRuns', why: `Le pion passé adverse file vers la promotion : ${lineFr(fp[0], played, k + 1)}. Un pion passé si avancé coûte souvent une pièce pour l’arrêter.`, marks: [{ sq: u.slice(2, 4), kind: 'danger' }], arrows: [{ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'red' }] };
    } }
  return null;
}

// ———————————— 2. attribution par termes d'évaluation ————————————
function diffSquares(a: number[], b: number[]) { return a.filter((s) => !b.includes(s)); }
const sqs = (xs: number[]) => list(xs.slice(0, 3).map(sqName));
function describe(cat: keyof Terms, fp: string, fbE: string, f1: string, fb1: string, before: string, me: Color, uci: string, bestSan: string): { why: string; tag: string; marks: StratReason['marks'] } | null {
  const P = parseFen(fp).b, Q = parseFen(fbE).b, P1 = parseFen(f1).b, Q1 = parseFen(fb1).b, B0 = parseFen(before).b; const e = opp(me);
  const mover = B0[sqIdx(uci.slice(0, 2))]; const to = sqIdx(uci.slice(2, 4));
  switch (cat) {
    case 'kingSafety': {
      const h = diffSquares(holes(P1, me), holes(Q1, me)); const hE = diffSquares(holes(P, me), holes(Q, me));
      const ki = kingInfo(parseFen(fp), me), kb = kingInfo(parseFen(fbE), me);
      const hs = h.length ? h : hE;
      if (mover?.t === 'p' && hs.length) return { why: `Ce coup de pion affaiblit l’abri de ton roi : ${sqs(hs)} ${hs.length > 1 ? 'deviennent des trous' : 'devient un trou'} qu’aucun pion ne pourra plus couvrir, et les pièces adverses peuvent s’y installer.`, tag: 'king:holes', marks: hs.map((s) => ({ sq: sqName(s), kind: 'danger' as const })) };
      if (mover?.t === 'p' && Math.abs(fileOf(sqIdx(uci.slice(0, 2))) - fileOf(kingSq(B0, me))) <= 1) { const at = new Set<number>(); const k = kingSq(P, me); for (const [df, dr] of KING) if (onBoard(fileOf(k) + df, rankOf(k) + dr)) for (const a of attackers(P, k + dr * 8 + df, e)) if (P[a]!.t !== 'p' && P[a]!.t !== 'k') at.add(a);
        return { why: `Ce coup de pion (${sanOf(before, uci)}) avance un pion de l’abri de ton roi : il ne reviendra jamais en arrière, et les cases qu’il protégeait (${sqs(diffSquares([sqIdx(uci.slice(0, 2)) + (me === 'w' ? 7 : -9), sqIdx(uci.slice(0, 2)) + (me === 'w' ? 9 : -7)].filter((x) => x >= 0 && x < 64 && Math.abs(fileOf(x) - fileOf(sqIdx(uci.slice(0, 2)))) <= 1 && x !== to), []))}) s’affaiblissent${at.size ? `, alors que ${list([...at].slice(0, 2).map((a) => his(P[a]!.t)))} ${at.size > 1 ? 'visent' : 'vise'} déjà ton roi` : ''}.`, tag: 'king:pawnPush', marks: [{ sq: sqName(to), kind: 'danger' }] }; }
      if (ki.openFiles > kb.openFiles) { const k = kingSq(P, me); const fs = [fileOf(k) - 1, fileOf(k), fileOf(k) + 1].filter((x) => x >= 0 && x < 8 && fileKind(P, x, me) && !fileKind(Q, x, me)); return { why: `La colonne ${fs.map((x) => FILES[x]).join('/') || FILES[fileOf(k)]} s’ouvre devant ton roi : les tours et la dame adverses vont s’en servir.`, tag: 'king:openFile', marks: [] }; }
      if (ki.zoneAttackers > kb.zoneAttackers) { const k = kingSq(P, me); const zone = new Set<number>([k]); for (const [df, dr] of KING) if (onBoard(fileOf(k) + df, rankOf(k) + dr)) zone.add(k + dr * 8 + df); const at = new Set<number>(); for (const z of zone) for (const a of attackers(P, z, e)) if (P[a]!.t !== 'p' && P[a]!.t !== 'k') at.add(a);
        return { why: `Après ce coup, ${list([...at].slice(0, 3).map((a) => `${his(P[a]!.t)} (${sqName(a)})`))} ${at.size > 1 ? 'se tournent' : 'se tourne'} vers ton roi, alors que ton abri ne bouge pas : l’attaque arrive plus vite que ta défense.`, tag: 'king:attackers', marks: [...at].map((a) => ({ sq: sqName(a), kind: 'danger' as const })) }; }
      if (!ki.castled && !ki.canCastle) return { why: 'Ton roi reste coincé au centre, sans roque possible : il sera la cible quand les colonnes s’ouvriront.', tag: 'king:center', marks: [] };
      if (ki.shield < kb.shield) return { why: 'Ton roi perd des pions protecteurs : son abri devient fragile.', tag: 'king:shield', marks: [] };
      return null;
    }
    case 'pawnStructure': {
      const SP = stable(P), SQ = stable(Q); const mp = pawnInfo(SP, me), mq = pawnInfo(SQ, me), ep = pawnInfo(SP, e), eq = pawnInfo(SQ, e);
      const iso = diffSquares(mp.isolated, mq.isolated).filter((s) => !mq.isolated.some((t) => fileOf(t) === fileOf(s))), dbl = diffSquares(mp.doubled, mq.doubled).filter((s) => !mq.doubled.some((t) => fileOf(t) === fileOf(s))), bwd = diffSquares(mp.backward, mq.backward), epass = diffSquares(ep.passed, eq.passed), lostPass = mq.passed.filter((s) => !mp.passed.some((t) => fileOf(t) === fileOf(s)));
      const eIso = diffSquares(eq.isolated, ep.isolated).filter((s) => !ep.isolated.some((t) => fileOf(t) === fileOf(s))), eDbl = diffSquares(eq.doubled, ep.doubled);
      const bits: string[] = []; const marks: StratReason['marks'] = [];
      if (bwd.length) { { const st = bwd[0] + (me === 'w' ? 8 : -8); bits.push(SP[st] ? `ton pion ${sqName(bwd[0])} devient arriéré : bloqué par ${SP[st]!.c === me ? 'tes propres pièces' : 'le pion adverse en ' + sqName(st)}, aucun pion voisin ne peut plus le soutenir et il restera une cible fixe` : `ton pion ${sqName(bwd[0])} devient arriéré : il ne peut plus avancer sans être pris, et la case devant lui ${sqName(st)} devient un trou pour les pièces adverses`); } marks.push({ sq: sqName(bwd[0]), kind: 'danger' }, { sq: sqName(bwd[0] + (me === 'w' ? 8 : -8)), kind: 'hint' }); }
      if (iso.length) { bits.push(`ton pion ${sqName(iso[0])} se retrouve isolé : aucun pion voisin ne pourra jamais le protéger`); marks.push({ sq: sqName(iso[0]), kind: 'danger' }); }
      if (dbl.length) { bits.push(`tu te retrouves avec des pions doublés en colonne ${FILES[fileOf(dbl[0])]}`); marks.push(...dbl.map((s) => ({ sq: sqName(s), kind: 'danger' as const }))); }
      if (epass.length) { bits.push(`l’adversaire obtient un pion passé en ${sqName(epass[0])}`); marks.push({ sq: sqName(epass[0]), kind: 'danger' }); }
      if (lostPass.length && !bits.length) bits.push(`tu perds ton pion passé en colonne ${FILES[fileOf(lostPass[0])]}`);
      if (!bits.length && (eIso.length || eDbl.length)) return { why: `${bestSan} abîmait la structure adverse (${eIso.length ? `pion isolé en ${sqName(eIso[0])}` : `pions doublés en colonne ${FILES[fileOf(eDbl[0])]}`}) : une faiblesse durable à attaquer.`, tag: 'pawns:missedWeakness', marks: [...eIso, ...eDbl].map((s) => ({ sq: sqName(s), kind: 'target' as const })) };
      if (!bits.length) return null;
      return { why: cap(bits.slice(0, 2).join(' ; ')) + '. Ces faiblesses de pions ne disparaissent pas : elles deviennent des cibles pour toute la partie.', tag: bwd.length ? 'pawns:backward' : iso.length ? 'pawns:isolated' : dbl.length ? 'pawns:doubled' : 'pawns:passed', marks };
    }
    case 'activity': {
      const eo = diffSquares(outposts(P, e), outposts(Q, e)); const mo = diffSquares(outposts(Q, me), outposts(P, me));
      if (eo.length) return { why: `${cap(his(P[eo[0]]!.t))} s’installe en ${sqName(eo[0])}, un avant-poste : aucun de tes pions ne pourra jamais l’en chasser.`, tag: 'pieces:outpost', marks: [{ sq: sqName(eo[0]), kind: 'danger' }] };
      if (mover?.t === 'n' && (fileOf(to) === 0 || fileOf(to) === 7)) return { why: `Ton cavalier part au bord en ${sqName(to)} : il n’y contrôle que ${attacksFrom(P1, to).length} cases et ne participe plus à la bataille du centre.`, tag: 'pieces:rim', marks: [{ sq: sqName(to), kind: 'danger' }] };
      if (mo.length) return { why: `${bestSan} installait ${my(Q[mo[0]]!.t)} sur l’avant-poste ${sqName(mo[0])}, une case d’où aucun pion adverse ne peut le chasser.`, tag: 'pieces:outpost', marks: [{ sq: sqName(mo[0]), kind: 'good' }] };
      const bbP = badBishop(P, me), bbQ = badBishop(Q, me);
      if (bbP.length && (!bbQ.length || bbP[0].n > bbQ[0].n)) return { why: `Ton fou ${sqName(bbP[0].sq)} devient un « mauvais fou » : ${bbP[0].n} de tes pions bloqués sont sur des cases de sa couleur et l’enferment.`, tag: 'pieces:badBishop', marks: [{ sq: sqName(bbP[0].sq), kind: 'danger' }] };
      for (let f = 0; f < 8; f++) { const k = fileKind(P, f, e); if (k === 'open' && fileKind(Q, f, e) !== 'open') { const r = [...Array(8).keys()].map((y) => y * 8 + f).find((s) => P[s]?.t === 'r' && P[s]!.c === e); if (r != null) return { why: `La colonne ${FILES[f]} s’ouvre et c’est la tour adverse qui la prend : elle va pénétrer dans ton camp.`, tag: 'pieces:openFile', marks: [{ sq: sqName(r), kind: 'danger' }] }; } }
      const mP = safeMob(P, me), mQ = safeMob(Q, me);
      if (mQ - mP >= 4) {
        return { why: `Tes pièces manquent d’air après ce coup : ${bestSan} leur donnait nettement plus de cases sûres.`, tag: 'pieces:activity', marks: [] };
      }
      const eP = safeMob(P, e), eQ = safeMob(Q, e);
      if (eP - eQ >= 4) return { why: `Ce coup libère le jeu adverse : ses pièces gagnent beaucoup de cases sûres, alors que ${bestSan} les gardait sous contrôle.`, tag: 'pieces:activity', marks: [] };
      return null;
    }
    case 'development': {
      const uP = undeveloped(P, me), uE = undeveloped(P, e), uQ = undeveloped(Q, me);
      const uP1 = undeveloped(P1, me), uQ1 = undeveloped(Q1, me);
      if (uQ1 < uP1 && (uP > uE || uP >= 2)) return { why: `Ton coup ne développe aucune pièce, alors que ${bestSan} en sortait une : en ouverture chaque tempo compte, et il te reste ${uP1} pièce${uP1 > 1 ? 's' : ''} mineure${uP1 > 1 ? 's' : ''} à sortir.`, tag: 'opening:development', marks: [] };
      if (uP <= uE && uQ >= uP) return null;
      return { why: `Après la suite du moteur, il te reste ${uP} pièce${uP > 1 ? 's' : ''} mineure${uP > 1 ? 's' : ''} non développée${uP > 1 ? 's' : ''} contre ${uE} pour l’adversaire${uQ < uP ? `, alors que ${bestSan} développait` : ''} : ce retard se paie dès que le centre s’ouvre.`, tag: 'opening:development', marks: [] };
    }
    case 'space': {
      const cen = ['d4', 'e4', 'd5', 'e5', 'c5', 'c4', 'f4', 'f5', 'b5', 'b4', 'g4', 'g5'].map(sqIdx);
      const gain = cen.find((s) => Q1[s]?.t === 'p' && Q1[s]!.c === me && !(P1[s]?.t === 'p' && P1[s]!.c === me) && rel(s, me) >= 3);
      if (gain != null && B0[gain]?.t === 'p' && B0[gain]!.c === me) return { why: `Ton coup abandonne le pion avancé en ${sqName(gain)}, qui te donnait de l’espace et gênait les pièces adverses ; ${bestSan} le maintenait.`, tag: 'space:pawn', marks: [{ sq: sqName(gain), kind: 'hint' }] };
      if (gain != null) return { why: `${bestSan} gagnait de l’espace avec un pion en ${sqName(gain)} : il prend des cases aux pièces adverses et donne de la place aux tiennes.`, tag: 'space:pawn', marks: [{ sq: sqName(gain), kind: 'good' }] };
      const eg = cen.find((s) => P[s]?.t === 'p' && P[s]!.c === e && !(Q[s]?.t === 'p' && Q[s]!.c === e));
      if (eg != null) return { why: `Ce coup laisse l’adversaire s’installer au centre avec un pion en ${sqName(eg)} : il y gagne de l’espace et tes pièces manquent de place.`, tag: 'space:center', marks: [{ sq: sqName(eg), kind: 'danger' }] };
      return { why: `Ce coup cède du terrain au centre : ${bestSan} gardait plus d’espace et de liberté pour tes pièces.`, tag: 'space:center', marks: [] };
    }
  }
}

/** Structure : on ne cite que les faiblesses présentes aux deux profondeurs (même colonne). */
function describePawns(pn: string, bn: string, pd: string, bd: string, before: string, me: Color, uci: string, bestSan: string) {
  const a = describe('pawnStructure', pn, bn, pn, bn, before, me, uci, bestSan); if (pn === pd) return a;
  const b = describe('pawnStructure', pd, bd, pd, bd, before, me, uci, bestSan); if (!a || !b || a.tag !== b.tag) return a && b ? (a.why.length <= b.why.length ? a : b) : null;
  const files = new Set(b.marks.map((m) => m.sq[0])); const marks = a.marks.filter((m) => files.has(m.sq[0]));
  return marks.length || !a.marks.length ? { ...a, marks: marks.length ? marks : a.marks } : null;
}
// ———————————— 3. prophylaxie ————————————
function prevented(fenBefore: string, best: StratLine, reply: StratLine, uci: string): string | null {
  const r0 = reply.pv[0]; if (!r0) return null; const fb = applyU(fenBefore, best.move); if (!fb) return null;
  const pa = parseFen(applyU(fenBefore, uci) || fenBefore).b; if (pa[sqIdx(r0.slice(2, 4))]) return null; // une prise n'est pas un « plan »
  const after = applyU(fb, r0); if (!after) return r0; // devenu illégal
  const pb = parseFen(after).b; const to = sqIdx(r0.slice(2, 4)); const mv = pb[to]; if (!mv || mv.t === 'p' && !attackers(pb, to, opp(mv.c)).length) return null;
  const att = attackers(pb, to, opp(mv.c)); const def = attackers(pb, to, mv.c);
  if (att.length && (!def.length || att.some((a) => MAT[pb[a]!.t] < MAT[mv.t]))) return r0;
  return null;
}

// ———————————— 4. plans de structures types ————————————
export function structurePlan(fen: string, me: Color): { key: string; plan: string } | null {
  const b = parseFen(fen).b; const e = opp(me);
  const P = (c: Color, n: string) => b[sqIdx(n)]?.t === 'p' && b[sqIdx(n)]!.c === c;
  const onFile = (c: Color, f: number) => [...Array(8).keys()].some((y) => b[y * 8 + f]?.t === 'p' && b[y * 8 + f]!.c === c);
  const W = me === 'w';
  const iqp = (c: Color) => { const d = [...Array(8).keys()].map((y) => y * 8 + 3).find((s) => b[s]?.t === 'p' && b[s]!.c === c); return d != null && !onFile(c, 2) && !onFile(c, 4) && !onFile(opp(c), 3) ? d : null; };
  const mi = iqp(me), ei = iqp(e);
  if (mi != null && middlegame(b)) return { key: 'iqp', plan: `Structure à pion isolé (${sqName(mi)}) : joue l’initiative — pièces actives, cavalier sur ${W ? 'e5' : 'e4'}, attaque à l’aile roi, et la poussée ${W ? 'd5' : 'd4'} au bon moment. Évite les échanges qui mènent à une finale où le pion sera faible.` };
  if (ei != null && middlegame(b)) return { key: 'iqpAgainst', plan: `Contre un pion isolé (${sqName(ei)}) : bloque la case devant lui (${sqName(ei + (e === 'w' ? 8 : -8))}) avec un cavalier, échange les pièces et attaque-le en finale.` };
  // Carlsbad : pions blancs d4 (sans c), noirs c6 d5 (sans e)
  if (P('w', 'd4') && P('b', 'd5') && P('b', 'c6') && !onFile('w', 2) && !onFile('b', 4) && onFile('w', 4)) return W ? { key: 'carlsbad', plan: 'Structure Carlsbad : le plan classique est l’attaque de minorité, b4-b5 pour créer une faiblesse en c6.' } : { key: 'carlsbad', plan: 'Structure Carlsbad : cherche le jeu à l’aile roi (Ce4, f5) pendant que les Blancs poussent b4-b5.' };
  // chaîne française : e5-d4 contre e6-d5
  if (P('w', 'e5') && P('w', 'd4') && P('b', 'e6') && P('b', 'd5')) return W ? { key: 'frenchChain', plan: 'Chaîne de pions bloquée (d4-e5) : joue à l’aile roi, où ta chaîne pointe (f4-f5), et soutiens la base d4.' } : { key: 'frenchChain', plan: 'Chaîne bloquée d4-e5 : attaque sa base avec …c5 puis …f6, et vise d4 avec cavaliers et dame en b6.' };
  // chaîne Est-indienne : d5-e4 contre d6-e5
  if (P('w', 'd5') && P('w', 'e4') && P('b', 'd6') && P('b', 'e5')) return W ? { key: 'kidChain', plan: 'Centre bloqué d5-e4 : ton jeu est à l’aile dame (c4-c5, ouvrir la colonne c) ; ne touche pas aux pions de ton roque.' } : { key: 'kidChain', plan: 'Centre bloqué d5-e4 : ton jeu est à l’aile roi (…f5-f4, …g5) ; c’est une course contre l’attaque blanche à l’aile dame.' };
  const kw = kingSq(b, 'w'), kb = kingSq(b, 'b');
  if (kw >= 0 && kb >= 0 && rankOf(kw) === 0 && rankOf(kb) === 7 && Math.abs(fileOf(kw) - fileOf(kb)) >= 4 && middlegame(b)) return { key: 'oppositeCastling', plan: 'Roques opposés : c’est une course. Lance tes pions sur le roi adverse — chaque tempo compte plus que le matériel.' };
  return null;
}

// ———————————— point d'entrée ————————————
export interface StratCtx { fenBefore: string; uci: string; best: StratLine | undefined; reply: StratLine | null; ply: number }
export function strategicReason(c: StratCtx, opts: { threats?: boolean } = {}): StratReason | null {
  const { fenBefore, uci, best, reply } = c; if (!best || best.move === uci || reply?.mate != null || best.mate != null) return null;
  const me = parseFen(fenBefore).turn; const bestSan = sanOf(fenBefore, best.move);
  if (opts.threats !== false) { const t = threatFirst(fenBefore, uci, best, reply, me); if (t) return t; }
  const played = [uci, ...(reply?.pv || [])];
  const N = Math.max(1, Math.min(6, played.length, best.pv.length));
  const fp = walk(fenBefore, played, N), fb = walk(fenBefore, best.pv, N);
  // fin « calme » commune : ni le coup qui y mène ni le suivant ne sont des prises (pas de milieu d'échange)
  const isCap = (fs: string[], ms: string[], k: number) => k >= 1 && k <= ms.length && fs[k - 1] != null && !!parseFen(fs[k - 1]).b[sqIdx(ms[k - 1].slice(2, 4))];
  const quiet = (fs: string[], ms: string[], k: number) => !isCap(fs, ms, k) && !(k < fs.length - 1 && isCap(fs, ms, k + 1)) && !inCheckFen(fs[k]);
  let n = Math.min(fp.length, fb.length) - 1; if (n < 1) return null;
  while (n > 1 && !(quiet(fp, played, n) && quiet(fb, best.pv, n))) n--;
  const tp = terms(fp[n], me, c.ply + n), tb = terms(fb[n], me, c.ply + n), t1 = terms(fp[1], me, c.ply + 1), u1 = terms(fb[1], me, c.ply + 1);
  // la structure de pions se juge loin dans la ligne (point calme le plus profond) : un pion doublé qui va être repris n'est pas une faiblesse
  const fpD = walk(fenBefore, played, 12), fbD = walk(fenBefore, best.pv, 12);
  let D = Math.min(fpD.length, fbD.length) - 1; while (D > n && !(quiet(fpD, played, D) && quiet(fbD, best.pv, D))) D--;
  // une faiblesse n'est retenue que si elle persiste : présente à la fin calme courte ET au point profond
  if (D > n) { const a = terms(fpD[D], me, c.ply + D), b2 = terms(fbD[D], me, c.ply + D); const dn = tp.pawnStructure - tb.pawnStructure, dd = a.pawnStructure - b2.pawnStructure; const keep = Math.sign(dn) === Math.sign(dd) ? (Math.abs(dn) < Math.abs(dd) ? dn : dd) : 0; tp.pawnStructure = tb.pawnStructure + keep; t1.pawnStructure = u1.pawnStructure + (Math.sign(t1.pawnStructure - u1.pawnStructure) === Math.sign(keep) ? t1.pawnStructure - u1.pawnStructure : 0); }
  const deepP = D > n ? fpD[D] : fp[n], deepB = D > n ? fbD[D] : fb[n];
  const score = {} as Record<keyof Terms, number>;
  for (const k of Object.keys(THRESH) as (keyof Terms)[]) score[k] = (0.6 * (tp[k] - tb[k]) + 0.4 * (t1[k] - u1[k])) / THRESH[k];
  // saillance : le coup lui-même porte la faiblesse (cavalier au bord, pion de l'abri du roi, coup de pion lent)
  const B0 = parseFen(fenBefore).b; const mover = B0[sqIdx(uci.slice(0, 2))]; const to = sqIdx(uci.slice(2, 4));
  if (mover?.t === 'n' && (fileOf(to) === 0 || fileOf(to) === 7) && score.activity < 0) score.activity -= 0.8;
  const kq = kingSq(B0, me);
  if (mover?.t === 'p' && kq >= 0 && rel(kq, me) === 0 && Math.abs(fileOf(sqIdx(uci.slice(0, 2))) - fileOf(kq)) <= 1 && (fileOf(kq) >= 5 || fileOf(kq) <= 2) && score.kingSafety <= 0) score.kingSafety -= 0.9;
  const bm = B0[sqIdx(best.move.slice(0, 2))]; const bHome = me === 'w' ? 0 : 7;
  if (c.ply < 20 && mover?.t === 'p' && 'abgh'.includes(uci[0]) && undeveloped(B0, me) >= 2 && bm && (bm.t === 'n' || bm.t === 'b') && rankOf(sqIdx(best.move.slice(0, 2))) === bHome && score.development < 0) score.development -= 0.8;
  const order = (Object.keys(score) as (keyof Terms)[]).sort((a, b) => score[a] - score[b]);
  let res: StratReason | null = null;
  for (const k of order) {
    if (score[k] > -1) break;
    const d = k === 'pawnStructure' ? describePawns(fp[n], fb[n], deepP, deepB, fenBefore, me, uci, bestSan) : describe(k, fp[n], fb[n], fp[1], fb[1], fenBefore, me, uci, bestSan);
    if (d) { res = { cat: k, tag: d.tag, why: d.why, marks: d.marks, arrows: [], terms: score }; break; }
  }
  const pv = reply ? prevented(fenBefore, best, reply, uci) : null;
  if (pv) {
    const rs = sanOf(applyU(fenBefore, uci)!, pv);
    if (res) res.why += ` ${bestSan} empêchait justement ${rs}.`;
    else res = { cat: 'prophylaxis', tag: 'prophylaxis', why: pv.slice(2, 4) === best.move.slice(2, 4) ? `${bestSan} était un coup prophylactique : il occupait la case ${pv.slice(2, 4)} avant l’adversaire, dont la réponse ${rs} prend l’initiative.` : `${bestSan} était un coup prophylactique : il empêchait ${rs}, la réponse qui donne l’initiative à l’adversaire.`, marks: [], arrows: [{ orig: pv.slice(0, 2), dest: pv.slice(2, 4), brush: 'red' }], terms: score };
  }
  if (res) { const sp = structurePlan(fb[1], me); if (sp) res.tip = sp.plan; }
  return res;
}
