// Journal d'évènements local, append-only : UN SEUL journal pour les mesures de rétention (plan GOAT §2.13, §6)
// et la modélisation des joueurs (brief P0 §2). Forme commune, prête pour une synchro future :
//   { id: ULID, dev: identifiant d'installation, sid: session, t, type, v, data }
// Niveaux : 'base' (toujours écrit, équivaut à ce que l'état garde déjà) et 'detail' (seulement avec consent.detail).
// Le filtrage se fait DANS log() : sans consentement, un évènement détaillé n'est jamais écrit.
// log() est synchrone (file en mémoire) ; écriture groupée toutes les 2 s et quand la page se cache.
// Stockage : IndexedDB « echecs-events » (store « ev ») ; repli en mémoire (navigation privée, quota) sans planter.
// RIEN ne quitte l'appareil : aucun appel réseau ici (vérifié en e2e). Export = fichier local.
import { ulid } from './ulid';
import { getState, lastMigration, today } from './store';

export const SCHEMA_V = 1;
/** compat : ancien nom */
export const EVENT_V = SCHEMA_V;
export type Tier = 'base' | 'detail';
export const TIER = {
  // session et usage (GOAT)
  app_open: 'base', session_start: 'base', session_end: 'base', visibility: 'detail', migration: 'base',
  // parties
  game_start: 'base', move: 'detail', takeback: 'detail', game_end: 'base', game_summary: 'base',
  // exercices
  puzzle_try: 'detail', puzzle_rush: 'detail', lesson_step: 'detail', srs_review: 'base',
  // fil
  card_served: 'base', card_result: 'base',
  // consentement (trace de l'accord : toujours écrit, jamais compacté)
  consent: 'base',
  // réservés au plan GOAT (R4b–R4d)
  daily_played: 'base', share: 'base', challenge_sent: 'base', challenge_opened: 'base', streak_saved: 'base', notif_opened: 'base', streak_broken: 'base', streak_milestone: 'base', vacation: 'base',
} as const satisfies Record<string, Tier>;
export type EvType = keyof typeof TIER;
/** compat : ancien nom */
export type EventType = EvType;
export interface Ev<T extends string = EvType, D = Record<string, unknown>> { id: string; dev: string; sid: string; t: number; type: T; v: typeof SCHEMA_V; data: D }
export type AppEvent = Ev;

/** stockage interchangeable : IndexedDB en production, mémoire pour les tests et en repli */
export interface EventStore {
  add(batch: Ev[]): Promise<void>;
  all(): Promise<Ev[]>;
  remove(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}
export function memoryStore(): EventStore & { items: Ev[] } {
  const m = { items: [] as Ev[] };
  return Object.assign(m, {
    async add(b: Ev[]) { const have = new Set(m.items.map((e) => e.id)); for (const e of b) if (!have.has(e.id)) m.items.push(e); },
    async all() { return [...m.items]; },
    async remove(ids: string[]) { const r = new Set(ids); m.items = m.items.filter((e) => !r.has(e.id)); },
    async clear() { m.items = []; },
  });
}
// Stockage compact (R4b, cible P0 ≤ 250 o/coup) : `dev` est le même pour tout le journal de l'appareil ; il n'est pas
// répété dans chaque enregistrement IndexedDB et il est remis à la lecture. La forme exposée (query, export) ne change pas.
const curDev = () => getState().deviceId || '';
export function pack(e: Ev): Ev { if (e.dev && e.dev === curDev()) { const { dev, ...r } = e; return r as Ev; } return e; }
export function unpack(r: Ev): Ev { return r.dev ? r : { ...r, dev: curDev() }; }
/** taille stockée d'un évènement (octets du JSON enregistré) */
export const storedBytes = (e: Ev) => JSON.stringify(pack(e)).length;
function idbStore(db: IDBDatabase): EventStore {
  const tx = (mode: IDBTransactionMode, fn: (os: IDBObjectStore) => void) => new Promise<void>((res, rej) => {
    const t = db.transaction('ev', mode); fn(t.objectStore('ev')); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
  return {
    // append-only : add (jamais put) ; un id déjà présent est ignoré
    add: (b) => tx('readwrite', (os) => { for (const e of b) { const r = os.add(pack(e)); r.onerror = (ev) => { ev.preventDefault(); ev.stopPropagation(); }; } }),
    all: () => new Promise((res, rej) => { const r = db.transaction('ev', 'readonly').objectStore('ev').getAll(); r.onsuccess = () => res((r.result as Ev[]).map(unpack)); r.onerror = () => rej(r.error); }),
    remove: (ids) => tx('readwrite', (os) => { for (const id of ids) os.delete(id); }),
    clear: () => tx('readwrite', (os) => os.clear()),
  };
}
const fallback = memoryStore();
let storeP: Promise<EventStore> | null = null;
/** tests : impose un stockage */
export function setEventStore(s: EventStore | null) { storeP = s ? Promise.resolve(s) : null; }
function store(): Promise<EventStore> {
  return (storeP ||= new Promise<EventStore>((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(fallback);
      const rq = indexedDB.open('echecs-events', 1);
      rq.onupgradeneeded = () => { const os = rq.result.createObjectStore('ev', { keyPath: 'id' }); os.createIndex('t', 't'); os.createIndex('type', 'type'); os.createIndex('gid', 'data.gid'); };
      rq.onsuccess = () => res(idbStore(rq.result));
      rq.onerror = () => res(fallback); rq.onblocked = () => res(fallback);
    } catch { res(fallback); }
  }));
}

// ——— session : nouvelle au lancement, et après 30 min d'inactivité (page cachée)
export const SESSION_GAP_MS = 30 * 60 * 1000;
let sid = ulid(); let lastActive = Date.now();
export const sessionId = () => sid;

let queue: Ev[] = []; let timer: any = null; let writing: Promise<void> = Promise.resolve();
export const FLUSH_MS = 2000;
export const detailAllowed = () => !!getState().consent?.detail;

/** Journalise (synchrone : pousse dans la file). Un évènement « detail » sans consentement est ignoré ici. */
export function log<T extends EvType>(type: T, data: Record<string, unknown> = {}, t = Date.now()): Ev | null {
  if (TIER[type] === 'detail' && !detailAllowed()) return null;
  const e: Ev = { id: ulid(t), dev: getState().deviceId || '', sid, t, type, v: SCHEMA_V, data };
  queue.push(e); lastActive = t;
  if (!timer) timer = setTimeout(() => { timer = null; void flushEvents(); }, FLUSH_MS);
  return e;
}
/** compat : ancien nom */
export const logEvent = log;

/** écrit la file (jamais bloquant pour l'interface : asynchrone ; erreur → repli mémoire) */
export function flushEvents(): Promise<void> {
  clearTimeout(timer); timer = null;
  if (!queue.length) return writing;
  const batch = queue; queue = [];
  writing = writing.then(async () => {
    const s = await store();
    try { await s.add(batch); } catch { storeP = Promise.resolve(fallback); await fallback.add(batch); }
    added += batch.length; if (added >= 500) { added = 0; void maybeCompact(); }
  });
  return writing;
}
let added = 0;

export interface Query { type?: EvType[]; from?: number; to?: number; gid?: string }
export async function query(q: Query = {}): Promise<Ev[]> {
  await flushEvents();
  const s = await store(); let all: Ev[] = [];
  try { all = await s.all(); } catch { all = []; }
  if (s !== fallback) all = all.concat(fallback.items);
  return all.filter((e) => (!q.type || q.type.includes(e.type)) && (q.from == null || e.t >= q.from) && (q.to == null || e.t <= q.to) && (!q.gid || (e.data as any)?.gid === q.gid))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export const allEvents = () => query();
/** JSON Lines (un évènement par ligne) */
export async function exportJsonl(): Promise<string> { return (await query()).map((e) => JSON.stringify(e)).join('\n') + '\n'; }
export async function exportAll(): Promise<Blob> { return new Blob([await exportJsonl()], { type: 'application/x-ndjson' }); }
/** export JSON lisible (écran « Mes mesures ») */
export async function exportEvents(): Promise<string> {
  const ev = await query(); const s = getState();
  return JSON.stringify({ format: 'maitre-des-echecs/events', v: SCHEMA_V, schema: s.v, dev: s.deviceId, exportedAt: new Date().toISOString(), count: ev.length, events: ev }, null, 1);
}
/** efface le journal (l'identifiant d'installation est renouvelé par resetAll côté état) */
export async function eraseAll(): Promise<void> {
  queue = []; clearTimeout(timer); timer = null; await writing;
  await fallback.clear(); const s = await store(); try { await s.clear(); } catch {}
}
export const clearEvents = eraseAll;
/** efface les évènements d'un niveau (retrait du consentement détaillé) ; `consent` n'est jamais concerné (niveau base) */
export async function eraseTier(tier: Tier): Promise<number> {
  const ev = (await query()).filter((e) => TIER[e.type] === tier); const ids = ev.map((e) => e.id);
  const s = await store(); await s.remove(ids); await fallback.remove(ids); return ids.length;
}
export async function stats(): Promise<{ count: number; bytes: number; oldest: number | null; byType: Record<string, number> }> {
  const ev = await query(); const byType: Record<string, number> = {}; let bytes = 0;
  for (const e of ev) { byType[e.type] = (byType[e.type] || 0) + 1; bytes += storedBytes(e); }
  return { count: ev.length, bytes, oldest: ev[0]?.t ?? null, byType };
}

// ——— plafonds (brief P0 §7) : compactage chargé à la demande
export const CAP_EVENTS = 200_000, CAP_BYTES = 40 * 1024 * 1024;
export async function maybeCompact(now = Date.now(), caps = { events: CAP_EVENTS, bytes: CAP_BYTES }) {
  const st = await stats();
  if (st.count <= caps.events && st.bytes <= caps.bytes) return null;
  const { compact } = await import('./events-compact');
  const ev = await query(); const plan = compact(ev, now);
  const s = await store(); await s.add(plan.add.map((d) => ({ id: ulid(d.t), dev: getState().deviceId || '', sid, t: d.t, type: 'game_summary' as const, v: SCHEMA_V, data: d.data })));
  await s.remove(plan.remove); return plan;
}

// ——— suivi d'usage : sessions, visibilité
let visibleSince = 0, started = false;
export function startAppTracking(now = () => Date.now()) {
  if (started || typeof document === 'undefined') return; started = true;
  if (lastMigration) log('migration', { from: lastMigration.from, to: lastMigration.to });
  const route = () => (location.hash || '#/').split('?')[0];
  const begin = (from: string) => {
    visibleSince = now();
    const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
    log('app_open', { day: today(), from, standalone });
    log('session_start', { route: route(), day: today() });
  };
  begin('boot');
  document.addEventListener('visibilitychange', () => {
    const gap = now() - lastActive; // mesuré AVANT d'écrire (log() met lastActive à jour)
    if (!document.hidden && !visibleSince && gap >= SESSION_GAP_MS) sid = ulid();
    log('visibility', { hidden: document.hidden });
    if (document.hidden) {
      if (visibleSince) { log('session_end', { ms: now() - visibleSince }); visibleSince = 0; }
      lastActive = now(); void flushEvents();
    } else if (!visibleSince) {
      if (gap >= SESSION_GAP_MS) begin('resume'); else visibleSince = now();
    }
  });
  addEventListener('pagehide', () => { if (visibleSince) { log('session_end', { ms: now() - visibleSince }); visibleSince = 0; } void flushEvents(); });
}

/** écriture directe d'évènements déjà formés (générateur synthétique de l'écran dev, tests) */
export async function appendRaw(evs: Ev[]) { await flushEvents(); const s = await store(); try { await s.add(evs); } catch { await fallback.add(evs); } }
