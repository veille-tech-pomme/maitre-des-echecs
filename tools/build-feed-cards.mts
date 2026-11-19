// Génère les cartes du fil « Pour toi » qui demandent un moteur : « trouve le coup du maître » (moments clés
// de parties notables : base explorer + grandes parties classiques) et « quelle est la menace ? » (puzzles Lichess CC0).
// Stockfish natif (tools/uci.mjs), multi-processus. Sortie : src/data/feed-master.json, src/data/feed-threats.json
// Usage : npx -y tsx tools/build-feed-cards.mts [nbParties=420] [nbMenacesParTranche=40]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci, score } from './uci.mjs';
import { lineThemes } from '../src/coach/themes';

const NG = +(process.argv[2] || 420), NT = +(process.argv[3] || 40), WORKERS = 7;
const pool: any[] = [];
async function engines() { for (let i = 0; i < WORKERS; i++) { const u = new Uci(); await u.init(); pool.push(u); } }
async function par<T, R>(items: T[], fn: (u: any, x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let k = 0;
  await Promise.all(pool.map(async (u) => { while (k < items.length) { const i = k++; try { out[i] = await fn(u, items[i]); } catch { out[i] = null as any; } if (i % 200 === 0) process.stderr.write(`  ${i}/${items.length}\n`); } }));
  return out;
}
/** analyse + profondeur minimale à partir de laquelle le meilleur coup ne change plus */
async function deep(u: any, fen: string, depth: number, multipv = 2) {
  u.send(`setoption name MultiPV value ${multipv}`); u.send('ucinewgame'); u.send(`position fen ${fen}`); u.send(`go depth ${depth}`);
  const ls: string[] = await u.wait(/^bestmove/);
  const byDepth: Record<number, string> = {}; const pv: Record<string, any> = {};
  for (const l of ls) {
    const m = l.match(/^info depth (\d+) .*multipv (\d+) .*score (cp|mate) (-?\d+).* pv (.+)$/);
    if (!m || /(lower|upper)bound/.test(l)) continue;
    const mv = m[5].trim().split(' ');
    if (m[2] === '1') byDepth[+m[1]] = mv[0];
    pv[m[2]] = { move: mv[0], cp: m[3] === 'cp' ? +m[4] : null, mate: m[3] === 'mate' ? +m[4] : null, pv: mv };
  }
  const best = ls[ls.length - 1].split(' ')[1];
  let d0 = depth; for (let d = depth; d >= 1; d--) { if (byDepth[d] && byDepth[d] !== best) break; if (byDepth[d]) d0 = d; }
  return { best, lines: Object.values(pv).sort((a: any, b: any) => score(b) - score(a)), d0 };
}
const uciOf = (m: any) => m.from + m.to + (m.promotion || '');
const NAME: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const ART: Record<string, string> = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame', k: 'le roi' };
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const TH_FR: Record<string, string> = { fork: 'une fourchette', pin: 'un clouage', skewer: 'une enfilade', discoveredAttack: 'une attaque à la découverte', discoveredCheck: 'un échec à la découverte', doubleCheck: 'un échec double', hangingPiece: 'une pièce laissée sans défense', trappedPiece: 'une pièce piégée', backRankMate: 'un mat du couloir', deflection: 'une déviation', attraction: 'une attraction', xRayAttack: 'une attaque en rayons X', capturingDefender: 'l’élimination d’un défenseur', overload: 'une surcharge' };
function sanLine(fen: string, uci: string[], n = 6) { const c = new Chess(fen); const out: string[] = []; for (const u of uci.slice(0, n)) { try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } } return out; }
/** Matériel gagné (pour le camp au trait) au bout de la ligne, en s'arrêtant hors échange. */
function matGain(fen: string, uci: string[]) {
  const c = new Chess(fen); const me = c.turn(); const bal = () => { let s = 0; for (const r of c.board()) for (const p of r) if (p) s += (p.color === me ? 1 : -1) * VAL[p.type]; return s; };
  const b0 = bal(); let best = 0, k = 0;
  for (const u of uci.slice(0, 10)) { let m; try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; } k++; if (k % 2 === 0 && !m.captured) best = bal() - b0; }
  if (k % 2 === 1 || k === uci.length) best = Math.max(best, Math.min(best || 99, bal() - b0)) || bal() - b0;
  return best;
}
function reason(fen: string, l: any, second: any) {
  // structure rendue par l'appli (notation française) : k = mate | win | theme | only
  const line = sanLine(fen, l.pv, 5);
  const th = lineThemes(fen, l.pv, false).filter((t) => t.ply <= 4)[0];
  const loss = second ? Math.round(Math.min(20, (score(l) - score(second)) / 100)) : 0;
  const base = { th: th ? TH_FR[th.key] : undefined, line };
  if (l.mate != null && l.mate > 0) return { k: 'mate', n: l.mate, ...base };
  const g = matGain(fen, l.pv);
  if (g >= 2) return { k: 'win', n: g, ...base };
  if (th) return { k: 'theme', ...base };
  return { k: 'only', n: Math.max(2, loss), ...base };
}

// ——— 1. Coups du maître ———
interface Game { w: string; b: string; y: string; ev: string; hero: 'w' | 'b'; moves: string[]; src: 'classic' | 'explorer'; id?: number }
function games(): Game[] {
  const out: Game[] = [];
  const classics = JSON.parse(fs.readFileSync('src/data/masters.json', 'utf8'));
  for (const g of classics) out.push({ w: g.w.trim(), b: g.b.trim(), y: g.y, ev: g.ev, hero: g.side, moves: g.m.split(' '), src: 'classic' });
  const ex: Game[] = [];
  for (const f of fs.readdirSync('public/explorer/g')) {
    const txt = zlib.gunzipSync(fs.readFileSync('public/explorer/g/' + f)).toString();
    for (const line of txt.split('\n')) {
      const [id, white, black, we, be, result, date, event, , mv] = line.split('|'); if (!mv) continue;
      if (result !== '1' && result !== '0') continue;
      const moves = mv.split(' '); if (moves.length < 40 || moves.length > 140) continue;
      if (/blitz|bullet|armageddon|960|fischer/i.test(event)) continue;
      ex.push({ w: white, b: black, y: date.slice(0, 4), ev: event.replace(/\s{2,}/g, ' · '), hero: result === '1' ? 'w' : 'b', moves, src: 'explorer', id: parseInt(id, 36), _e: (+we) + (+be) } as any);
    }
  }
  ex.sort((a: any, b: any) => b._e - a._e);
  const seen = new Set<string>();
  for (const g of ex) { const k = g.w + g.b + g.y; if (seen.has(k)) continue; seen.add(k); out.push(g); if (out.length >= classics.length + NG) break; }
  return out;
}
const short = (n: string) => { const p = n.split(',')[0].trim(); return p.split(' ').length > 2 ? p.split(' ').slice(-1)[0] : p; };

async function masters() {
  const gs = games(); console.error('parties :', gs.length);
  const cands: any[] = [];
  gs.forEach((g, gi) => {
    const c = new Chess(); let prev: any = null;
    g.moves.forEach((san, i) => {
      const fen = c.fen(); let m; try { m = c.move(san); } catch { return; }
      const heroTurn = (i % 2 === 0 ? 'w' : 'b') === g.hero;
      if (heroTurn && i >= 14 && i < g.moves.length - 1) {
        const pre = new Chess(fen);
        if (!pre.inCheck() && pre.moves().length >= 10 && !(prev?.captured && prev.to === m.to)) cands.push({ gi, ply: i, fen, uci: uciOf(m), san: m.san });
      }
      prev = m;
    });
  });
  console.error('positions candidates :', cands.length);
  const r1 = await par(cands, async (u, x) => {
    const a = await deep(u, x.fen, 11); const [l1, l2] = a.lines;
    if (!l1 || !l2 || l1.move !== x.uci) return null;
    const s1 = score(l1), s2 = score(l2);
    if (s1 < -50 || (l1.mate == null && s1 > 600) || (l2.mate != null && l2.mate > 0)) return null;
    if (s1 - s2 < 180) return null;
    return { ...x, gap: s1 - s2 };
  });
  const byGame = new Map<number, any[]>();
  for (const x of r1) if (x) (byGame.get(x.gi) || byGame.set(x.gi, []).get(x.gi)!).push(x);
  const pick: any[] = [];
  for (const [, xs] of byGame) { xs.sort((a, b) => b.gap - a.gap); pick.push(...xs.slice(0, 2).sort((a, b) => a.ply - b.ply)); }
  console.error('vérification :', pick.length);
  const r2 = await par(pick, async (u, x) => {
    const a = await deep(u, x.fen, 18); const [l1, l2] = a.lines;
    if (!l1 || !l2 || l1.move !== x.uci) return null;
    const s1 = score(l1), s2 = score(l2); if (s1 - s2 < 150 || s1 < -50) return null;
    const g = gs[x.gi]; const hero = g.hero === 'w' ? g.w : g.b, vil = g.hero === 'w' ? g.b : g.w;
    const quiet = !x.san.includes('x') && !x.san.includes('+');
    const r = Math.max(700, Math.min(2300, 650 + 105 * a.d0 + (quiet ? 150 : 0) - (x.san.includes('+') ? 80 : 0)));
    const num = Math.floor(x.ply / 2) + 1, dots = x.ply % 2 === 0 ? '.' : '…';
    return { f: x.fen, m: x.uci, r, hero: short(hero), vs: short(vil), y: g.y, ev: g.ev, n: `${num}${dots}`, san: x.san, why: reason(x.fen, l1, l2), src: g.src, gid: g.id };
  });
  const out = r2.filter(Boolean);
  // difficulté : moyenne pondérée entre la profondeur de découverte et la nature du coup (mat court, prise gagnante, coup calme)
  for (const x of out as any[]) {
    const k = x.why.k, cap = x.san.includes('x'), chk = x.san.includes('+');
    const r2 = k === 'mate' ? 850 + 170 * Math.min(5, x.why.n) : k === 'win' ? (cap ? 950 : 1300) : k === 'theme' ? 1350 : !cap && !chk ? 1600 : 1350;
    x.r = Math.round((x.r + 2 * r2) / 3 / 10) * 10;
  }
  fs.writeFileSync('src/data/feed-master.json', JSON.stringify(out));
  console.error('coups du maître :', out.length);
}

// ——— 2. Quelle est la menace ? ———
async function threats() {
  const idx = JSON.parse(fs.readFileSync('src/data/packs-index.json', 'utf8'));
  const cands: any[] = [];
  for (let b = 5; b <= 22; b++) {
    const f = `public/packs/core/b${b}.gz`; if (!fs.existsSync(f)) continue;
    const lines = zlib.gunzipSync(fs.readFileSync(f)).toString().split('\n').filter(Boolean);
    let n = 0;
    for (const line of lines) {
      if (n >= NT * 4) break;
      const [i, fen, mv, r] = line.split('|'); const ms = mv.split(' '); if (ms.length < 4) continue;
      const c = new Chess(fen + ' 0 1');
      try { c.move({ from: ms[0].slice(0, 2), to: ms[0].slice(2, 4), promotion: ms[0][4] }); } catch { continue; }
      let m1; try { m1 = c.move({ from: ms[1].slice(0, 2), to: ms[1].slice(2, 4), promotion: ms[1][4] }); } catch { continue; }
      if (m1.captured || c.inCheck() || m1.promotion) continue;
      // position : la victime au trait ; coup adverse que l'on vient de subir = m1
      const parts = c.fen().split(' '); parts[1] = parts[1] === 'w' ? 'b' : 'w'; parts[3] = '-';
      const nul = parts.join(' '); try { new Chess(nul); } catch { continue; }
      if (new Chess(nul).inCheck()) continue;
      cands.push({ id: i, fen: c.fen(), nul, last: ms[1], lastSan: m1.san, r: +r, b }); n++;
    }
  }
  console.error('menaces candidates :', cands.length);
  const res = await par(cands, async (u, x) => {
    const real = await deep(u, x.fen, 12, 1); const nul = await deep(u, x.nul, 12, 3);
    const [t1, t2, t3] = nul.lines; if (!t1 || !t2) return null;
    const sReal = -score(real.lines[0]); // du point de vue de l'attaquant
    const sNul = score(t1);
    const mate = t1.mate != null && t1.mate > 0 && t1.mate <= 3;
    if (!mate && sNul - sReal < 250) return null;
    if (!mate && sNul < 250) return null;
    if (score(t2) > sNul - 200) return null; // menace unique
    const c = new Chess(x.nul); const tm = c.move({ from: t1.move.slice(0, 2), to: t1.move.slice(2, 4), promotion: t1.move[4] });
    // leurres : coups plausibles de l'attaquant (échecs, prises, attaques), hors top 3
    const top = new Set([t1, t2, t3].filter(Boolean).map((l: any) => l.move));
    const c2 = new Chess(x.nul);
    const all = c2.moves({ verbose: true }).filter((m) => !top.has(uciOf(m)));
    const plaus = all.map((m) => ({ m, w: (m.san.includes('+') ? 3 : 0) + (m.captured ? 2 : 0) + (m.piece !== 'p' && m.piece !== 'k' ? 1 : 0) + ((x.b * 7 + m.to.charCodeAt(1)) % 3) * 0.3 }))
      .sort((a, b) => b.w - a.w);
    const dec: string[] = []; const used = new Set([tm.to]);
    for (const p of plaus) { if (dec.length >= 2) break; if (used.has(p.m.to) && dec.length < 1) continue; dec.push(uciOf(p.m)); used.add(p.m.to); }
    if (dec.length < 2) return null;
    // w : nature de la menace, rendue en français par l'appli
    let w: any;
    if (mate) w = { k: 'mate', n: t1.mate };
    else { const g = matGain(x.nul, t1.pv); w = tm.captured && VAL[tm.captured] >= 3 ? { k: 'cap', p: tm.captured } : g >= 2 ? { k: 'mat', n: g } : { k: 'strong' }; }
    const th = lineThemes(x.nul, t1.pv, false).filter((t) => t.ply <= 2)[0];
    return { id: x.id, f: x.fen, last: x.last, ls: x.lastSan, t: t1.move, d: dec, r: x.r, w, line: sanLine(x.nul, t1.pv, 4), th: th ? TH_FR[th.key] : undefined };
  });
  const out = res.filter(Boolean);
  fs.writeFileSync('src/data/feed-threats.json', JSON.stringify(out));
  console.error('menaces :', out.length);
}

await engines();
const which = process.env.ONLY;
if (!which || which === 'threats') await threats();
if (!which || which === 'master') await masters();
for (const u of pool) u.quit();
