// Brief P0 §9 : journal unique (events.ts), niveaux, flush groupé, compactage, consentement, effacement, repli.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ulid, ULID_RE } from '../src/lib/ulid';
import { log, flushEvents, query, eraseAll, eraseTier, stats, setEventStore, memoryStore, maybeCompact, appendRaw, exportJsonl, storedBytes, pack, unpack, TIER, FLUSH_MS, type EventStore } from '../src/lib/events';
import { compact } from '../src/lib/events-compact';
import { syntheticGames } from '../src/lib/synthetic';
import { setState, getState, resetAll } from '../src/lib/store';
import { setConsent, shouldAskConsent, CONSENT_TEXT, REASK_MS } from '../src/lib/consent';

let mem = memoryStore();
beforeEach(async () => { mem = memoryStore(); setEventStore(mem); await eraseAll(); setState((s) => { s.consent = undefined; s.onboarded = true; }); });

describe('ULID', () => {
  it('10 000 dans la même milliseconde : uniques et monotones', () => {
    const ids = Array.from({ length: 10000 }, () => ulid(1764000000000));
    expect(new Set(ids).size).toBe(10000); expect([...ids].sort()).toEqual(ids); ids.forEach((i) => expect(i).toMatch(ULID_RE));
  });
});

describe('Niveaux et consentement', () => {
  it('sans consentement détaillé : AUCUN évènement detail écrit, les base le sont', async () => {
    expect(log('move', { gid: 'g', ply: 0, side: 'me', thinkMs: 900 })).toBeNull();
    expect(log('puzzle_try', { pid: 'x' })).toBeNull(); expect(log('lesson_step', {})).toBeNull(); expect(log('visibility', { hidden: true })).toBeNull();
    log('game_start', { gid: 'g' }); log('card_served', { card: 'c' });
    const ev = await query(); expect(ev.map((e) => e.type)).toEqual(['game_start', 'card_served']);
    expect(ev.every((e) => TIER[e.type] === 'base')).toBe(true);
  });
  it('avec consentement : detail écrit ; chaque évènement porte id, dev, sid, t, type, v, data', async () => {
    setConsent(true, '13+', 'sheet');
    log('move', { gid: 'g', ply: 0, side: 'me', thinkMs: 900 });
    const ev = await query({ type: ['move'] }); expect(ev).toHaveLength(1);
    expect(Object.keys(ev[0]).sort()).toEqual(['data', 'dev', 'id', 'sid', 't', 'type', 'v']); expect(ev[0].dev).toBe(getState().deviceId);
    const c = await query({ type: ['consent'] }); expect(c[0].data).toMatchObject({ detail: true, upload: false, ageBand: '13+', textV: 1 });
  });
  it('moins de 13 ans : upload verrouillé à false', () => { const c = setConsent(true, '<13', 'sheet'); expect(c.upload).toBe(false); expect(c.ageBand).toBe('<13'); });
  it('feuille : une fois ; après « Non », une seule nouvelle demande, au bout de 7 jours', () => {
    expect(shouldAskConsent()).toBe(true);
    setConsent(false, undefined, 'sheet'); const at = getState().consent!.at;
    expect(shouldAskConsent(getState(), at + REASK_MS - 1)).toBe(false); expect(shouldAskConsent(getState(), at + REASK_MS)).toBe(true);
    setConsent(false, undefined, 'sheet'); expect(shouldAskConsent(getState(), Date.now() + 99 * REASK_MS)).toBe(false);
    setState((s) => { s.consent = undefined; s.onboarded = false; }); expect(shouldAskConsent()).toBe(false); // jamais pendant l'accueil
  });
  it('texte du consentement : celui du brief §6, mot pour mot', () => {
    expect(CONSENT_TEXT).toBe('Avec ton accord, l’app enregistre sur ce téléphone comment tu joues : le temps passé sur chaque coup, les pièces que tu hésites à jouer, tes essais dans les puzzles. Ton coach s’en sert pour te conseiller. Rien ne quitte ton appareil. Tu peux tout voir, exporter ou effacer dans Réglages.');
  });
});

describe('Écriture groupée et repli', () => {
  it('log() est synchrone ; flush groupé après 2 s (une seule écriture)', async () => {
    vi.useFakeTimers(); const spy = vi.spyOn(mem, 'add');
    for (let i = 0; i < 20; i++) log('card_served', { card: 'c' + i });
    expect(spy).not.toHaveBeenCalled(); vi.advanceTimersByTime(FLUSH_MS); await vi.runAllTimersAsync(); vi.useRealTimers();
    await flushEvents(); expect(spy).toHaveBeenCalledTimes(1); expect(spy.mock.calls[0][0]).toHaveLength(20);
  });
  it('stockage en échec (navigation privée, quota) → mémoire, sans exception', async () => {
    const bad: EventStore = { add: async () => { throw new Error('QuotaExceededError'); }, all: async () => [], remove: async () => {}, clear: async () => {} };
    setEventStore(bad); log('card_served', { card: 'x' });
    await expect(flushEvents()).resolves.toBeUndefined(); expect((await query()).some((e) => e.data.card === 'x')).toBe(true);
  });
});

describe('Plafonds et compactage', () => {
  it('au-delà du plafond : move/visibility/lesson_step > 180 j supprimés après un game_summary ; consent jamais', async () => {
    const old = Date.now() - 400 * 86400e3;
    const games = syntheticGames(30, { startT: old, dev: 'D', moves: 20 });
    await appendRaw(games);
    setConsent(true, '13+', 'sheet'); await appendRaw([{ ...games[0], id: ulid(old), type: 'consent', data: { detail: true } }]);
    const before = await stats(); expect(before.byType.move).toBe(30 * 40);
    const plan = await maybeCompact(Date.now(), { events: 100, bytes: 1e9 });
    expect(plan!.add).toHaveLength(30); expect(plan!.add[0].data).toHaveProperty('p90');
    const after = await stats(); expect(after.byType.move ?? 0).toBe(0); expect(after.byType.game_summary).toBe(30);
    expect(after.byType.consent).toBe(2); expect(after.byType.game_start).toBe(30);
  });
  it('sous le plafond : rien ; compactage idempotent (pas de double résumé)', async () => {
    expect(await maybeCompact(Date.now())).toBeNull();
    const ev = syntheticGames(2, { startT: Date.now() - 300 * 86400e3 });
    const p1 = compact(ev); expect(p1.add).toHaveLength(2);
    const sumEv = p1.add.map((a) => ({ ...ev[0], id: ulid(a.t), type: 'game_summary' as const, data: a.data }));
    expect(compact([...ev, ...sumEv]).add).toHaveLength(0);
  });
  it('volume : ≤ 250 octets par coup (≈ 10 Ko pour 40 coups)', () => {
    const g = syntheticGames(1, { startT: Date.now(), moves: 40 }); const mv = g.filter((e) => e.type === 'move');
    const per = mv.reduce((a, e) => a + storedBytes(e), 0) / mv.length; expect(per).toBeLessThanOrEqual(250);
  });
});

describe('Export et effacement', () => {
  it('export JSON Lines relisible ; eraseTier(detail) garde consent ; tout effacer vide le journal et renouvelle l’identifiant', async () => {
    setConsent(true, '13+', 'sheet'); log('move', { gid: 'g' }); log('game_end', { gid: 'g' });
    const lines = (await exportJsonl()).trim().split('\n').map((l) => JSON.parse(l)); expect(lines.map((e) => e.type)).toEqual(['consent', 'move', 'game_end']);
    expect(await eraseTier('detail')).toBe(1); expect((await query()).map((e) => e.type)).toEqual(['consent', 'game_end']);
    const dev0 = getState().deviceId; resetAll(); await eraseAll();
    expect(await query()).toEqual([]); expect(getState().deviceId).not.toBe(dev0); expect(getState().consent).toBeUndefined();
  });
});
