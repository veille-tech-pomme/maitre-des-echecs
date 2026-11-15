// Base de parties de maîtres (Lichess Broadcast, CC0) : statistiques par position, chargées à la demande
// par petits fragments gzip (~8 Ko), décompressées puis mises en cache dans IndexedDB (hors-ligne).
import { posId } from './explorer-key';

export interface ExplorerMeta { version: number; games: number; positions: number; depth: number; maxPly: number; minN: number; minElo: number; notable: number; shards: number; gameShards: number; sizePositions: number; sizeGames: number; maxShard: number; from: string; to: string; source: string }
export interface MoveStat { san: string; n: number; w: number; d: number; b: number; elo: number }
export interface PosStat { n: number; w: number; d: number; b: number; elo: number; moves: MoveStat[]; games: number[] }
export interface MasterGame { id: number; white: string; black: string; we: number; be: number; result: '1' | '0' | '½'; date: string; event: string; url: string; moves: string[] }

let metaP: Promise<ExplorerMeta> | null = null;
export const loadMeta = () => (metaP ||= import('../data/explorer-meta.json').then((m: any) => (m.default || m) as ExplorerMeta));

// ---------- IndexedDB ----------
const DB = 'echecs-explorer';
let dbP: Promise<IDBDatabase | null> | null = null;
function idb(): Promise<IDBDatabase | null> {
  return (dbP ||= new Promise((res) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('chunks'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); }
  }));
}
async function idbGet(k: string): Promise<string | undefined> {
  const db = await idb(); if (!db) return undefined;
  return new Promise((res) => { try { const t = db.transaction('chunks').objectStore('chunks').get(k); t.onsuccess = () => res(t.result); t.onerror = () => res(undefined); } catch { res(undefined); } });
}
function idbSet(k: string, v: string) {
  idb().then((db) => { if (!db) return; try { db.transaction('chunks', 'readwrite').objectStore('chunks').put(v, k); } catch { /* quota */ } });
}
export async function gunzipText(buf: ArrayBuffer): Promise<string> {
  const u = new Uint8Array(buf);
  if (!(u[0] === 0x1f && u[1] === 0x8b)) return new TextDecoder().decode(u); // déjà décompressé par le serveur
  if (typeof (globalThis as any).DecompressionStream === 'function') {
    try { const s = new Blob([buf]).stream().pipeThrough(new (globalThis as any).DecompressionStream('gzip')); return await new Response(s).text(); } catch { /* repli */ }
  }
  const { gunzipSync, strFromU8 } = await import('fflate');
  return strFromU8(gunzipSync(u));
}

// ---------- Fragments ----------
const mem = new Map<string, Promise<Map<string, string>>>();
export let fetcher: (path: string) => Promise<ArrayBuffer> = async (path) => {
  const r = await fetch(new URL(path, document.baseURI).href); if (!r.ok) throw new Error(path + ' indisponible'); return r.arrayBuffer();
};
export function setFetcher(f: typeof fetcher) { fetcher = f; mem.clear(); }
function chunk(kind: 'p' | 'g', i: number): Promise<Map<string, string>> {
  const k = `${kind}/${i}`;
  let p = mem.get(k);
  if (!p) {
    p = (async () => {
      const meta = await loadMeta(); const ck = `${meta.version}/${k}`;
      let txt = await idbGet(ck);
      if (txt == null) { txt = await gunzipText(await fetcher(`explorer/${k}.gz`)); idbSet(ck, txt); }
      const m = new Map<string, string>();
      for (const line of txt.split('\n')) { const j = line.indexOf('|'); if (j > 0) m.set(line.slice(0, j), line.slice(j + 1)); }
      return m;
    })();
    mem.set(k, p); p.catch(() => mem.delete(k));
  }
  return p;
}
const i36 = (s: string) => parseInt(s, 36) || 0;
export function parseEntry(v: string): PosStat {
  const [n, w, d, elo, mv, gs] = v.split('|');
  const N = i36(n), W = i36(w), D = i36(d);
  const moves = mv ? mv.split(',').map((x) => { const [san, a, b, c, e] = x.split(':'); const mn = i36(a), mw = i36(b), md = i36(c); return { san, n: mn, w: mw, d: md, b: mn - mw - md, elo: i36(e) }; }) : [];
  return { n: N, w: W, d: D, b: N - W - D, elo: i36(elo), moves, games: gs ? gs.split('.').map(i36) : [] };
}
/** Statistiques de la position (null si moins de minN parties ou au-delà de la profondeur couverte). */
export async function positionStats(fen: string): Promise<PosStat | null> {
  const { id, shard } = posId(fen);
  const v = (await chunk('p', shard)).get(id);
  return v ? parseEntry(v) : null;
}
/** Précharge les fragments des positions suivantes (navigation instantanée). */
export function prefetch(fens: string[]) { for (const f of fens) chunk('p', posId(f).shard).catch(() => {}); }
export async function masterGame(id: number): Promise<MasterGame | null> {
  const meta = await loadMeta();
  const v = (await chunk('g', id % meta.gameShards)).get(id.toString(36));
  if (!v) return null;
  const [white, black, we, be, result, date, event, url, moves] = v.split('|');
  return { id, white, black, we: +we, be: +be, result: result as MasterGame['result'], date, event, url: url ? 'https://lichess.org/broadcast/' + url : '', moves: moves.split(' ') };
}
export const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);
