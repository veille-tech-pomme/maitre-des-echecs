// Choix du coup d'un bot selon sa personnalité (affaiblissement contrôlé de Stockfish).
import { Chess, tryMove, VALUES, type PieceSymbol } from './chess';
import { engine } from './engine';
import type { Bot } from '../data/bots';

export async function botMove(bot: Bot, fen: string, history: string[]): Promise<string> {
  const ch = new Chess(fen);
  const legal = ch.moves({ verbose: true });
  if (!legal.length) return '';
  // ouverture de répertoire
  if (bot.book) {
    const opts = bot.book.filter((l) => l.length > history.length && history.every((m, i) => l[i] === m));
    if (opts.length) { const l = opts[Math.floor(Math.random() * opts.length)]; const mv = legal.find((m) => m.san === l[history.length]); if (mv) return mv.from + mv.to + (mv.promotion || ''); }
  }
  if (Math.random() < bot.randomPct) {
    // coup « humain » aléatoire, avec une préférence pour les prises
    const w = legal.map((m) => 1 + (m.captured ? 3 : 0) + (m.san.includes('+') ? 1 : 0));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < legal.length; i++) { r -= w[i]; if (r <= 0) return legal[i].from + legal[i].to + (legal[i].promotion || ''); }
  }
  if (bot.limitElo || bot.temp === 0) {
    const r = await engine.analyse(fen, { depth: bot.limitElo ? undefined : bot.depth, movetime: bot.movetime || (bot.limitElo ? 700 : undefined), elo: bot.limitElo, multipv: 1 });
    return r.best;
  }
  const r = await engine.analyse(fen, { depth: bot.depth, multipv: Math.min(bot.multipv, legal.length) });
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
