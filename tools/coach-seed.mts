// Fabrique un profil réaliste (3 parties analysées par le vrai pipeline + 140 puzzles simulés) pour les captures du coach.
// npx -y tsx tools/coach-seed.mts > tools/tmp/coach-seed.json
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from './uci.mjs';
import { buildReview } from '../src/coach/pipeline';
import { isBookFen } from '../src/data/openings';
import { defaultState } from '../src/lib/store';
import { ensureModel, ensureWeek, ingestReview } from '../src/coach/curriculum';
import { observe, pSuccess } from '../src/coach/model';
import { skillsForPuzzle } from '../src/coach/skills';

const START = new Chess().fen();
const GAMES: { id: string; color: 'w' | 'b'; result: any; bot: string; sans: string[] }[] = [
  { id: 'g1', color: 'b', result: '1-0', bot: 'leo', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3', 'Nb4', 'Qe4', 'c6', 'a3', 'Na6', 'd4', 'Nc7', 'Bf4', 'Kf7', 'Bxe5'] },
  { id: 'g2', color: 'w', result: '0-1', bot: 'leo', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'] },
  { id: 'g3', color: 'w', result: '0-1', bot: 'leo', sans: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'cxd5', 'exd5', 'Nxd5', 'Nxd5', 'Bxd8', 'Bb4+', 'Qd2', 'Bxd2+', 'Kxd2', 'Kxd8'] },
];
const e = new Uci(); await e.init();
const s: any = defaultState(); s.onboarded = true; s.settings.name = 'Camille'; s.puzzle.rating = 1180; s.puzzle.games = 140; s.puzzle.solved = 96;
const reviews: Record<string, any> = {}; const now = Date.now();
for (const [i, g] of GAMES.entries()) {
  const ch = new Chess(); const fens = [ch.fen()]; const ucis: string[] = [];
  for (const x of g.sans) { const m = ch.move(x); ucis.push(m.from + m.to + (m.promotion || '')); fens.push(ch.fen()); }
  const lines: any[] = []; for (const f of fens) lines.push(new Chess(f).isGameOver() ? [] : (await e.analyse(f, { depth: 12, multipv: 3 })).lines);
  const r = buildReview({ startFen: START, moves: ucis, lines, elo: 1180, user: g.color, oppElo: 1200, book: isBookFen, gameId: g.id, result: g.result });
  reviews[g.id] = r;
  s.games.unshift({ id: g.id, date: now - (3 - i) * 86400000, botId: g.bot, color: g.color, result: g.result, pgn: ch.pgn(), moves: g.sans, reviewed: true, accuracy: r.accuracy[g.color] });
  ingestReview(s, r, g.id);
}
e.quit();
const m = ensureModel(s); m.base = 1180;
let seed = 7; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const themes = ['fork', 'pin', 'hangingPiece', 'mateIn1', 'mateIn2', 'skewer', 'discoveredAttack', 'endgame', 'backRankMate', 'deflection'];
const truth: Record<string, number> = { fork: 900, pin: 1200, hangingPiece: 1250, mateIn1: 1450, mateIn2: 1180, skewer: 1150, discoveredAttack: 1100, endgame: 1050, backRankMate: 1300, deflection: 1150 };
let t = now - 14 * 86400000;
for (let i = 0; i < 140; i++) {
  const th = themes[Math.floor(R() * themes.length)]; const d = 1180 + (R() - 0.5) * 400; const ok = R() < pSuccess(truth[th], d);
  const ks = skillsForPuzzle([th], 4); const w = ks.length ? Math.max(0.35, 1 / Math.sqrt(ks.length)) : 1; t += 2 * 3600000;
  for (const k of ks) observe(m, { skill: k, s: ok ? 1 : 0, d, w, src: 'puzzle', ref: 'p' + i, t } as any, t);
}
ensureWeek(s as any, m);
for (const it of Object.values<any>(s.srs)) if (it.kind === 'mistake') it.due = now - 3600000;
process.stdout.write(JSON.stringify({ state: s, reviews }));
