// R4b (plan rétention §2.2) : Coup du jour à calendrier figé, numéroté, grille partageable sans spoiler.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { DAILY_EPOCH, DAILY_YEARS, numberOf, dateOf, todayNumber, localDay, weekdayTarget, stars, starStr, goalText, shareText, gridFrom, gridOk, playerIdx, playerMoves, fmtTime, type DailyEntry } from '../src/lib/daily';
import { migrate, SCHEMA_VERSION } from '../src/lib/migrations';
import { defaultState } from '../src/lib/store';

const years = Object.fromEntries(DAILY_YEARS.map((y) => [y, JSON.parse(fs.readFileSync(`public/daily/${y}.json`, 'utf8')) as DailyEntry[]]));
const all = DAILY_YEARS.flatMap((y) => years[y]);

describe('Numérotation', () => {
  it('n°1 = 24/11/2026, aller-retour date ↔ numéro', () => {
    expect(numberOf(DAILY_EPOCH)).toBe(1); expect(dateOf(1)).toBe('2026-11-24');
    for (let n = 1; n < 1200; n += 7) expect(numberOf(dateOf(n))).toBe(n);
  });
  it('changements d’heure : les numéros restent consécutifs', () => {
    for (const d of ['2027-03-27', '2027-03-28', '2027-10-30', '2027-10-31', '2028-03-26']) expect(numberOf(dateOf(numberOf(d) + 1))).toBe(numberOf(d) + 1);
    expect(numberOf('2027-03-29') - numberOf('2027-03-28')).toBe(1); expect(numberOf('2027-11-01') - numberOf('2027-10-31')).toBe(1);
  });
  it('le jour change à minuit LOCAL', () => {
    const a = new Date(2026, 10, 24, 23, 59, 30).getTime(), b = new Date(2026, 10, 25, 0, 0, 30).getTime();
    expect(localDay(a)).toBe('2026-11-24'); expect(todayNumber(a)).toBe(1); expect(todayNumber(b)).toBe(2);
  });
});

describe('Calendrier figé public/daily', () => {
  it('numéros et dates contigus, du n°1 au 31/12/2028', () => {
    all.forEach((e, i) => { expect(e.n).toBe(i + 1); expect(e.date).toBe(dateOf(e.n)); });
    expect(all.at(-1)!.date).toBe('2028-12-31');
    for (const y of DAILY_YEARS) expect(years[y].every((e) => e.date.startsWith(String(y)))).toBe(true);
  });
  it('figé : les premiers numéros ne changent jamais (garde contre une régénération)', () => {
    expect(all.slice(0, 3).map((e) => e.puzzleId)).toEqual(['1b8nk', '47KZx', '1BWfg']);
  });
  it('aucun puzzle en double, lignes légales, 2 à 4 coups du joueur, thème spectaculaire', () => {
    expect(new Set(all.map((e) => e.puzzleId)).size).toBe(all.length);
    for (const e of all) {
      const c = new Chess(e.fen); for (const u of e.moves.split(' ')) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      expect(playerMoves(e.moves)).toBeGreaterThanOrEqual(2); expect(playerMoves(e.moves)).toBeLessThanOrEqual(4);
      expect(e.theme).toMatch(/^(mateIn\d|smotheredMate|doubleCheck|sacrifice|quietMove|deflection|attraction|clearance|interference|xRayAttack)$/);
      if (e.theme.startsWith('mateIn')) expect(c.isCheckmate()).toBe(true);
    }
  });
  it('difficulté qui monte dans la semaine : lundi ≈ 1000 → dimanche ≈ 1900', () => {
    expect(weekdayTarget('2026-11-30')).toBe(1000); expect(weekdayTarget('2026-12-06')).toBe(1900);
    for (const e of all) expect(Math.abs(e.rating - weekdayTarget(e.date))).toBeLessThanOrEqual(160);
    const mon = all.filter((e) => weekdayTarget(e.date) === 1000), sun = all.filter((e) => weekdayTarget(e.date) === 1900);
    expect(Math.max(...mon.map((e) => e.rating))).toBeLessThan(Math.min(...sun.map((e) => e.rating)));
  });
});

describe('Grille et partage sans spoiler', () => {
  it('cases : vert du premier coup, jaune après erreur/indice, rouge montré', () => {
    expect(gridFrom(4, { 1: 'y', 3: 'r' })).toBe('gygr'); expect(gridOk('gygy')).toBe(true); expect(gridOk('gr')).toBe(false);
    expect([1, 2, 3, 4, 5, 6, 7].map(playerIdx)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });
  it('texte au format du plan, sans aucun coup ni case', () => {
    const t = shareText({ n: 142, rating: 1650 }, { grid: 'ggyg', ms: 23_400, hints: 0 }, 12);
    expect(t).toBe('♟ Coup du jour #142 · ★★★★☆\n🟩🟩🟨🟩  ⏱ 0:23  💡0\n🔥 Série 12 · Maître des Échecs\nhttps://veille-tech-pomme.github.io/maitre-des-echecs/#/jour/142');
    for (const e of all.slice(0, 60)) {
      const s = shareText(e, { grid: 'gg', ms: 1000, hints: 1 }, 0);
      for (const u of e.moves.split(' ')) { expect(s).not.toContain(u); expect(s).not.toContain(u.slice(2, 4)); }
      expect(s).not.toMatch(/[KQRBN]?x?[a-h][1-8]/);
    }
    expect(shareText({ n: 1, rating: 900 }, { grid: 'g', ms: 0, hints: 0 }, 1)).not.toContain('Série');
  });
  it('étoiles, temps, consigne', () => {
    expect([1000, 1150, 1300, 1450, 1650, 1900].map(stars)).toEqual([1, 2, 3, 3, 4, 5]); expect(starStr(1900)).toBe('★★★★★');
    expect(fmtTime(83_600)).toBe('1:24');
    expect(goalText({ fen: '8/8/8/8/8/8/8/8 b - - 0 1', theme: 'mateIn2' })).toBe('Les Blancs jouent et font mat en 2');
    expect(goalText({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', theme: 'sacrifice' })).toBe('Les Noirs jouent et gagnent');
  });
});

describe('Migration v3', () => {
  it('ajoute jour = {} sans toucher au reste', () => {
    const r = migrate({ v: 2, deviceId: '01ABC', installDay: '2026-11-01', daily: { '2026-11-20': true } });
    expect(SCHEMA_VERSION).toBe(3); expect(r.state.jour).toEqual({}); expect(r.state.daily).toEqual({ '2026-11-20': true }); expect(r.state.v).toBe(3);
    expect(defaultState().jour).toEqual({});
  });
});

describe('Journal compact (P0 ≤ 250 o/coup)', () => {
  it('IndexedDB ne répète pas dev ; la lecture et l’export le remettent', async () => {
    const { log, flushEvents, query, eraseAll, storedBytes } = await import('../src/lib/events');
    const { getState, setState } = await import('../src/lib/store');
    await eraseAll(); setState((s) => { s.consent = { detail: true, age: '13+', at: Date.now(), v: 1, src: 'sheet', upload: false } as any; });
    log('move', { gid: '01KAR9Z8Q3ZJ8X1V9W2Y3Z4A5B', ply: 3, uci: 'e2e4', side: 'me', thinkMs: 4450, lifts: [], input: 'click', hintLevel: 0 }); await flushEvents();
    const raw: any[] = await new Promise((res) => { const rq = indexedDB.open('echecs-events', 1); rq.onsuccess = () => { const g = rq.result.transaction('ev').objectStore('ev').getAll(); g.onsuccess = () => res(g.result); }; });
    expect(raw.length).toBeGreaterThan(0); expect(raw.every((r) => !('dev' in r))).toBe(true);
    const ev = await query(); expect(ev.every((e) => e.dev === getState().deviceId)).toBe(true);
    expect(storedBytes(ev.at(-1)!)).toBe(JSON.stringify(raw.find((r) => r.type === 'move')).length);
    await eraseAll();
  });
});
