// Candidats pour le corpus positionnel : on garde ceux où Stockfish confirme une vraie erreur, et on affiche sa ligne.
import { Chess } from 'chess.js';
// @ts-ignore
import { Uci } from '../uci.mjs';
const C: [string, string, string][] = [
  // [id, fen, coup (SAN)]
  ['k-g4', 'r1b2rk1/ppq2ppp/2nbpn2/3p4/3P4/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 10', 'g4'],
  ['k-nd7', 'r1bq1rk1/pp2bppp/2n1pn2/3p2N1/3P4/2PBP3/PPQ2PPP/RN2K2R b KQ - 0 9', 'Nd7'],
  ['k-f6', 'r1bq1rk1/ppp1bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R b KQ - 0 6', 'Nh5'],
  ['k-h6g5', 'r1bq1rk1/pp2bpp1/2n1pn1p/3p4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R b KQ - 0 9', 'g5'],
  ['k-nocastle', 'r1bqk2r/pp2bppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R1BQR1K1 b kq - 0 9', 'a6'],
  ['k-kingwalk', 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'Ke2'],
  ['d-qearly', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'Qf6'],
  ['d-qh4', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2', 'Qh4'],
  ['d-pawns', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', 'h6'],
  ['d-a3', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'a3'],
  ['d-twice', 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3', 'Nb5'],
  ['p-isolani', 'r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/2PBPN2/PP3PPP/RNBQK2R w KQkq - 0 6', 'dxc5'],
  ['p-doubled', 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4', 'e3'],
  ['p-backward', 'r1bqkb1r/pp3ppp/2np1n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7', 'Nd5'],
  ['p-d5hole', 'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 5', 'e5'],
  ['p-passer', '8/5pk1/6p1/3P4/5P2/6K1/8/8 b - - 0 40', 'Kf6'],
  ['p-passer2', '6k1/5ppp/8/3P4/8/8/5PPP/3R2K1 b - - 0 30', 'h6'],
  ['p-blockade', '3r2k1/5ppp/3P4/8/8/8/5PPP/3R2K1 b - - 0 30', 'g6'],
  ['a-openfile', '2r2rk1/pp2qppp/2n1pn2/8/3P4/P1N2N2/1P2QPPP/2R2RK1 b - - 0 15', 'a6'],
  ['a-rim', 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7', 'Na4'],
  ['a-badbishop', 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3', 'Bd7'],
  ['a-outpost', 'r2q1rk1/pp1bppbp/2np1np1/8/2PNP3/2N1B3/PP2BPPP/R2QK2R b KQ - 0 9', 'e5'],
  ['a-passive', 'r2qr1k1/pp1n1ppp/2pb1n2/3p4/3P1B2/2NBPN2/PPQ2PPP/R4RK1 w - - 0 11', 'Bg3'],
  ['a-knightback', 'r1bq1rk1/pppn1ppp/3bpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 8', 'Ne1'],
  ['x-ng5', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5', 'd6'],
  ['x-nd5', 'r1bqkb1r/pp1n1ppp/2n1p3/2ppP3/3P4/2PB4/PP1N1PPP/R1BQK1NR b KQkq - 3 6', 'a6'],
  ['x-bb5', 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2', 'a6'],
  ['t-matethreat', 'r4rk1/ppq2ppp/2p1pn2/8/3P4/2PB4/PP1Q1PPP/R4RK1 b - - 0 15', 'Rad8'],
  ['t-luft', '3r2k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 30', 'Rb7'],
  ['t-backrank', '2r3k1/5ppp/8/8/8/8/1Q3PPP/2R3K1 w - - 0 30', 'Qb7'],
  ['e-kingact', '8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 40', 'f4'],
  ['e-rookbehind', '8/5pk1/6p1/P7/8/r5P1/5PK1/R7 b - - 0 40', 'Ra2'],
  ['s-space', 'rnbqkb1r/ppp1pp1p/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4', 'c5'],
  ['s-c5', 'r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq - 2 3', 'd4'],
  ['k-f3', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5', 'Ng5'],
  ['k-h3g4', 'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 1 6', 'h4'],
];
const e = new Uci(); await e.init();
for (const [id, fen, san] of C) {
  const ch = new Chess(fen); let m: any; try { m = ch.move(san); } catch { console.log(id, 'ILLÉGAL', san); continue; }
  const uci = m.from + m.to + (m.promotion || '');
  const b = await e.analyse(fen, { depth: 16, multipv: 1 }); const a = await e.analyse(ch.fen(), { depth: 16, multipv: 1 });
  const best = b.lines[0]; const rep = a.lines[0];
  const cpB = best.mate != null ? (best.mate > 0 ? 3000 : -3000) : best.cp; const cpA = rep.mate != null ? (rep.mate > 0 ? -3000 : 3000) : -rep.cp;
  const sanLine = (f: string, pv: string[], n: number) => { const c = new Chess(f); return pv.slice(0, n).map((u) => { try { return c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch { return '?'; } }).join(' '); };
  console.log(`${id}\t${uci}\tloss=${cpB - cpA}\tbest=${sanLine(fen, best.pv, 6)}\treply=${sanLine(ch.fen(), rep.pv, 8)}`);
}
e.quit();
