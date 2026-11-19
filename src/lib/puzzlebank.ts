// Grande banque de puzzles (Lichess, CC0) : packs compressés par tranche Elo, chargés à la demande,
// décompressés (DecompressionStream ou fflate) et mis en cache dans IndexedDB pour le hors-ligne.
import type { Puzzle } from './puzzles';
import { loadPuzzles } from './puzzles';

export type Tier = 'core' | 'plus';
export interface PackIndex { version: number; themes: string[]; openings: string[]; tiers: Record<string, { count: number; bands: Record<string, { n: number; size: number; t: Record<string, number>; o: Record<string, number> }> }> }
export interface BankPuzzle extends Puzzle { o?: string }

let indexP: Promise<PackIndex> | null = null;
export const loadIndex = () => (indexP ||= import('../data/packs-index.json').then((m: any) => (m.default || m) as PackIndex));

// ---------- IndexedDB minimal ----------
const DB = 'echecs-packs';
function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('chunks'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); }
  });
}
async function idbGet(k: string): Promise<string | undefined> {
  const db = await idb(); if (!db) return undefined;
  return new Promise((res) => { const t = db.transaction('chunks').objectStore('chunks').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(undefined); });
}
async function idbSet(k: string, v: string) {
  const db = await idb(); if (!db) return;
  await new Promise<void>((res) => { const tx = db.transaction('chunks', 'readwrite'); tx.objectStore('chunks').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); });
}
async function idbKeys(): Promise<string[]> {
  const db = await idb(); if (!db) return [];
  return new Promise((res) => { const t = db.transaction('chunks').objectStore('chunks').getAllKeys(); t.onsuccess = () => res(t.result as string[]); t.onerror = () => res([]); });
}

async function gunzip(buf: ArrayBuffer): Promise<string> {
  if (typeof (globalThis as any).DecompressionStream === 'function') {
    try { const s = new Blob([buf]).stream().pipeThrough(new (globalThis as any).DecompressionStream('gzip')); return await new Response(s).text(); } catch { /* repli */ }
  }
  const { gunzipSync, strFromU8 } = await import('fflate');
  return strFromU8(gunzipSync(new Uint8Array(buf)));
}

const mem = new Map<string, BankPuzzle[]>();
const pending = new Map<string, Promise<BankPuzzle[]>>();
export function parsePack(txt: string, idx: PackIndex): BankPuzzle[] {
  const out: BankPuzzle[] = [];
  for (const line of txt.split('\n')) {
    if (!line) continue;
    const [i, f, m, r, t, o] = line.split('|');
    out.push({ i, f: f + ' 0 1', m, r: +r, t: t ? t.split('.').map((x) => idx.themes[parseInt(x, 36)]) : [], o: idx.openings[parseInt(o, 36) - 1] });
  }
  return out;
}
export async function loadBand(tier: Tier, band: number): Promise<BankPuzzle[]> {
  const key = `${tier}/b${band}`;
  if (mem.has(key)) return mem.get(key)!;
  if (pending.has(key)) return pending.get(key)!;
  const p = (async () => {
    const idx = await loadIndex();
    if (!idx.tiers[tier]?.bands[band]) return [];
    let txt = await idbGet(key);
    if (!txt) {
      const res = await fetch(new URL(`packs/${tier}/b${band}.gz`, document.baseURI).href);
      if (!res.ok) throw new Error('pack ' + key + ' indisponible');
      txt = await gunzip(await res.arrayBuffer());
      idbSet(key, txt);
    }
    const list = parsePack(txt, idx); mem.set(key, list); return list;
  })();
  pending.set(key, p);
  try { return await p; } finally { pending.delete(key); }
}

// ---------- Pack « plus » (téléchargement optionnel) ----------
const PLUS_KEY = 'echecs-pack-plus';
export const plusEnabled = () => localStorage.getItem(PLUS_KEY) === '1';
export async function downloadTier(tier: Tier, onProgress?: (done: number, total: number) => void) {
  const idx = await loadIndex(); const bands = Object.keys(idx.tiers[tier]?.bands || {}).map(Number);
  let k = 0;
  for (const b of bands) { await loadBand(tier, b); onProgress?.(++k, bands.length); }
  if (tier === 'plus') localStorage.setItem(PLUS_KEY, '1');
}
export async function offlineStatus() {
  const idx = await loadIndex(); const keys = new Set(await idbKeys());
  const st = (tier: Tier) => { const bands = Object.keys(idx.tiers[tier]?.bands || {}); return { have: bands.filter((b) => keys.has(`${tier}/b${b}`)).length, total: bands.length, count: idx.tiers[tier]?.count || 0, bytes: bands.reduce((a, b) => a + idx.tiers[tier].bands[b].size, 0) }; };
  return { core: st('core'), plus: st('plus') };
}
export async function totalCount() {
  const idx = await loadIndex(); const base = (await loadPuzzles()).length;
  return { base, core: idx.tiers.core?.count || 0, plus: idx.tiers.plus?.count || 0, available: base + (idx.tiers.core?.count || 0) + (plusEnabled() ? idx.tiers.plus?.count || 0 : 0) };
}

// ---------- Sélection ----------
export interface PickOpts { rating: number; theme?: string; opening?: string; min?: number; max?: number; seen?: string[] }
const bandOf = (r: number) => Math.max(4, Math.min(29, Math.floor(r / 100)));
export async function pickPuzzle(o: PickOpts): Promise<BankPuzzle | null> {
  const idx = await loadIndex();
  const tiers: Tier[] = plusEnabled() ? ['core', 'plus'] : ['core'];
  const lo = o.min ?? o.rating - 150, hi = o.max ?? o.rating + 150;
  const ti = o.theme ? idx.themes.indexOf(o.theme) : -1, oi = o.opening ? idx.openings.indexOf(o.opening) + 1 : 0;
  const has = (tier: Tier, b: number) => { const B = idx.tiers[tier]?.bands[b]; if (!B) return 0; if (ti >= 0) return B.t[ti] || 0; if (oi) return B.o[oi] || 0; return B.n; };
  // tranches dans l'intervalle, puis élargissement progressif vers la cible
  let bands: number[] = []; for (let b = bandOf(lo); b <= bandOf(hi); b++) bands.push(b);
  const target = bandOf(o.rating);
  const all = Array.from({ length: 26 }, (_, k) => k + 4).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  if (!bands.some((b) => tiers.some((t) => has(t, b) > 0))) bands = all.filter((b) => tiers.some((t) => has(t, b) > 0)).slice(0, 2);
  const seen = new Set((o.seen || []).slice(-1500));
  const pool: BankPuzzle[] = [];
  for (const b of bands) for (const t of tiers) if (has(t, b)) {
    try { for (const p of await loadBand(t, b)) if (p.r >= lo - 300 && p.r <= hi + 300 && (ti < 0 || p.t.includes(o.theme!)) && (!oi || p.o === o.opening) && !seen.has(p.i)) pool.push(p); } catch { /* hors-ligne : on se contente de ce qui est en cache */ }
  }
  if (!pool.length) { const base = (await loadPuzzles()) as BankPuzzle[]; const c = base.filter((p) => (!o.theme || p.t.includes(o.theme)) && !seen.has(p.i)); if (!c.length) return null; pool.push(...c); }
  const inRange = pool.filter((p) => p.r >= lo && p.r <= hi); const arr = inRange.length ? inRange : pool.sort((a, b) => Math.abs(a.r - o.rating) - Math.abs(b.r - o.rating)).slice(0, 50);
  const p = arr[Math.floor(Math.random() * arr.length)]; remember(p); return p;
}
/** Suite de puzzles de difficulté croissante (contre-la-montre, duel). */
export async function sequence(n: number, start = 500, step = 45, maxMoves = 6): Promise<BankPuzzle[]> {
  const out: BankPuzzle[] = []; const used: string[] = [];
  const bands = new Set<number>(); for (let k = 0; k < n; k++) bands.add(bandOf(start + k * step));
  const lists = await Promise.all([...bands].map((b) => loadBand('core', b).catch(() => [] as BankPuzzle[])));
  const pool = lists.flat().filter((p) => p.m.split(' ').length <= maxMoves);
  if (!pool.length) return [];
  for (let k = 0; k < n; k++) {
    const target = start + k * step; const c = pool.filter((p) => Math.abs(p.r - target) < 60 && !used.includes(p.i));
    const p = c.length ? c[Math.floor(Math.random() * c.length)] : pool[Math.floor(Math.random() * pool.length)];
    used.push(p.i); out.push(p);
  }
  return out;
}
// ---------- Mémoire des puzzles rencontrés (révisions espacées) ----------
const REG = 'echecs-puzzles-vus';
let reg: Record<string, BankPuzzle> | null = null;
const regLoad = () => (reg ||= (() => { try { return JSON.parse(localStorage.getItem(REG) || '{}'); } catch { return {}; } })());
export function remember(p: BankPuzzle) {
  const r = regLoad(); r[p.i] = { i: p.i, f: p.f, m: p.m, r: p.r, t: p.t };
  const ks = Object.keys(r); if (ks.length > 3000) for (const k of ks.slice(0, ks.length - 3000)) delete r[k];
  try { localStorage.setItem(REG, JSON.stringify(r)); } catch { /* quota */ }
}
export async function findPuzzle(id: string): Promise<BankPuzzle | null> {
  const r = regLoad(); if (r[id]) return r[id];
  const base = await loadPuzzles(); return (base.find((p) => p.i === id) as BankPuzzle) || null;
}
/** Puzzles d'un thème pour une leçon (complète la base intégrée avec les packs, ordre stable par leçon). */
export async function themedForLesson(key: string, themes: string[], count: number, min: number, max: number): Promise<BankPuzzle[]> {
  const idx = await loadIndex(); const tis = themes.map((t) => idx.themes.indexOf(t)).filter((x) => x >= 0);
  const bands: number[] = []; for (let b = bandOf(min); b <= bandOf(max); b++) if (tis.some((ti) => idx.tiers.core?.bands[b]?.t[ti])) bands.push(b);
  // on charge au plus 3 tranches (les plus fournies) pour rester léger
  bands.sort((a, b) => tis.reduce((s, ti) => s + (idx.tiers.core.bands[b].t[ti] || 0), 0) < tis.reduce((s, ti) => s + (idx.tiers.core.bands[a].t[ti] || 0), 0) ? -1 : 1);
  const pool: BankPuzzle[] = [];
  for (const b of bands.slice(0, 3)) { try { for (const p of await loadBand('core', b)) if (p.r >= min && p.r <= max && themes.some((t) => p.t.includes(t))) pool.push(p); } catch { /* hors-ligne */ } }
  const h = (s: string) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  return pool.sort((a, b) => h(key + a.i) - h(key + b.i)).slice(0, count).sort((a, b) => a.r - b.r);
}
