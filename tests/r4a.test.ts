// R4a (plan rétention §6, §2.13) : identifiant d'installation, migrations, journal d'évènements, mesures locales.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { ulid, ULID_RE, ulidTime } from '../src/lib/ulid';
import { migrate, SCHEMA_VERSION, MIGRATIONS, earliestDay } from '../src/lib/migrations';
import { defaultState, getState } from '../src/lib/store';
import { FIELD_VISIBILITY } from '../src/lib/privacy';
import { logEvent, allEvents, flushEvents, clearEvents, exportEvents, EVENT_V, type AppEvent } from '../src/lib/events';
import { computeMetrics, addDays, daysBetween, isoWeek } from '../src/lib/metrics';

describe('ULID (identifiant d’installation et d’évènement)', () => {
  it('format, temps encodé, unicité, ordre monotone dans la même milliseconde', () => {
    const t = 1764000000000; const ids = Array.from({ length: 2000 }, () => ulid(t));
    for (const id of ids) expect(id).toMatch(ULID_RE);
    expect(ulidTime(ids[0])).toBe(t);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(ulid(t + 1) > ids[ids.length - 1]).toBe(true);
  });
  it('aucune donnée de l’appareil : seuls l’horloge et crypto.getRandomValues entrent dans le calcul', async () => {
    const src = (await import('node:fs')).readFileSync('src/lib/ulid.ts', 'utf8');
    for (const w of ['navigator', 'userAgent', 'screen', 'canvas', 'language', 'hardwareConcurrency', 'devicePixelRatio']) expect(src).not.toContain(w);
  });
  it('un état neuf a un identifiant et un jour d’installation', () => {
    const s = defaultState(); expect(s.deviceId).toMatch(ULID_RE); expect(s.installDay).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(s.v).toBe(SCHEMA_VERSION);
    expect(defaultState().deviceId).not.toBe(s.deviceId);
  });
});

describe('Modèle versionné et migrations', () => {
  const v1 = { v: 1, createdAt: new Date(2026, 9, 3, 10).getTime(), xp: 420, streak: { count: 4, best: 9, last: '2026-11-20' }, activity: { '2026-10-01': 30, '2026-11-20': 12 }, lessons: { 'd-pion': { done: true, stars: 3, step: 0 } }, puzzle: { rating: 1012, games: 40, history: [], solved: 30, failed: 10, seen: ['abc'], streak: 2, bestStreak: 7 }, daily: { '2026-09-28': true }, srs: { 'p:abc': { id: 'p:abc', due: 1 } }, games: [{ id: 'g1', pgn: '1. e4' }], settings: { theme: 'dark', name: 'Léa' }, coach: { v: 2, skills: { x: 1 } }, custom: { keep: true } };
  it('v1 → v2 sans perte : tout champ existant est conservé, identifiant + jour d’installation ajoutés', () => {
    const m = migrate(v1);
    expect(m.from).toBe(1); expect(m.to).toBe(SCHEMA_VERSION); expect(m.applied).toEqual(MIGRATIONS.map((x) => x.to));
    for (const [k, v] of Object.entries(v1)) if (k !== 'v') expect(m.state[k]).toEqual(v);
    expect(m.state.deviceId).toMatch(ULID_RE);
    expect(m.state.installDay).toBe('2026-09-28'); // plus ancien jour connu (puzzle du jour avant la création)
    expect(v1).not.toHaveProperty('deviceId'); // l'objet d'origine n'est pas modifié
  });
  it('sans champ v (sauvegardes très anciennes) = v1 ; idempotent ; identifiant existant conservé', () => {
    const { v, ...nov } = v1; const a = migrate(nov); expect(a.from).toBe(1);
    const b = migrate(a.state); expect(b.applied).toEqual([]); expect(b.state).toEqual(a.state);
  });
  it('une version plus récente que l’app n’est ni migrée ni rétrogradée', () => {
    const fut = { ...v1, v: SCHEMA_VERSION + 3, newThing: 1 }; const m = migrate(fut);
    expect(m.future).toBe(true); expect(m.state).toEqual(fut);
  });
  it('jour d’installation : création, sinon activité la plus ancienne', () => {
    expect(earliestDay({ activity: { '2026-02-02': 1, '2026-01-05': 1 } })).toBe('2026-01-05');
  });
  it('chaque champ de l’état est classé privé / publiable (plan §6.5)', () => {
    for (const k of Object.keys(defaultState())) expect(FIELD_VISIBILITY).toHaveProperty(k);
    expect(FIELD_VISIBILITY.deviceId).toBe('private'); expect(FIELD_VISIBILITY.games).toBe('private'); expect(FIELD_VISIBILITY.coach).toBe('private');
  });
});

describe('Journal d’évènements (IndexedDB)', () => {
  it('append-only, forme serveur {id, dev, t, type, v, data}, ordre chronologique, export, effacement', async () => {
    await clearEvents();
    const t0 = Date.now();
    logEvent('app_open', { from: 'boot' }, t0); logEvent('card_served', { kind: 'puzzle' }, t0 + 5); logEvent('card_result', { kind: 'puzzle', out: 'ok' }, t0 + 9);
    await flushEvents();
    logEvent('session_end', { ms: 1000 }, t0 + 20);
    const ev = await allEvents();
    expect(ev.map((e) => e.type)).toEqual(['app_open', 'card_served', 'card_result', 'session_end']);
    for (const e of ev) { expect(Object.keys(e).sort()).toEqual(['data', 'dev', 'id', 'sid', 't', 'type', 'v']); expect(e.id).toMatch(ULID_RE); expect(e.dev).toBe(getState().deviceId); expect(e.v).toBe(EVENT_V); }
    const ex = JSON.parse(await exportEvents()); expect(ex.count).toBe(4); expect(ex.events[0].type).toBe('app_open');
    await clearEvents(); expect(await allEvents()).toEqual([]);
  });
});

describe('Mesures locales J1/J7/J30', () => {
  const at = (day: string, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
  const ev = (type: AppEvent['type'], day: string, data = {}, h = 12): AppEvent => ({ id: ulid(at(day, h)), dev: 'X', sid: 'S', t: at(day, h), type, v: 1, data });
  it('dates locales, y compris le passage à l’heure d’hiver (25/10/2026)', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25'); expect(addDays('2026-10-25', 1)).toBe('2026-10-26'); expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(daysBetween('2026-10-20', '2026-10-27')).toBe(7); expect(isoWeek('2026-11-24')).toBe('2026-W48'); expect(isoWeek('2027-01-01')).toBe('2026-W53');
  });
  it('J1 oui, J7 non, J30 à venir ; « dans la semaine » oui', () => {
    const e = [ev('app_open', '2026-11-01'), ev('app_open', '2026-11-02', {}, 23), ev('card_result', '2026-11-05', { out: 'ok' }), ev('session_end', '2026-11-05', { ms: 600000 })];
    const m = computeMetrics(e, { installDay: '2026-11-01' }, new Date(2026, 10, 24, 9));
    expect(m.ret).toEqual({ d1: 'yes', d7: 'no', d30: 'pending' }); expect(m.within.d7).toBe('yes'); expect(m.within.d30).toBe('yes'); // déjà revenu : connu avant la fin du mois
    expect(m.age).toBe(23); expect(m.curve[0]).toBe(true); expect(m.curve[1]).toBe(true); expect(m.curve[24]).toBe(null);
    expect(m.minutes).toBe(10); expect(m.cards.ok).toBe(1); expect(m.cohort).toBe('2026-W44');
  });
  it('jour d’installation ce jour même : tout est « à venir »', () => {
    const m = computeMetrics([ev('app_open', '2026-11-24')], { installDay: '2026-11-24' }, new Date(2026, 10, 24, 20));
    expect(m.ret).toEqual({ d1: 'pending', d7: 'pending', d30: 'pending' });
  });
  it('joueur d’avant le journal : l’historique d’activité compte (et peut avancer le jour d’installation)', () => {
    const m = computeMetrics([ev('app_open', '2026-11-24')], { installDay: '2026-11-20', activity: { '2026-10-01': 10, '2026-10-02': 5, '2026-10-08': 3 }, daily: { '2026-10-31': true } }, new Date(2026, 10, 24, 12));
    expect(m.installDay).toBe('2026-10-01'); expect(m.ret).toEqual({ d1: 'yes', d7: 'yes', d30: 'yes' });
    expect(m.sources).toEqual({ eventDays: 1, legacyDays: 4 });
  });
  it('la séance de 5 min (kind coach5) ne double pas les minutes d’usage', () => {
    const m = computeMetrics([ev('session_end', '2026-11-24', { ms: 120000 }), ev('session_end', '2026-11-24', { kind: 'coach5', ms: 300000 })], { installDay: '2026-11-24' }, new Date(2026, 10, 24, 13));
    expect(m.minutes).toBe(2);
  });
});
