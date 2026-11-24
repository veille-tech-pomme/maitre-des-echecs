// Petit pilote UCI pour Node (Stockfish natif si dispo, sinon Stockfish WASM du paquet npm).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
export function findEngine() {
  const cands = [process.env.STOCKFISH, '/tmp/sf', '/usr/games/stockfish', '/usr/bin/stockfish'].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return { cmd: c, args: [] };
  const js = path.resolve('node_modules/stockfish/bin/stockfish-18-lite-single.js');
  return { cmd: process.execPath, args: [js] };
}
export class Uci {
  constructor() {
    const e = findEngine();
    this.p = spawn(e.cmd, e.args, { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = ''; this.waiters = []; this.lines = [];
    this.p.stdout.on('data', d => {
      this.buf += d.toString();
      let i; while ((i = this.buf.indexOf('\n')) >= 0) {
        const l = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        this.lines.push(l);
        for (const w of [...this.waiters]) if (w.re.test(l)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(this.lines.splice(0)); }
      }
    });
  }
  send(s) { this.p.stdin.write(s + '\n'); }
  wait(re) { return new Promise(res => this.waiters.push({ re, res })); }
  async init() { this.send('uci'); const id = await this.wait(/^uciok/); this.name = (id.find((l) => l.startsWith('id name ')) || '').slice(8); this.send('setoption name Threads value 1'); this.send('setoption name Hash value 32'); this.send('isready'); await this.wait(/^readyok/); }
  /** Retourne {best, lines:[{move, cp, mate}]} */
  async analyse(fen, { depth = 14, multipv = 1, searchmoves, nodes } = {}) {
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send('ucinewgame'); this.send(`position fen ${fen}`);
    this.send(`go ${nodes ? 'nodes ' + nodes : 'depth ' + depth}${searchmoves ? ' searchmoves ' + searchmoves.join(' ') : ''}`);
    const ls = await this.wait(/^bestmove/);
    const pv = {};
    for (const l of ls) {
      const m = l.match(/ multipv (\d+) .*score (cp|mate) (-?\d+).* pv (\S+)/);
      if (m && l.includes(` depth `) && !/(lower|upper)bound/.test(l)) pv[m[1]] = { move: m[4], cp: m[2] === 'cp' ? +m[3] : null, mate: m[2] === 'mate' ? +m[3] : null, pv: l.split(' pv ')[1].trim().split(' ') };
    }
    const best = ls[ls.length - 1].split(' ')[1];
    return { best, lines: Object.values(pv) };
  }
  quit() { this.send('quit'); }
}
export const score = l => l.mate != null ? (l.mate > 0 ? 100000 - l.mate * 100 : -100000 - l.mate * 100) : l.cp;
