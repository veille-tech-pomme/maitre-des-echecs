// Banque de puzzles (Lichess, domaine public CC0), chargée à la demande.
import { today } from './store';
export interface Puzzle { i: string; f: string; m: string; r: number; t: string[] }
let cache: Puzzle[] | null = null;
export async function loadPuzzles(): Promise<Puzzle[]> {
  if (cache) return cache;
  const mod: any = await import('../data/puzzles.json');
  cache = (mod.default || mod) as Puzzle[];
  return cache;
}
export const puzzlesSync = () => cache;
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function pickRated(all: Puzzle[], rating: number, seen: string[], theme?: string): Puzzle {
  const seenSet = new Set(seen.slice(-800));
  let pool = all.filter((p) => !seenSet.has(p.i) && (!theme || p.t.includes(theme)));
  if (!pool.length) pool = all.filter((p) => !theme || p.t.includes(theme));
  for (const w of [100, 200, 350, 600, 3000]) {
    const c = pool.filter((p) => Math.abs(p.r - rating) <= w);
    if (c.length >= 3 || w === 3000) { const arr = c.length ? c : pool; return arr[Math.floor(Math.random() * arr.length)]; }
  }
  return pool[0];
}
export function dailyPuzzle(all: Puzzle[], d = today()): Puzzle {
  const pool = all.filter((p) => p.r >= 1300 && p.r <= 1900 && p.t.length >= 2);
  return pool[hash('daily-' + d) % pool.length];
}
/** Suite de puzzles de difficulté croissante pour la course contre la montre. */
export function rushSequence(all: Puzzle[], n = 60): Puzzle[] {
  const out: Puzzle[] = []; const used = new Set<string>();
  for (let k = 0; k < n; k++) {
    const target = 500 + k * 45;
    const c = all.filter((p) => Math.abs(p.r - target) < 80 && !used.has(p.i) && p.m.split(' ').length <= 6);
    const p = c.length ? c[Math.floor(Math.random() * c.length)] : all[Math.floor(Math.random() * all.length)];
    used.add(p.i); out.push(p);
  }
  return out;
}
export function lessonPuzzles(all: Puzzle[], key: string, themes: string[], count: number, maxR: number, minR = 0): Puzzle[] {
  const pool = all.filter((p) => p.r <= maxR && p.r >= minR && themes.some((t) => p.t.includes(t))).sort((a, b) => (hash(key + a.i) - hash(key + b.i)));
  return pool.slice(0, count).sort((a, b) => a.r - b.r);
}
export const byId = (all: Puzzle[], id: string) => all.find((p) => p.i === id);
