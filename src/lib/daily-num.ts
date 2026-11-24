// Numérotation du Coup du jour (module minuscule, importé par les écrans toujours chargés).
/** n°1 = mardi 24 novembre 2026 (jour local) */
export const DAILY_EPOCH = '2026-11-24';
const DAY = 86_400_000;
export const utc = (d: string) => { const [y, m, j] = d.split('-').map(Number); return Date.UTC(y, m - 1, j); };
/** jour local AAAA-MM-JJ (pas toISOString, qui est en UTC) */
export function localDay(t = Date.now()) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function numberOf(date: string) { return Math.round((utc(date) - utc(DAILY_EPOCH)) / DAY) + 1; }
export function dateOf(n: number) { const d = new Date(utc(DAILY_EPOCH) + (n - 1) * DAY); return d.toISOString().slice(0, 10); }
export const todayNumber = (t = Date.now()) => numberOf(localDay(t));
