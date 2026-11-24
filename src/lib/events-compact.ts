// Compactage du journal (brief P0 §7), chargé seulement quand un plafond est dépassé :
// les `move`, `visibility` et `lesson_step` de plus de 180 jours sont supprimés, après un `game_summary` par partie.
// Les évènements `consent` ne sont JAMAIS supprimés.
import type { Ev } from './events';
export const COMPACT_AGE_MS = 180 * 86400e3;
const COMPACTABLE = new Set(['move', 'visibility', 'lesson_step']);
const q = (a: number[], p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : 0);
export function compact(ev: Ev[], now = Date.now()) {
  const cut = now - COMPACT_AGE_MS;
  const old = ev.filter((e) => e.t < cut && COMPACTABLE.has(e.type) && e.type !== ('consent' as any));
  const byGame = new Map<string, Ev[]>();
  for (const e of old) if (e.type === 'move') { const g = String((e.data as any).gid || ''); if (!byGame.has(g)) byGame.set(g, []); byGame.get(g)!.push(e); }
  const have = new Set(ev.filter((e) => e.type === 'game_summary').map((e) => (e.data as any).gid));
  const add: { t: number; data: Record<string, unknown> }[] = [];
  for (const [gid, ms] of byGame) {
    if (have.has(gid)) continue;
    const th = ms.filter((m) => (m.data as any).side === 'me').map((m) => Number((m.data as any).thinkMs) || 0).sort((a, b) => a - b);
    add.push({ t: ms[ms.length - 1].t, data: { gid, n: ms.length, meanThinkMs: th.length ? Math.round(th.reduce((a, b) => a + b, 0) / th.length) : 0, p50: q(th, 0.5), p90: q(th, 0.9), fastMovesPct: th.length ? Math.round((100 * th.filter((x) => x < 3000).length) / th.length) : 0 } });
  }
  return { add, remove: old.map((e) => e.id) };
}
