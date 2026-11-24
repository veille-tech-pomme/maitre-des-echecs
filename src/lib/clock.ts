// Pendule d'échecs, logique pure (brief P0 §4). Temps en ms, horloge injectée (`now`) : testable sans attendre.
// Une seule pendule tourne à la fois ; pause / reprise (onglet caché, analyse du coach, pause « gaffe », écran de fin) ;
// incrément ajouté à chaque coup joué ; snapshot / restore pour la reprise de coup.
export type Side = 'w' | 'b';
export interface ClockSnap { rem: Record<Side, number>; running: Side | null; paused: boolean }
export interface Clock {
  readonly base: number; readonly inc: number;
  start(side: Side, now: number): void;
  /** le camp `side` vient de jouer : son temps est arrêté, l'incrément ajouté, l'autre camp démarre */
  press(side: Side, now: number): void;
  pause(now: number): void; resume(now: number): void;
  remaining(side: Side, now: number): number;
  /** camp dont le drapeau est tombé (temps ≤ 0), sinon null */
  flagged(now: number): Side | null;
  running(): Side | null; isPaused(): boolean;
  snapshot(now: number): ClockSnap; restore(s: ClockSnap, now: number): void;
}
export function createClock({ base, inc }: { base: number; inc: number }): Clock {
  const rem: Record<Side, number> = { w: base, b: base };
  let run: Side | null = null, since = 0, paused = false;
  const settle = (now: number) => { if (run && !paused) { rem[run] -= now - since; since = now; } };
  const c: Clock = {
    base, inc,
    start(side, now) { settle(now); run = side; since = now; paused = false; },
    press(side, now) { settle(now); if (rem[side] > 0) rem[side] += inc; run = side === 'w' ? 'b' : 'w'; since = now; },
    pause(now) { if (paused) return; settle(now); paused = true; },
    resume(now) { if (!paused) return; paused = false; since = now; },
    remaining(side, now) { return run === side && !paused ? rem[side] - (now - since) : rem[side]; },
    flagged(now) { for (const s of ['w', 'b'] as Side[]) if (c.remaining(s, now) <= 0) return s; return null; },
    running: () => run, isPaused: () => paused,
    snapshot(now) { settle(now); return { rem: { ...rem }, running: run, paused }; },
    restore(s, now) { rem.w = s.rem.w; rem.b = s.rem.b; run = s.running; paused = s.paused; since = now; },
  };
  return c;
}
/** h:mm:ss pour les commentaires PGN [%clk] (format Lichess) */
export function clkTag(ms: number): string { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
/** Le camp `side` peut-il encore mater ? Approximation P0 (FIDE) : roi seul, roi + fou, roi + cavalier → non. */
export function canMatePieces(pieces: string[]): boolean { const p = pieces.filter((x) => x !== 'k'); return !(p.length === 0 || (p.length === 1 && (p[0] === 'b' || p[0] === 'n'))); }
/** PGN avec en-tête TimeControl et [%clk] après chaque coup (temps restant APRÈS le coup, incrément compris). */
export function pgnWithClock(sans: string[], clocks: number[], headers: Record<string, string>, tc: { base: number; inc: number } | null): string {
  const h = { ...headers }; if (tc) h.TimeControl = `${Math.round(tc.base / 1000)}+${Math.round(tc.inc / 1000)}`;
  const head = Object.entries(h).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
  const body: string[] = [];
  sans.forEach((s, i) => { if (i % 2 === 0) body.push(`${i / 2 + 1}.`); body.push(s); if (tc && clocks[i] != null) body.push(`{ [%clk ${clkTag(clocks[i])}] }`); });
  return `${head}\n\n${body.join(' ')} ${h.Result || '*'}\n`;
}
