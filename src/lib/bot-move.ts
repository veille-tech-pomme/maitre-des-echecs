// Choix du coup d'un bot selon sa personnalité (affaiblissement contrôlé de Stockfish).
import { Chess, tryMove, VALUES, type PieceSymbol } from './chess';
import { engine } from './engine';
import type { Bot } from '../data/bots';
import type { Square, Move } from 'chess.js';

/** Probabilité de voir qu'une case d'arrivée est attaquée (angle mort selon le niveau). */
export const seeProb = (elo: number) => (elo < 500 ? 0.25 : elo < 800 ? 0.5 : elo < 1100 ? 0.75 : elo < 1400 ? 0.9 : 0.97);
const CENTER = new Set(['d4', 'e4', 'd5', 'e5']); const WIDE = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6']);
/**
 * Erreur « humaine » (audit Magnus B7) : au lieu d'un coup tiré au hasard, le bot joue un coup NATUREL — prise, échec,
 * développement, centralisation, fuite d'une pièce attaquée — évalué sans calculer la réponse adverse, avec des angles morts
 * qui dépendent du niveau (il ne voit pas toujours que la case d'arrivée est attaquée). Ce sont les fautes typiques
 * d'un joueur de club débutant : prise d'un pion empoisonné, pièce laissée en prise, menace adverse ignorée.
 */
export function naturalMove(ch: Chess, elo: number, rnd: () => number = Math.random): Move | null {
  const legal = ch.moves({ verbose: true }); if (!legal.length) return null;
  const me = ch.turn(); const opp = me === 'w' ? 'b' : 'w'; const ply = ch.history().length; const see = seeProb(elo);
  const scored = legal.map((m) => {
    const v = VALUES[m.piece as PieceSymbol]; let s = 0;
    if (m.captured) s += VALUES[m.captured as PieceSymbol] * 100;
    if (m.promotion) s += 800;
    if (m.san.includes('+')) s += 60;
    if (m.san.includes('#')) s += 10000;
    if (CENTER.has(m.to)) s += 25; else if (WIDE.has(m.to)) s += 10;
    if (ply < 20 && (m.piece === 'n' || m.piece === 'b') && (m.from[1] === '1' || m.from[1] === '8')) s += 40;
    if (m.san.startsWith('O-O')) s += 50;
    if (ply < 16 && m.piece === 'k' && !m.san.startsWith('O-O')) s -= 60;
    if (ply < 12 && m.piece === 'q') s -= 25;
    // une pièce attaquée qu'on met à l'abri : un joueur la voit en général
    if (v >= 3 && ch.isAttacked(m.from as Square, opp)) s += v * 40;
    // danger sur la case d'arrivée, vu ou non selon le niveau
    if (rnd() < see) {
      const n = new Chess(ch.fen()); n.move(m);
      if (n.isAttacked(m.to as Square, opp)) {
        const atk = n.attackers(m.to as Square, opp).map((sq) => VALUES[n.get(sq)!.type as PieceSymbol]);
        const defended = n.isAttacked(m.to as Square, me);
        const loss = defended ? Math.max(0, v - Math.min(...atk)) : v;
        s -= loss * 100;
      }
    }
    return { m, s };
  });
  const max = Math.max(...scored.map((x) => x.s)); const T = 45;
  const ws = scored.map((x) => Math.exp((x.s - max) / T));
  let t = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) { t -= ws[i]; if (t <= 0) return scored[i].m; }
  return scored[0].m;
}

type Eng = Pick<typeof engine, 'analyse'>;
/** `eng` : moteur injectable (calibration hors navigateur : tools/calibrate-bots.mts). */
/** `hurry` : pendule à moins de 10 % → calcul raccourci (brief P0 §4). */
export async function botMove(bot: Bot, fen: string, history: string[], eng: Eng = engine, hurry = false): Promise<string> {
  const ch = new Chess(fen);
  const legal = ch.moves({ verbose: true });
  if (!legal.length) return '';
  // ouverture de répertoire
  if (bot.book) {
    const opts = bot.book.filter((l) => l.length > history.length && history.every((m, i) => l[i] === m));
    if (opts.length) { const l = opts[Math.floor(Math.random() * opts.length)]; const mv = legal.find((m) => m.san === l[history.length]); if (mv) return mv.from + mv.to + (mv.promotion || ''); }
  }
  if (Math.random() < bot.randomPct) {
    // erreur humaine : coup naturel sans calcul de la réponse adverse (plus de coup tiré au hasard)
    const m = naturalMove(ch, bot.elo); if (m) return m.from + m.to + (m.promotion || '');
  }
  if (bot.limitElo || bot.temp === 0) {
    const r = await eng.analyse(fen, { depth: bot.limitElo ? undefined : bot.depth, movetime: hurry ? 150 : bot.movetime || (bot.limitElo ? 700 : undefined), elo: bot.limitElo, multipv: 1 });
    return r.best;
  }
  const r = await eng.analyse(fen, { depth: hurry ? Math.min(bot.depth, 6) : bot.depth, multipv: Math.min(bot.multipv, legal.length) });
  if (!r.lines.length) return r.best;
  const scored = r.lines.map((l) => {
    let s = l.mate != null ? (l.mate > 0 ? 5000 - l.mate * 50 : -5000 - l.mate * 50) : (l.cp || 0);
    const mv = legal.find((m) => m.from + m.to + (m.promotion || '') === l.move);
    if (mv) {
      if (mv.captured && bot.captureBias) s += bot.captureBias;
      if (mv.san.includes('+') && bot.checkBias) s += bot.checkBias;
      if (mv.captured && bot.tradeBias && VALUES[mv.captured as PieceSymbol] === VALUES[mv.piece as PieceSymbol]) s += bot.tradeBias;
    }
    return { move: l.move, s };
  });
  const max = Math.max(...scored.map((x) => x.s));
  const ws = scored.map((x) => Math.exp((x.s - max) / Math.max(1, bot.temp)));
  let t = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < scored.length; i++) { t -= ws[i]; if (t <= 0) return scored[i].move; }
  return scored[0].move;
}
export { tryMove };
