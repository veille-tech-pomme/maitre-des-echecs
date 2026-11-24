// Données synthétiques (brief P0 §0.4 : pas encore de vrais joueurs) : parties plausibles contre des bots,
// pour tester plafonds, compactage et futures analyses. Déterministe (graine).
import { ulid } from './ulid';
import { SCHEMA_V, type Ev } from './events';
function rng(seed: number) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export function syntheticGames(n: number, opts: { startT: number; dev?: string; seed?: number; moves?: number } = { startT: Date.now() }): Ev[] {
  const r = rng(opts.seed ?? 42); const out: Ev[] = []; const dev = opts.dev ?? 'SYNTH'; let t = opts.startT;
  const mk = (type: Ev['type'], data: Record<string, unknown>, sid: string): Ev => ({ id: ulid(t), dev, sid, t, type, v: SCHEMA_V, data });
  for (let g = 0; g < n; g++) {
    const gid = 'syn' + g.toString(36); const sid = ulid(t); const plies = 2 * (opts.moves ?? 20 + Math.floor(r() * 40));
    out.push(mk('game_start', { gid, bot: 'bot' + (g % 12), botElo: 400 + (g % 12) * 200, color: g % 2 ? 'b' : 'w', tc: g % 3 ? null : { base: 180, inc: 2 }, coach: true, synthetic: true }, sid));
    for (let p = 0; p < plies; p++) {
      const me = (p % 2 === 0) === (g % 2 === 0); const think = me ? Math.round(800 + r() * r() * 30000) : Math.round(300 + r() * 900);
      t += think;
      out.push(mk('move', { gid, ply: p, uci: 'e2e4', side: me ? 'me' : 'bot', thinkMs: think, lifts: me && r() < 0.2 ? ['g1'] : [], input: r() < 0.5 ? 'drag' : 'click', hintLevel: 0 }, sid));
    }
    out.push(mk('game_end', { gid, result: r() < 0.5 ? '1-0' : '0-1', how: 'mate', plies }, sid));
    t += 60000;
  }
  return out;
}
