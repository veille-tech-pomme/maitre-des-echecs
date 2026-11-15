// Pilote Stockfish (WASM mono-thread, compatible iOS Safari sans SharedArrayBuffer) dans un Web Worker.
export interface PvLine { move: string; pv: string[]; cp: number | null; mate: number | null; depth: number; multipv: number }
export interface AnalyseResult { best: string; lines: PvLine[]; depth: number }
export interface AnalyseOpts {
  depth?: number; movetime?: number; multipv?: number; nodes?: number;
  elo?: number; skill?: number; searchmoves?: string[];
  onInfo?: (lines: PvLine[]) => void;
}
interface Job { fen: string; opts: AnalyseOpts; resolve: (r: AnalyseResult) => void; reject: (e: any) => void; cancelled?: boolean }

class Engine {
  private w: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private cur: Job | null = null;
  private lines: Record<number, PvLine> = {};
  private maxDepth = 0;
  private readyResolve: (() => void) | null = null;
  private lastOpts = '';
  failed = false;

  private start() {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((res, rej) => {
      try {
        const url = new URL('engine/stockfish-18-lite-single.js', document.baseURI).href;
        this.w = new Worker(url);
      } catch (e) { this.failed = true; rej(e); return; }
      this.readyResolve = res;
      this.w.onmessage = (e) => this.onLine(String(e.data));
      this.w.onerror = (e) => { this.failed = true; console.warn('Stockfish error', e); rej(e); };
      this.send('uci');
    });
    return this.ready;
  }
  private send(s: string) { this.w?.postMessage(s); }
  private onLine(line: string) {
    if (line === 'uciok') { this.send('setoption name Hash value 32'); this.send('isready'); return; }
    if (line === 'readyok') { if (this.readyResolve) { this.readyResolve(); this.readyResolve = null; } return; }
    if (!this.cur) return;
    if (line.startsWith('info') && line.includes(' pv ')) {
      const g = (k: string) => { const m = line.match(new RegExp(' ' + k + ' (\\S+)')); return m ? m[1] : null; };
      const depth = +(g('depth') || 0); const mpv = +(g('multipv') || 1);
      const sm = line.match(/score (cp|mate) (-?\d+)/); if (!sm) return;
      if (line.includes('lowerbound') || line.includes('upperbound')) return;
      const pv = line.split(' pv ')[1].trim().split(' ');
      this.lines[mpv] = { move: pv[0], pv, cp: sm[1] === 'cp' ? +sm[2] : null, mate: sm[1] === 'mate' ? +sm[2] : null, depth, multipv: mpv };
      this.maxDepth = Math.max(this.maxDepth, depth);
      if (mpv === 1 || Object.keys(this.lines).length > 1) this.cur.opts.onInfo?.(this.sortedLines());
    } else if (line.startsWith('bestmove')) {
      const job = this.cur; this.cur = null;
      const best = line.split(' ')[1];
      const res = { best, lines: this.sortedLines(), depth: this.maxDepth };
      if (!res.lines.length && best && best !== '(none)') res.lines.push({ move: best, pv: [best], cp: 0, mate: null, depth: 0, multipv: 1 });
      job.resolve(res);
      this.next();
    }
  }
  private sortedLines() { return Object.values(this.lines).sort((a, b) => a.multipv - b.multipv); }
  private next() {
    if (this.cur) return;
    let job = this.queue.shift();
    while (job && job.cancelled) { job.resolve({ best: '', lines: [], depth: 0 }); job = this.queue.shift(); }
    if (!job) return;
    this.cur = job; this.lines = {}; this.maxDepth = 0;
    const o = job.opts;
    const optKey = `${o.multipv || 1}|${o.elo || 0}|${o.skill ?? 20}`;
    if (optKey !== this.lastOpts) {
      this.send(`setoption name MultiPV value ${o.multipv || 1}`);
      if (o.elo) { this.send('setoption name UCI_LimitStrength value true'); this.send(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, o.elo))}`); }
      else this.send('setoption name UCI_LimitStrength value false');
      this.send(`setoption name Skill Level value ${o.skill ?? 20}`);
      this.lastOpts = optKey;
    }
    this.send(`position fen ${job.fen}`);
    let go = 'go';
    if (o.depth) go += ` depth ${o.depth}`;
    if (o.movetime) go += ` movetime ${o.movetime}`;
    if (o.nodes) go += ` nodes ${o.nodes}`;
    if (!o.depth && !o.movetime && !o.nodes) go += ' depth 14';
    if (o.searchmoves?.length) go += ' searchmoves ' + o.searchmoves.join(' ');
    this.send(go);
  }
  async analyse(fen: string, opts: AnalyseOpts = {}): Promise<AnalyseResult> {
    await this.start();
    return new Promise((resolve, reject) => { this.queue.push({ fen, opts, resolve, reject }); this.next(); });
  }
  /** Annule toutes les recherches en attente et arrête la recherche en cours. */
  stopAll() {
    for (const j of this.queue) j.cancelled = true;
    if (this.cur) this.send('stop');
  }
  newGame() { this.send('ucinewgame'); }
  warmup() { this.start().catch(() => {}); }
}
export const engine = new Engine();

/** Score « du point de vue des Blancs » en centipions (mat = ±10000). */
export function whiteScore(line: PvLine | undefined, fen: string): number {
  if (!line) return 0;
  const stm = fen.split(' ')[1] === 'w' ? 1 : -1;
  const s = line.mate != null ? (line.mate > 0 ? 10000 - line.mate * 10 : line.mate < 0 ? -10000 - line.mate * 10 : -10000) : (line.cp || 0);
  return s * stm;
}
export function formatScore(cpWhite: number, mateWhite?: number | null): string {
  if (mateWhite != null) return (mateWhite > 0 ? '#' : '#-') + Math.abs(mateWhite);
  if (Math.abs(cpWhite) >= 9000) return cpWhite > 0 ? '#' + Math.max(1, Math.round((10000 - cpWhite) / 10)) : '#-' + Math.max(1, Math.round((10000 + cpWhite) / 10));
  const v = cpWhite / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',');
}
/** Probabilité de gain (0-100) à partir des centipions (formule Lichess). */
export function winPct(cp: number): number {
  if (cp >= 9000) return 100; if (cp <= -9000) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
