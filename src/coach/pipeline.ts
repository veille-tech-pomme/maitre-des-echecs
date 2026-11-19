// Pipeline du coach (fonctions pures, exécutées dans le Worker) : à partir des lignes Stockfish de chaque
// position, classe les coups, explique, repère les moments critiques et produit des observations pour le modèle.
import { Chess } from 'chess.js';
import { expectedStm, accuracyOf } from './winprob';
import { classifyMove, criticalMoments, CLASSES, type MoveClass, type Criticality } from './classify';
import { explainMove, levelOf, trace, type Explanation, type Line } from './explain';
import { moveMotifs, verifyOnLine, endgameKind, type MotifKey } from './motifs';
import { parseFen, sqIdx, nonPawnMat, type Role } from './geometry';
import { MOTIF_SKILL, type SkillId } from './skills';
import { lineFr, sanFr, materialWords } from './lang';

export interface CoachMove {
  ply: number; uci: string; san: string; color: 'w' | 'b'; cls: MoveClass; dE: number; eBest: number; ePlayed: number;
  fenBefore: string; fenAfter: string; best: string; bestLine: string[]; whiteCp: number; ex: Explanation | null;
}
export interface Retry { ply: number; fen: string; solution: string[]; prompt: string; motif: string | null }
export interface GameLesson { title: string; text: string; skill: SkillId | null; ply: number | null; route?: string }
export interface SkillEvent { skill: SkillId; s: number; d: number; w?: number; src: 'game' | 'puzzle' | 'lesson' | 'diag'; ref?: string; motif?: string; piece?: string; lost?: number; t?: number }
export interface CoachReview {
  v: 2; moves: CoachMove[]; accuracy: { w: number; b: number }; counts: { w: Record<string, number>; b: Record<string, number> };
  critical: Criticality[]; retries: Retry[]; lessons: GameLesson[]; events: SkillEvent[]; summary: string; es: number[]; phaseAcc: Record<string, number>;
}
export interface GameInput { startFen: string; moves: string[]; lines: Line[][]; elo: number; user: 'w' | 'b'; oppElo: number; book?: (fen: string) => boolean; gameId?: string; result?: '1-0' | '0-1' | '1/2-1/2' | '*' }

const applyU = (fen: string, u: string) => { const c = new Chess(fen); c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c; };
const isMateFen = (fen: string) => { try { return new Chess(fen).isCheckmate(); } catch { return false; } };
const lineScore = (l: Line | undefined) => ({ cp: l?.cp ?? 0, mate: l?.mate ?? null });

export function buildReview(g: GameInput): CoachReview {
  const fens: string[] = [g.startFen]; const sans: string[] = [];
  for (const u of g.moves) { const c = applyU(fens[fens.length - 1], u); fens.push(c.fen()); sans.push(c.history().slice(-1)[0]); }
  // score attendu du camp au trait pour chaque position (fin de partie gérée)
  const stmE = fens.map((f, i) => {
    const ch = new Chess(f); if (ch.isCheckmate()) return 0; if (ch.isDraw() || ch.isStalemate()) return 0.5;
    return expectedStm(lineScore(g.lines[i]?.[0]), g.elo);
  });
  const whiteCp = fens.map((f, i) => { const l = g.lines[i]?.[0]; const s = f.split(' ')[1] === 'w' ? 1 : -1; const ch = new Chess(f); if (ch.isCheckmate()) return s * -10000; if (!l) return 0; return s * (l.mate != null ? (l.mate > 0 ? 10000 - l.mate * 10 : -10000 - l.mate * 10) : l.cp || 0); });
  const moves: CoachMove[] = []; const events: SkillEvent[] = [];
  const counts = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  const acc = { w: [] as number[], b: [] as number[] }; const phase: Record<string, number[]> = {};
  const crit: { ply: number; dE: number; gap12: number | null; swing: number; mine: boolean }[] = [];
  const conv: number[] = [], resil: number[] = []; let blunders = 0, userMoves = 0;
  for (let i = 0; i < g.moves.length; i++) {
    const u = g.moves[i]; const fb = fens[i], fa = fens[i + 1]; const color = fb.split(' ')[1] as 'w' | 'b';
    const L = g.lines[i] || []; const best = L[0];
    const eBest = stmE[i]; let ePlayed = 1 - stmE[i + 1];
    const inMulti = L.find((l) => l.move === u); if (inMulti) ePlayed = Math.min(eBest, expectedStm(lineScore(inMulti), g.elo));
    if (isMateFen(fa)) ePlayed = 1;
    const isBest = best?.move === u || ePlayed >= eBest - 1e-9;
    const dE = isBest ? 0 : Math.max(0, eBest - ePlayed);
    const gap12 = L[1] ? eBest - expectedStm(lineScore(L[1]), g.elo) : null;
    const before = parseFen(fb);
    const mm = moveMotifs(before, { from: sqIdx(u.slice(0, 2)), to: sqIdx(u.slice(2, 4)), promo: (u[4] as Role) || undefined }, isMateFen(fa));
    const sacrifice = mm.some((x) => x.key === 'sacrifice');
    const book = i < 24 && !!g.book?.(fa);
    const cls = classifyMove({ dE, eBest, ePlayed, eBefore: eBest, isBest, book, sacrifice, gap12, mate: isMateFen(fa), elo: color === g.user ? g.elo : g.oppElo });
    counts[color][cls] = (counts[color][cls] || 0) + 1;
    const a = accuracyOf(dE); acc[color].push(a);
    const ph = endgameKind(before.b) ? 'endgame' : i < 20 ? 'opening' : 'middlegame';
    const mine = color === g.user;
    if (mine) {
      (phase[ph] ||= []).push(a); userMoves++;
      if (eBest >= 0.8) conv.push(dE < 0.05 ? 1 : 0);
      if (eBest <= 0.3) resil.push(dE < 0.05 ? 1 : 0);
      if (cls === 'blunder' || cls === 'mistake') blunders++;
    }
    crit.push({ ply: i, dE, gap12, swing: Math.abs((1 - stmE[i + 1]) - stmE[i]), mine });
    const ex = mine ? explainMove({ fenBefore: fb, uci: u, cls, dE, eBefore: eBest, ePlayed, eBest, lines: L, reply: g.lines[i + 1]?.[0] || null, elo: g.elo, ply: i, history: sans.slice(0, i), mine }) : null;
    moves.push({ ply: i, uci: u, san: sans[i], color, cls, dE, eBest, ePlayed, fenBefore: fb, fenAfter: fa, best: best?.move || u, bestLine: best?.pv || [], whiteCp: whiteCp[i + 1], ex });
    // — observations pour le modèle : occasions tactiques et punitions
    if (mine && best) {
      const bm = moveMotifs(before, { from: sqIdx(best.move.slice(0, 2)), to: sqIdx(best.move.slice(2, 4)), promo: (best.move[4] as Role) || undefined }, false);
      const v = verifyOnLine(bm, fb, best.pv, (f, x) => { try { return applyU(f, x).fen(); } catch { return null; } }, isMateFen);
      const tb = trace(fb, best.pv, color, 8);
      const opp = (v.mate && best.mate != null && best.mate > 0) || tb.net >= 2;
      if (opp) {
        const found = dE < 0.03; const depth = best.mate != null && best.mate > 0 ? best.mate * 2 - 1 : Math.min(7, tb.plies);
        const k = v.verified.find((x) => MOTIF_SKILL[x.key] && x.key !== 'promotion');
        const skill: SkillId = best.mate != null && best.mate > 0 ? (best.mate === 1 ? 'mate1' : 'mateN') : k ? MOTIF_SKILL[k.key] : 'freePiece';
        events.push({ skill, s: found ? 1 : 0, d: g.elo - 150 + 90 * depth, src: 'game', ref: `${g.gameId || ''}#${i}`, motif: k?.key });
      }
      const tags = ex?.tags || [];
      const allowed = tags.find((t) => t.startsWith('allowed:'));
      if (allowed) {
        const [, motif, piece] = allowed.split(':'); const tr = trace(fb, [u, ...(g.lines[i + 1]?.[0]?.pv || [])], color, 9);
        events.push({ skill: 'vigilance', s: 0, d: g.elo - 250, src: 'game', ref: `${g.gameId || ''}#${i}`, motif, piece, lost: -tr.net });
      }
      if (tags.some((t) => t.startsWith('allowedMate'))) events.push({ skill: 'kingSafety', s: 0, d: g.elo - 150, src: 'game', ref: `${g.gameId || ''}#${i}`, motif: 'mate' });
      if (tags.some((t) => t.startsWith('opening:'))) events.push({ skill: 'principles', s: 0, d: g.elo - 200, src: 'game', ref: `${g.gameId || ''}#${i}`, motif: tags.find((t) => t.startsWith('opening:')) });
      const eg = tags.find((t) => t.startsWith('endgame:'));
      if (eg) events.push({ skill: eg.includes('lucena') || eg.includes('philidor') ? 'rookEnd' : 'pawnEnd', s: eg.endsWith('+') ? 1 : 0, d: g.elo, src: 'game', ref: `${g.gameId || ''}#${i}`, motif: eg });
      if (tags.some((t) => t.startsWith('pawns:'))) events.push({ skill: 'structure', s: 0, d: g.elo - 100, w: 0.5, src: 'game', ref: `${g.gameId || ''}#${i}` });
      if (tags.some((t) => t.startsWith('king:'))) events.push({ skill: 'kingSafety', s: 0, d: g.elo - 100, w: 0.5, src: 'game', ref: `${g.gameId || ''}#${i}` });
      if (tags.some((t) => t.startsWith('pieces:'))) events.push({ skill: 'activity', s: 0, d: g.elo - 100, w: 0.5, src: 'game', ref: `${g.gameId || ''}#${i}` });
    }
  }
  // observations agrégées par partie (score fractionnaire)
  const ref = g.gameId; const mean = (x: number[]) => x.reduce((s, y) => s + y, 0) / Math.max(1, x.length);
  if (userMoves >= 8) events.push({ skill: 'vigilance', s: Math.max(0, 1 - blunders / Math.max(4, userMoves / 3)), d: g.oppElo, src: 'game', ref });
  if (conv.length >= 3) events.push({ skill: 'conversion', s: mean(conv), d: g.oppElo, src: 'game', ref });
  if (resil.length >= 3) events.push({ skill: 'resilience', s: mean(resil), d: g.oppElo, src: 'game', ref });
  if (phase.opening?.length >= 4) events.push({ skill: 'theory', s: mean(phase.opening) / 100, d: g.oppElo, w: 0.6, src: 'game', ref });
  if (phase.endgame?.length >= 4) { const k = endgameKind(parseFen(fens[fens.length - 1]).b); events.push({ skill: k === 'pawn' ? 'pawnEnd' : k === 'rook' ? 'rookEnd' : k === 'minor' ? 'minorEnd' : k === 'queen' ? 'queenEnd' : 'technique', s: mean(phase.endgame) / 100, d: g.oppElo, w: 0.6, src: 'game', ref }); }
  const critical = criticalMoments(crit, 3);
  const retries: Retry[] = critical.map((c) => {
    const m = moves[c.ply]; const L = g.lines[c.ply]?.[0];
    const sol = (L?.pv || [m.best]).slice(0, forcedLen(m.fenBefore, L));
    const motif = m.ex?.tags.find((t) => t.startsWith('missed:') || t.startsWith('missedMate'))?.split(':')[1] || null;
    return { ply: c.ply, fen: m.fenBefore, solution: sol, prompt: c.reason === 'onlyMove' ? 'Un seul coup tient la position. Lequel ?' : m.dE >= 0.1 ? 'Ici, tu peux faire beaucoup mieux. Trouve le meilleur coup.' : 'Position critique : trouve le meilleur coup.', motif };
  }).filter((r) => r.solution.length && moves[r.ply].cls !== 'best' && moves[r.ply].cls !== 'great' && moves[r.ply].cls !== 'brilliant');
  const lessons = gameLessons(moves, g, critical, events);
  const mineAcc = Math.round(mean(acc[g.user]) * 10) / 10;
  const summary = summarize(moves, g, mineAcc, critical);
  const phaseAcc: Record<string, number> = {}; for (const k in phase) phaseAcc[k] = Math.round(mean(phase[k]) * 10) / 10;
  return { v: 2, moves, accuracy: { w: Math.round(mean(acc.w) * 10) / 10, b: Math.round(mean(acc.b) * 10) / 10 }, counts, critical, retries, lessons, events, summary, es: stmE.map((e, i) => (fens[i].split(' ')[1] === 'w' ? e : 1 - e)), phaseAcc };
}
/** Longueur de solution « rejouable » : 1 coup, ou 3 si la suite est forcée (échecs/prises/mat). */
function forcedLen(fen: string, L: Line | undefined) {
  if (!L) return 1; if (L.mate != null && L.mate > 0 && L.mate <= 2) return Math.min(L.pv.length, L.mate * 2 - 1);
  const ch = new Chess(fen); const forcing = (u: string) => { const m = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return m.san.includes('+') || !!m.captured || !!m.promotion; };
  try { if (L.pv.length >= 3 && forcing(L.pv[0])) { const replies = ch.moves().length; ch.move({ from: L.pv[1].slice(0, 2), to: L.pv[1].slice(2, 4), promotion: L.pv[1][4] }); if (forcing(L.pv[2]) && replies <= 3) return 3; } } catch { /* */ }
  return 1;
}
/** Score attendu des Blancs après le dernier coup (0,5 si inconnu). */
const lastEs = (moves: CoachMove[]) => { const m = moves[moves.length - 1]; return m ? (m.color === 'w' ? m.ePlayed : 1 - m.ePlayed) : 0.5; };
function summarize(moves: CoachMove[], g: GameInput, acc: number, critical: Criticality[]): string {
  const mine = moves.filter((m) => m.color === g.user);
  const bl = mine.filter((m) => m.cls === 'blunder').length, mi = mine.filter((m) => m.cls === 'mistake' || m.cls === 'miss').length;
  const br = mine.filter((m) => m.cls === 'brilliant' || m.cls === 'great').length;
  const turning = critical.find((c) => moves[c.ply].dE >= 0.15);
  const last = moves[moves.length - 1]; const end = last ? new Chess(last.fenAfter) : null;
  const matedMe = !!end?.isCheckmate() && end.turn() === g.user, matedHim = !!end?.isCheckmate() && end.turn() !== g.user;
  let head = acc >= 85 ? 'Très belle partie' : acc >= 70 ? 'Partie solide' : acc >= 55 ? 'Partie correcte, avec des trous' : 'Partie difficile';
  if (bl >= 2 && acc < 85) head = 'Partie à rebondissements';
  if (matedMe && moves.length < 40) head = 'Une partie courte, riche en leçons';
  if (matedHim) head = acc >= 70 ? 'Belle victoire' : 'Victoire';
  const won = g.result === (g.user === 'w' ? '1-0' : '0-1'), lost = g.result === (g.user === 'w' ? '0-1' : '1-0');
  // Fin sans mat (abandon, temps, nulle) : le titre suit le résultat réel, pas seulement la précision.
  const resigned = lost && !matedMe, wonOther = won && !matedHim;
  if (resigned) head = moves.length < 20 ? 'Partie abandonnée tôt' : 'Défaite';
  if (wonOther) head = acc >= 70 ? 'Belle victoire' : 'Victoire';
  if (g.result === '1/2-1/2') head = 'Partie nulle';
  const parts = [`${head} : ${String(acc).replace('.', ',')} % de précision.`];
  if (matedMe) parts.push(`Mat au coup ${Math.floor(last.ply / 2) + 1}.`);
  const eFinal = last ? (g.user === 'w' ? lastEs(moves) : 1 - lastEs(moves)) : 0.5;
  if (resigned && eFinal >= 0.35) parts.push('Tu as abandonné alors que la position était encore jouable : ne lâche rien, chaque partie jouée jusqu’au bout t’apprend quelque chose.');
  if (br) parts.push(`${br} coup${br > 1 ? 's' : ''} fort${br > 1 ? 's' : ''} trouvé${br > 1 ? 's' : ''}.`);
  if (bl + mi === 0) parts.push(lost ? 'Aucune grosse erreur dans les coups joués.' : 'Aucune vraie erreur : bravo.');
  else if (turning) parts.push(`Le tournant : ${Math.floor(turning.ply / 2) + 1}${moves[turning.ply].color === 'w' ? '.' : '…'} ${sanFr(moves[turning.ply].san)}.`);
  return parts.join(' ');
}
/** Trois leçons tirées de la partie, chacune reliée à une compétence et à une activité. */
function gameLessons(moves: CoachMove[], g: GameInput, critical: Criticality[], events: SkillEvent[]): GameLesson[] {
  const out: GameLesson[] = []; const mine = moves.filter((m) => m.color === g.user && m.ex);
  const bad = mine.filter((m) => !CLASSES[m.cls].good).sort((a, b) => b.dE - a.dE);
  const mateA = bad.find((m) => m.ex!.tags.some((t) => t.startsWith('allowedMate')));
  if (mateA) out.push({ title: 'Ton roi en danger', text: `${mateA.ex!.headline}. ${mateA.ex!.why} Avant chaque coup, demande-toi : « quels échecs l’adversaire peut-il donner ? »`, skill: 'kingSafety', ply: mateA.ply });
  const turn = bad.find((m) => m.dE >= 0.12 && m !== mateA && !m.ex!.tags.some((t) => t.startsWith('allowed:') || t.startsWith('missed')));
  if (turn) out.push({ title: 'Le tournant', text: `${Math.floor(turn.ply / 2) + 1}${turn.color === 'w' ? '.' : '…'} ${sanFr(turn.san)} : ${turn.ex!.why.replace(/^./, (x) => x.toLowerCase())}${turn.ex!.plan ? ' ' + turn.ex!.plan : ''}`, skill: null, ply: turn.ply });
  const allowed = bad.filter((m) => m.ex!.tags.some((t) => t.startsWith('allowed:')));
  if (allowed.length) {
    const motif = allowed[0].ex!.tags.find((t) => t.startsWith('allowed:'))!.split(':')[1];
    out.push({ title: allowed.length > 1 ? `${allowed.length} fois, l’adversaire a pu gagner du matériel` : motif === 'hanging' ? 'Une pièce laissée sans défense' : 'Une tactique adverse', text: `${allowed[0].ex!.headline}. ${motif === 'hanging' || motif === 'threat' ? 'Avant chaque coup, vérifie ce que l’adversaire peut prendre ou attaquer.' : motif === 'fork' ? 'Repère les cases d’où une pièce adverse attaquerait deux cibles.' : 'Après ton coup, regarde les échecs, prises et menaces de l’adversaire.'}`, skill: motif === 'fork' ? 'fork' : motif === 'pin' ? 'pin' : motif === 'skewer' ? 'skewer' : 'vigilance', ply: allowed[0].ply, route: '#/coach' });
  }
  const missed = bad.filter((m) => m.ex!.tags.some((t) => t.startsWith('missed')));
  if (missed.length) { const m = missed[0]; const tg = m.ex!.tags.find((t) => t.startsWith('missed'))!; const mk = tg.split(':')[1] as MotifKey; out.push({ title: tg.startsWith('missedMate') ? 'Un mat t’a échappé' : 'Une occasion manquée', text: m.ex!.headline + '.', skill: tg.startsWith('missedMate') ? 'mateN' : MOTIF_SKILL[mk] || 'freePiece', ply: m.ply }); }
  const op = bad.find((m) => m.ex!.tags.some((t) => t.startsWith('opening:')));
  if (op && out.length < 3) out.push({ title: 'Ouverture', text: op.ex!.why, skill: 'principles', ply: op.ply });
  const eg = mine.find((m) => m.ex!.tags.some((t) => t.startsWith('endgame:')));
  if (eg && out.length < 3) out.push({ title: 'Finale', text: eg.ex!.why, skill: eg.ex!.tags.some((t) => /lucena|philidor/.test(t)) ? 'rookEnd' : 'pawnEnd', ply: eg.ply });
  const conv = events.find((e) => e.skill === 'conversion' && e.s < 0.6);
  if (conv && out.length < 3) out.push({ title: 'Conclure', text: 'Tu as eu une position gagnante sans parvenir à la convertir : simplifie (échange les pièces), protège tes pions et avance pas à pas.', skill: 'conversion', ply: null });
  const good = mine.filter((m) => m.cls === 'brilliant' || m.cls === 'great' || m.ex!.tags.some((t) => t.startsWith('found:')));
  if (good.length && out.length < 3) out.push({ title: 'À garder', text: `${good[0].ex!.headline} ${good[0].ex!.why}`, skill: null, ply: good[0].ply });
  if (out.length < 3 && critical.length) { const c = critical.find((x) => !out.some((o) => o.ply === x.ply)); if (c) out.push({ title: 'Moment critique', text: moves[c.ply].ex?.headline ? moves[c.ply].ex!.headline + '.' : 'Position décisive.', skill: null, ply: c.ply }); }
  return out.slice(0, 3);
}
export { lineFr, materialWords };
