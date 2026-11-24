// Coût du bilan selon la profondeur, moteur WASM lite mono-thread (comme sur téléphone) : 2 passages comme coachReview.
import { Chess } from 'chess.js'; import { Uci } from '../uci.mjs';
process.env.STOCKFISH = ''; const e = new Uci(); await e.init();
const sans = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 Nxe4 O-O Bxc3 d5 Bf6 Re1 Ne7 Rxe4 d6 Bg5 Bxg5 Nxg5 h6 Qe2 hxg5 Re1 Be6 dxe6 f6 Re3 c6 Rh3 Rxh3 gxh3 g6 Qf3 Qa5 Rd1 Qf5 Qb3 O-O-O Qa3 Qc5 Qb3 d5 Bd3 Qd4 Qa3 Kb8'.split(' ');
const c = new Chess(); const fens = [c.fen()]; for (const s of sans) { c.move(s); fens.push(c.fen()); }
const t = async (D) => { const D0 = D <= 14 ? Math.max(8, D - 3) : Math.max(8, Math.min(D - 3, 11)); let t0 = Date.now(); const L = [];
  for (const f of fens) L.push((await e.analyse(f, { depth: D0, multipv: 3 })).lines); const p1 = Date.now() - t0;
  const crit = fens.map((_, i) => i).filter((i) => i % 3 === 0); t0 = Date.now(); for (const i of crit) await e.analyse(fens[i], { depth: D, multipv: 3 }); return { D, D0, pass1: p1, pass2: Date.now() - t0, crit: crit.length, plies: fens.length }; };
for (const D of [12, 16, 18]) console.log(JSON.stringify(await t(D)));
e.quit();
