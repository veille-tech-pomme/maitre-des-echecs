// Coup du jour (R4b, plan §2.2) : calendrier FIGÉ public/daily/<année>.json (tools/build-daily.mts).
// Le même numéro donne la même position pour tout le monde, quelle que soit la version de l'app.
// Grille partageable sans spoiler : une case par coup du joueur (🟩 juste du premier coup, 🟨 juste après une
// erreur ou un indice, 🟥 montré). Aucune donnée ne quitte l'appareil : le partage passe par la feuille native.
export interface DailyEntry { n: number; date: string; puzzleId: string; fen: string; moves: string; rating: number; theme: string }
export { DAILY_EPOCH, localDay, numberOf, dateOf, todayNumber } from './daily-num';
import { utc, dateOf } from './daily-num';
export const DAILY_YEARS = [2026, 2027, 2028];
export const SHARE_URL = 'https://veille-tech-pomme.github.io/maitre-des-echecs/';
/** difficulté qui monte dans la semaine (lundi ≈ 1000 → dimanche ≈ 1900) */
export function weekdayTarget(date: string) { const wd = (new Date(utc(date)).getUTCDay() + 6) % 7; return 1000 + wd * 150; }
export function stars(rating: number) { return rating < 1100 ? 1 : rating < 1300 ? 2 : rating < 1500 ? 3 : rating < 1700 ? 4 : 5; }
export const starStr = (r: number) => '★'.repeat(stars(r)) + '☆'.repeat(5 - stars(r));
const MATE: Record<string, number> = { mateIn1: 1, mateIn2: 2, mateIn3: 3, mateIn4: 4, mateIn5: 5 };
/** consigne affichée avant de jouer (le type de but, jamais le coup) */
export function goalText(e: Pick<DailyEntry, 'fen' | 'theme'>) {
  const side = e.fen.split(' ')[1] === 'w' ? 'Les Noirs' : 'Les Blancs'; // le 1er coup de la ligne est celui de l'adversaire
  const m = MATE[e.theme]; return m ? `${side} jouent et font mat en ${m}` : `${side} jouent et gagnent`;
}
export type Cell = 'g' | 'y' | 'r';
export const CELL_EMOJI: Record<Cell, string> = { g: '🟩', y: '🟨', r: '🟥' };
export function fmtTime(ms: number) { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export interface DailyResult { n: number; grid: string; ms: number; hints: number; ok: boolean; at: number }
/** texte partagé : numéro, étoiles, grille, temps, indices, série. Aucun coup, aucune case. */
export function shareText(e: Pick<DailyEntry, 'n' | 'rating'>, r: Pick<DailyResult, 'grid' | 'ms' | 'hints'>, streak = 0) {
  const grid = [...r.grid].map((c) => CELL_EMOJI[c as Cell] || '').join('');
  return [`♟ Coup du jour #${e.n} · ${starStr(e.rating)}`, `${grid}  ⏱ ${fmtTime(r.ms)}  💡${r.hints}`, streak > 1 ? `🔥 Série ${streak} · Maître des Échecs` : 'Maître des Échecs', `${SHARE_URL}#/jour/${e.n}`].join('\n');
}
/** coups du joueur dans la ligne (le 1er coup est celui de l'adversaire) */
export const playerMoves = (moves: string) => Math.floor(moves.split(' ').length / 2);
const cache = new Map<number, Promise<DailyEntry[]>>();
export function loadYear(y: number, base = typeof document !== 'undefined' ? document.baseURI : SHARE_URL): Promise<DailyEntry[]> {
  if (!cache.has(y)) cache.set(y, fetch(new URL(`daily/${y}.json`, base).href).then((r) => { if (!r.ok) throw new Error('daily ' + r.status); return r.json(); }).catch((e) => { cache.delete(y); throw e; }));
  return cache.get(y)!;
}
export async function entry(n: number): Promise<DailyEntry | null> {
  if (n < 1) return null; const d = dateOf(n); const list = await loadYear(+d.slice(0, 4));
  return list.find((x) => x.n === n) || null;
}
/** grille finale : une case par coup du joueur ; marks[k] = pire évènement sur le coup k (y : erreur/indice, r : montré) */
export function gridFrom(nPlayer: number, marks: Record<number, Cell>): string {
  let g = ''; for (let k = 0; k < nPlayer; k++) g += marks[k] || 'g'; return g;
}
/** indice de ligne (coups UCI, le 0 est celui de l'adversaire) → n° du coup du joueur */
export const playerIdx = (lineIdx: number) => Math.max(0, Math.floor((lineIdx - 1) / 2));
/** le joueur a « réussi » s'il n'a eu besoin d'aucun coup montré */
export const gridOk = (g: string) => !g.includes('r');
