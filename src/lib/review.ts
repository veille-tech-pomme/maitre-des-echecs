// Bilan de partie : classification des coups (Brillant → Gaffe), précision, et explications du coach en français.
import { Chess, sanFr, tryMove, uciLineToSan, formatLine, PIECE_ART, VALUES, type Move, type PieceSymbol } from './chess';
import { engine, whiteScore, winPct, type PvLine } from './engine';
import { detectMotifs, hangingPieces, openingPrinciples, materialSwing, cap } from './motifs';
import { isBookFen } from '../data/openings';

export type MoveClass = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
export const CLASS_INFO: Record<MoveClass, { label: string; symbol: string; color: string }> = {
  brilliant: { label: 'Brillant', symbol: '!!', color: '#1bada6' },
  great: { label: 'Très bon coup', symbol: '!', color: '#5c8bb0' },
  best: { label: 'Meilleur coup', symbol: '★', color: '#81b64c' },
  excellent: { label: 'Excellent', symbol: '👍', color: '#81b64c' },
  good: { label: 'Bon', symbol: '✓', color: '#95b776' },
  book: { label: 'Théorie', symbol: '📖', color: '#a88865' },
  inaccuracy: { label: 'Imprécision', symbol: '?!', color: '#f7c045' },
  mistake: { label: 'Erreur', symbol: '?', color: '#e58f2a' },
  miss: { label: 'Occasion manquée', symbol: '✕', color: '#ee6b55' },
  blunder: { label: 'Gaffe', symbol: '??', color: '#ca3431' },
};
export const CLASS_ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

export interface ReviewMove {
  ply: number; san: string; uci: string; color: 'w' | 'b'; cls: MoveClass; loss: number;
  evalBefore: number; evalAfter: number; best: string; bestSan: string; bestLine: string[];
  replyLine: string[]; coach: string; deep: string[]; tags: string[]; fenBefore: string; fenAfter: string;
}
export interface GameReview { moves: ReviewMove[]; accuracy: { w: number; b: number }; counts: { w: Record<string, number>; b: Record<string, number> }; evals: number[]; phaseAcc: { w: Record<string, number>; b: Record<string, number> } }

export const moveAccuracy = (loss: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

export function classify(p: { loss: number; isBest: boolean; book: boolean; mate: boolean; sacrifice: boolean; winBefore: number; winAfter: number; onlyMove: boolean; missedWin: boolean }): MoveClass {
  if (p.book) return 'book';
  if (p.mate) return 'best';
  if (p.sacrifice && p.loss <= 2 && p.winAfter >= 50 && p.winBefore < 97) return 'brilliant';
  if (p.isBest && p.onlyMove && p.winBefore < 92) return 'great';
  if (p.isBest || p.loss < 0.6) return 'best';
  if (p.missedWin && p.loss >= 10) return 'miss';
  if (p.loss < 2) return 'excellent';
  if (p.loss < 5) return 'good';
  if (p.loss < 10) return 'inaccuracy';
  if (p.loss < 20) return 'mistake';
  return 'blunder';
}

function phaseOf(ch: Chess, ply: number): 'opening' | 'middlegame' | 'endgame' {
  let np = 0; for (const row of ch.board()) for (const p of row) if (p && p.type !== 'k' && p.type !== 'p') np += VALUES[p.type];
  if (np <= 26) return 'endgame';
  return ply < 20 ? 'opening' : 'middlegame';
}

/** Explication en français du coup (courte + détaillée). */
export function explain(r: Omit<ReviewMove, 'coach' | 'deep' | 'tags'>, before: Chess, mv: Move, history: Move[], bestLines: PvLine[], afterLines: PvLine[]): { coach: string; deep: string[]; tags: string[] } {
  const tags: string[] = []; const deep: string[] = [];
  const after = new Chess(r.fenAfter);
  const me = r.color; const sideName = me === 'w' ? 'les Blancs' : 'les Noirs';
  const bestL = bestLines[0]; const afterL = afterLines[0];
  const bestMate = bestL?.mate != null && bestL.mate > 0 ? bestL.mate : null;
  const oppMate = afterL?.mate != null && afterL.mate > 0 ? afterL.mate : null; // l'adversaire (trait) mate
  const motifs = detectMotifs(before, mv, after);
  const fr = (s: string) => sanFr(s);
  let coach = '';
  const good = ['brilliant', 'great', 'best', 'excellent', 'good', 'book'].includes(r.cls);
  if (mv.san.includes('#')) coach = 'Échec et mat ! Bravo, la partie est terminée.';
  else if (good) {
    const m = motifs.find((x) => ['fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'promotion', 'freePiece'].includes(x.key));
    if (r.cls === 'brilliant') coach = `Coup brillant ! ${motifs.find((x) => x.key === 'sacrifice')?.detail || ''} Mais c’est calculé : l’adversaire ne peut pas en profiter.`;
    else if (r.cls === 'great') coach = `Très fort : c’était le seul coup qui maintenait l’équilibre de la position${m ? ' — ' + m.label.toLowerCase() + '. ' + m.detail : '.'}`;
    else if (r.cls === 'book') coach = 'Coup de théorie : c’est un coup connu des ouvertures, joué par les maîtres.';
    else if (m) coach = `${m.label} ! ${m.detail}`;
    else {
      const tips = openingPrinciples(before, mv, r.ply, history).filter((t) => !t.startsWith('Sortir') && !t.startsWith('Évite') && !t.startsWith('«') && !t.startsWith('Avancer') && !t.startsWith('Bouger'));
      coach = tips[0] || (r.cls === 'best' ? 'C’est exactement le coup que le moteur recommande.' : r.cls === 'excellent' ? 'Excellent coup, presque aussi fort que le meilleur.' : `Bon coup. Le moteur préférait légèrement ${fr(r.bestSan)}.`);
    }
  } else {
    if (oppMate) { coach = `Attention : ce coup permet à l’adversaire de mater en ${oppMate} (${formatLine(r.replyLine.slice(0, oppMate * 2 - 1), r.ply + 1)}).`; tags.push('allowedMate'); }
    else if (bestMate) { coach = `Tu avais un mat en ${bestMate} avec ${fr(r.bestSan)} ! Cherche toujours d’abord les échecs, les prises et les menaces.`; tags.push('missedMate'); }
    else {
      const loseMat = afterL ? -materialSwing(r.fenAfter, afterL.pv, 4, me === 'w' ? 'b' : 'w') : 0; // ce que je perds
      const hang = hangingPieces(after, me);
      const moved = hang.find((h) => h.square === mv.to);
      if (moved && loseMat <= -0 && materialSwing(r.fenAfter, afterL?.pv || [], 3, me) <= -2) {
        coach = `${cap(PIECE_ART[moved.type])} en ${moved.square} n’est plus protégé(e) : ${fr(r.replyLine[0] || '')} le gagne.`; tags.push('hanging');
      } else if (afterL && materialSwing(r.fenAfter, afterL.pv, 4, me) <= -2) {
        const lost = -materialSwing(r.fenAfter, afterL.pv, 4, me);
        coach = `Après ${fr(r.replyLine[0] || '')}, l’adversaire gagne du matériel (environ ${lost} point${lost > 1 ? 's' : ''}).`;
        const h2 = hang[0]; if (h2) { coach += ` ${cap(PIECE_ART[h2.type])} en ${h2.square} est en prise.`; tags.push('hanging'); } else tags.push('tacticAllowed');
      } else if (bestL && materialSwing(r.fenBefore, bestL.pv, 4, me) >= 2) {
        const b = new Chess(r.fenBefore); const bm = tryMove(b, bestL.pv[0]);
        const bmotifs = bm ? detectMotifs(new Chess(r.fenBefore), bm, b) : [];
        const mm = bmotifs.find((x) => ['fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'freePiece', 'promotion'].includes(x.key));
        coach = `Tu pouvais gagner du matériel avec ${fr(r.bestSan)}${mm ? ` (${mm.label.toLowerCase()} : ${mm.detail})` : ''}.`;
        tags.push(mm ? 'missed:' + mm.key : 'missedTactic');
      } else {
        const tips = openingPrinciples(before, mv, r.ply, history);
        if (tips.length && r.ply < 24) { coach = tips[0]; tags.push('opening'); }
        else coach = `Le meilleur coup était ${fr(r.bestSan)}. Ton coup laisse filer une partie de l’avantage (${Math.round(r.loss)} % de chances de gain en moins).`;
        if (phaseOf(before, r.ply) === 'endgame') tags.push('endgame');
      }
    }
  }
  // Explications détaillées (premium)
  if (r.bestLine.length) deep.push(`Ligne recommandée : ${formatLine(r.bestLine.slice(0, 6), r.ply)}.`);
  if (!good && r.replyLine.length) deep.push(`Réfutation de ton coup : ${formatLine(r.replyLine.slice(0, 5), r.ply + 1)}.`);
  for (const m of motifs) if (!coach.includes(m.detail)) deep.push(`${m.label} : ${m.detail}`);
  const hangAfter = hangingPieces(after, me);
  if (hangAfter.length && good) deep.push(`Vigilance : ${PIECE_ART[hangAfter[0].type]} en ${hangAfter[0].square} est attaqué(e).`);
  if (r.ply < 24) for (const t of openingPrinciples(before, mv, r.ply, history)) if (t !== coach) deep.push('Principe : ' + t);
  const wb = winPct(me === 'w' ? r.evalBefore : -r.evalBefore), wa = winPct(me === 'w' ? r.evalAfter : -r.evalAfter);
  deep.push(`Chances de gain pour ${sideName} : ${Math.round(wb)} % → ${Math.round(wa)} %.`);
  return { coach, deep, tags };
}

export async function reviewGame(startFen: string, sans: string[], opts: { depth?: number; onProgress?: (p: number) => void; signal?: { cancelled: boolean } } = {}): Promise<GameReview> {
  const depth = opts.depth || 12;
  const ch = new Chess(startFen);
  const fens = [ch.fen()]; const mvs: Move[] = [];
  for (const s of sans) { const m = tryMove(ch, s); if (!m) break; mvs.push(m); fens.push(ch.fen()); }
  const lines: PvLine[][] = [];
  for (let i = 0; i < fens.length; i++) {
    if (opts.signal?.cancelled) throw new Error('annulé');
    const c = new Chess(fens[i]);
    if (c.isGameOver()) { lines.push(c.isCheckmate() ? [{ move: '', pv: [], cp: null, mate: 0, depth: 0, multipv: 1 }] : [{ move: '', pv: [], cp: 0, mate: null, depth: 0, multipv: 1 }]); }
    else lines.push((await engine.analyse(fens[i], { depth, multipv: 2 })).lines);
    opts.onProgress?.((i + 1) / fens.length);
  }
  const evals = fens.map((f, i) => whiteScore(lines[i][0], f));
  // mat 0 → le camp au trait est maté
  fens.forEach((f, i) => { if (lines[i][0]?.mate === 0) evals[i] = f.split(' ')[1] === 'w' ? -10000 : 10000; });
  const moves: ReviewMove[] = [];
  const counts = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  const accs = { w: [] as number[], b: [] as number[] };
  const phase = { w: {} as Record<string, number[]>, b: {} as Record<string, number[]> };
  for (let i = 0; i < mvs.length; i++) {
    const m = mvs[i]; const me = m.color; const sgn = me === 'w' ? 1 : -1;
    const wb = winPct(sgn * evals[i]); const wa = winPct(sgn * evals[i + 1]);
    const loss = Math.max(0, wb - wa);
    const uci = m.from + m.to + (m.promotion || '');
    const bl = lines[i]; const best = bl[0]?.move || uci;
    const before = new Chess(fens[i]); const after = new Chess(fens[i + 1]);
    const motifs = detectMotifs(before, m, after);
    const second = bl[1] ? winPct(sgn * whiteScore(bl[1], fens[i])) : null;
    const cls = classify({
      loss, isBest: best === uci, book: i < 20 && isBookFen(fens[i + 1]), mate: m.san.includes('#'),
      sacrifice: motifs.some((x) => x.key === 'sacrifice') && (VALUES[m.piece as PieceSymbol] >= 3 || m.promotion != null),
      winBefore: wb, winAfter: wa, onlyMove: second != null && wb - second >= 15 && best === uci,
      missedWin: wb >= 75 && wa < 60,
    });
    const bestLine = uciLineToSan(fens[i], bl[0]?.pv || [], 8);
    const replyLine = uciLineToSan(fens[i + 1], lines[i + 1]?.[0]?.pv || [], 8);
    const base = { ply: i, san: m.san, uci, color: me, cls, loss, evalBefore: evals[i], evalAfter: evals[i + 1], best, bestSan: bestLine[0] || m.san, bestLine, replyLine, fenBefore: fens[i], fenAfter: fens[i + 1] };
    const ex = explain(base, before, m, mvs.slice(0, i), bl, lines[i + 1] || []);
    moves.push({ ...base, ...ex });
    counts[me][cls] = (counts[me][cls] || 0) + 1;
    const a = moveAccuracy(loss); accs[me].push(a);
    const ph = phaseOf(before, i); (phase[me][ph] ||= []).push(a);
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : 0);
  const phaseAcc = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  for (const c of ['w', 'b'] as const) for (const k in phase[c]) phaseAcc[c][k] = avg(phase[c][k]);
  return { moves, accuracy: { w: avg(accs.w), b: avg(accs.b) }, counts, evals, phaseAcc };
}

/** Évaluation rapide d'un seul coup (mode coach pendant la partie). */
export function assessMove(fenBefore: string, m: Move, linesBefore: PvLine[], linesAfter: PvLine[], ply: number, history: Move[]): ReviewMove {
  const fenAfter = new Chess(fenBefore); tryMove(fenAfter, m.san);
  const fa = fenAfter.fen(); const me = m.color; const sgn = me === 'w' ? 1 : -1;
  const eb = whiteScore(linesBefore[0], fenBefore);
  let ea = whiteScore(linesAfter[0], fa); if (fenAfter.isCheckmate()) ea = me === 'w' ? 10000 : -10000; else if (fenAfter.isDraw() || fenAfter.isStalemate()) ea = 0;
  const wb = winPct(sgn * eb), wa = winPct(sgn * ea); const loss = Math.max(0, wb - wa);
  const uci = m.from + m.to + (m.promotion || ''); const best = linesBefore[0]?.move || uci;
  const before = new Chess(fenBefore);
  const motifs = detectMotifs(before, m, new Chess(fa));
  const second = linesBefore[1] ? winPct(sgn * whiteScore(linesBefore[1], fenBefore)) : null;
  const cls = classify({ loss, isBest: best === uci, book: ply < 20 && isBookFen(fa), mate: m.san.includes('#'), sacrifice: motifs.some((x) => x.key === 'sacrifice') && VALUES[m.piece as PieceSymbol] >= 3, winBefore: wb, winAfter: wa, onlyMove: second != null && wb - second >= 15 && best === uci, missedWin: wb >= 75 && wa < 60 });
  const bestLine = uciLineToSan(fenBefore, linesBefore[0]?.pv || [], 8); const replyLine = uciLineToSan(fa, linesAfter[0]?.pv || [], 8);
  const base = { ply, san: m.san, uci, color: me, cls, loss, evalBefore: eb, evalAfter: ea, best, bestSan: bestLine[0] || m.san, bestLine, replyLine, fenBefore, fenAfter: fa };
  return { ...base, ...explain(base, before, m, history, linesBefore, linesAfter) };
}
