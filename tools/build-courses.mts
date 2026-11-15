// Génère src/data/lessons/course-data.json : parties célèbres commentées (coups + commentaires FR + éval. Stockfish)
// et positions d'exemple par thème (tirées des puzzles validés par Stockfish).
import fs from 'node:fs';
import readline from 'node:readline';
import { Chess, type Move } from 'chess.js';
import { FAMOUS_NOTES } from './content/famous-notes';
// @ts-ignore
import { Uci, score } from './uci.mjs';
const PN: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const ART = (p: string) => (p === 'p' ? 'le pion' : `le ${PN[p]}`).replace('le dame', 'la dame').replace('le tour', 'la tour');
const SANFR = (s: string) => s.replace(/[NBRQK]/g, (c) => ({ N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' } as any)[c]);
const fmt = (cp: number) => { if (Math.abs(cp) >= 90000) return cp > 0 ? 'mat pour les Blancs' : 'mat pour les Noirs'; const v = (cp / 100).toFixed(1).replace('.', ','); return (cp > 0 ? '+' : '') + v; };
function describe(m: Move, c: Chess, ply: number): string {
  const side = m.color === 'w' ? 'Les Blancs' : 'Les Noirs'; let s: string;
  if (m.san.startsWith('O-O-O')) s = `${side} font le grand roque.`;
  else if (m.san.startsWith('O-O')) s = `${side} roquent côté roi.`;
  else if (m.promotion) s = `Le pion ${m.captured ? 'prend en ' + m.to + ' et ' : 'avance en ' + m.to + ' et '}est promu en ${PN[m.promotion]} !`;
  else if (m.captured) s = `${ART(m.piece)[0].toUpperCase() + ART(m.piece).slice(1)} prend ${m.flags.includes('e') ? 'le pion en passant' : (m.captured === 'p' ? 'le pion' : ART(m.captured))} en ${m.to}.`;
  else if (m.piece === 'p') s = ply < 16 ? `Le pion ${m.from[0]} avance en ${m.to}${['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(m.to) ? ' et occupe le centre' : ''}.` : `Le pion avance en ${m.to}.`;
  else if ((m.from[1] === '1' || m.from[1] === '8') && ['n', 'b'].includes(m.piece) && ply < 24) s = `${ART(m.piece)[0].toUpperCase() + ART(m.piece).slice(1)} se développe en ${m.to}.`;
  else s = `${ART(m.piece)[0].toUpperCase() + ART(m.piece).slice(1)} va en ${m.to}.`;
  if (c.isCheckmate()) s += ' Échec et mat !'; else if (c.inCheck()) s += ' Échec !';
  return s;
}
const uci = new Uci(); await uci.init();
const famous: any[] = []; const games = JSON.parse(fs.readFileSync('tools/data/famous.json', 'utf8'));
const evalOf = async (fen: string) => { const a = await uci.analyse(fen, { depth: 12 }); const l = a.lines[0]; const sc = l ? score(l) : 0; const white = fen.split(' ')[1] === 'w' ? sc : -sc; return { white, best: a.best }; };
for (const n of FAMOUS_NOTES) {
  const g = games[n.id]; if (!g) { console.log('manque', n.id); continue; }
  const c = new Chess(); const comments: string[] = []; let prev = await evalOf(c.fen()); const evals: number[] = [];
  for (let i = 0; i < g.sans.length; i++) {
    const fenBefore = c.fen(); const bestUci = prev.best; const m = c.move(g.sans[i]);
    const ev = c.isCheckmate() ? { white: m.color === 'w' ? 100000 : -100000, best: '' } : await evalOf(c.fen());
    const key = `${Math.floor(i / 2) + 1}${i % 2 ? 'b' : 'w'}`;
    let txt = n.notes[key] ? `**${n.notes[key]}**` : describe(m, c, i);
    const sgn = m.color === 'w' ? 1 : -1; const cap = (x: number) => Math.max(-1500, Math.min(1500, x));
    const loss = sgn * (cap(prev.white) - cap(ev.white));
    if (loss >= 150 && sgn * ev.white < 300 && bestUci && bestUci !== (m.from + m.to + (m.promotion || '')) && Math.abs(prev.white) < 90000) {
      const t = new Chess(fenBefore); const bm = t.move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] as any });
      txt += ` _(Le moteur moderne préférait ${SANFR(bm.san)}.)_`;
    }
    if (i % 2 === 1 || n.notes[key]) txt += ` Éval. : ${fmt(ev.white)}.`;
    comments.push(txt); evals.push(Math.round(Math.max(-2000, Math.min(2000, ev.white)))); prev = ev;
  }
  // coup clé : position avant et séquence
  const [num, side] = [parseInt(n.key), n.key.endsWith('b') ? 1 : 0]; const kIdx = (num - 1) * 2 + side; const keyLen = n.keyLen || 1;
  famous.push({ id: n.id, title: n.title, icon: n.icon, intro: n.intro, takeaways: n.takeaways, white: g.white, black: g.black, event: g.event, date: g.date, result: g.result, sans: g.sans, comments, evals, keyIdx: kIdx, keyLen, keyPrompt: n.keyPrompt });
  console.log('partie', n.id, g.sans.length, 'demi-coups');
}
uci.quit();
// — Exemples par thème —
const THEMES = ['anastasiaMate', 'arabianMate', 'backRankMate', 'balestraMate', 'blindSwineMate', 'bodenMate', 'cornerMate', 'doubleBishopMate', 'dovetailMate', 'epauletteMate', 'hookMate', 'killBoxMate', 'morphysMate', 'operaMate', 'pillsburysMate', 'smotheredMate', 'swallowstailMate', 'triangleMate', 'vukovicMate',
  'fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck', 'doubleCheck', 'deflection', 'attraction', 'sacrifice', 'hangingPiece', 'trappedPiece', 'intermezzo', 'interference', 'xRayAttack', 'quietMove', 'defensiveMove', 'clearance', 'capturingDefender', 'zugzwang', 'promotion', 'underPromotion', 'enPassant', 'attackingF2F7', 'exposedKing', 'kingsideAttack', 'queensideAttack', 'advancedPawn', 'castling',
  'pawnEndgame', 'rookEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame', 'queenRookEndgame', 'opening', 'middlegame', 'advantage', 'mateIn1', 'mateIn2', 'mateIn3'];
const pool: Record<string, any[]> = Object.fromEntries(THEMES.map((t) => [t, []]));
const rl = readline.createInterface({ input: fs.createReadStream('tools/data/core_valid.jsonl') });
for await (const line of rl) { const p = JSON.parse(line); const n = p.m.split(' ').length; for (const t of p.t) if (pool[t] && n <= 6 && p.r >= 500 && p.r <= 2000) pool[t].push(p); }
const used = new Set<string>(); const examples: Record<string, any[]> = {};
for (const t of THEMES) {
  const list = pool[t].sort((a, b) => a.r - b.r); const want = 4; const out: any[] = [];
  for (let k = 0; k < want && list.length; k++) { // étalés en difficulté : 15 %, 35 %, 55 %, 75 %
    let idx = Math.floor(list.length * (0.15 + 0.2 * k)); while (idx < list.length && used.has(list[idx].i)) idx++;
    const p = list[idx]; if (!p) break; used.add(p.i);
    const c = new Chess(p.f); const ms = p.m.split(' ').map((u: string) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    out.push({ id: p.i, fen: p.f, pre: [ms[0]], line: ms.slice(1), r: p.r, themes: p.t });
  }
  examples[t] = out;
}
fs.writeFileSync('src/data/lessons/course-data.json', JSON.stringify({ famous, examples }));
console.log('exemples', Object.values(examples).flat().length, 'taille', (fs.statSync('src/data/lessons/course-data.json').size / 1024).toFixed(0), 'Ko');
process.exit(0);
