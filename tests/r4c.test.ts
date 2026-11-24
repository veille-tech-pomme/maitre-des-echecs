// R4c (plan rétention §2.3, lignes rouges §9) : série souple — gels gagnés, réparation, vacances, paliers, mineurs.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { hit, reconcile, markGoal, startVacation, endVacation, alive, atRisk, addDays, noteText, streakVisible, titleFor, MILESTONES, type Streak, type StreakNote } from '../src/lib/streak';
import { migrate, SCHEMA_VERSION } from '../src/lib/migrations';

const D0 = '2026-11-02'; // lundi
const fresh = (): Streak => ({ count: 0, best: 0, last: '', freezes: 0, frozen: [], goalDays: [], repair: null, vacation: null, seen: [], cel: null, notes: [] });
const days = (st: Streak, from: string, n: number) => { for (let i = 0; i < n; i++) hit(st, addDays(from, i)); };

describe('Validation du jour', () => {
  it('une réussite par jour suffit ; consécutif → +1 ; même jour → rien', () => {
    const st = fresh(); expect(hit(st, D0)!.count).toBe(1); expect(hit(st, D0)).toBeNull(); expect(hit(st, addDays(D0, 1))!.count).toBe(2);
    expect(st.best).toBe(2);
  });
  it('BUG corrigé : un jour manqué ne remet plus à 1 quand un gel est disponible', () => {
    const st = fresh(); days(st, D0, 7); expect(st.freezes).toBe(1); // 7 jours → 1 gel
    const r = hit(st, addDays(D0, 8)); // le jour D0+7 est manqué
    expect(r!.count).toBe(8); expect(st.freezes).toBe(0); expect(st.frozen).toEqual([addDays(D0, 7)]);
    expect(st.notes!.some((n) => n.k === 'freeze' && n.day === addDays(D0, 7))).toBe(true);
    expect(noteText({ k: 'freeze', day: '2026-11-10' })).toBe('Ton gel a protégé mardi ❄️');
  });
});

describe('Gels gagnés (jamais achetés)', () => {
  it('1 tous les 7 jours, 2 au plus', () => {
    const st = fresh(); days(st, D0, 6); expect(st.freezes).toBe(0); hit(st, addDays(D0, 6)); expect(st.freezes).toBe(1);
    days(st, addDays(D0, 7), 7); expect(st.freezes).toBe(2); days(st, addDays(D0, 14), 7); expect(st.freezes).toBe(2);
  });
  it('deux jours manqués, deux gels → série intacte ; un 3e jour → pause avec réparation', () => {
    const st = fresh(); days(st, D0, 14); expect(st.freezes).toBe(2);
    reconcile(st, addDays(D0, 16)); expect(st.count).toBe(14); expect(st.freezes).toBe(0); expect(alive(st, addDays(D0, 16))).toBe(true);
    reconcile(st, addDays(D0, 18)); expect(st.count).toBe(0); expect(st.best).toBe(14); expect(st.repair).toMatchObject({ prev: 14, start: addDays(D0, 18) });
  });
  it('aucun code d’achat ne touche aux gels (Premium, prix, paiement)', () => {
    for (const f of ['src/lib/streak.ts', 'src/pages/Streak.tsx', 'src/pages/Premium.tsx', 'src/lib/premium.ts']) if (fs.existsSync(f)) {
      const src = fs.readFileSync(f, 'utf8');
      if (f.includes('Premium') || f.includes('premium')) expect(src).not.toMatch(/freez|gel(s)?\b/i);
      else expect(src).not.toMatch(/isPremium|purchase|achat\(|prix|€/);
    }
  });
});

describe('Réparation (48 h, 2 jours d’objectif complet)', () => {
  it('objectif aujourd’hui et demain → série restaurée', () => {
    const st = fresh(); days(st, D0, 10); const t = addDays(D0, 11); // D0+10 manqué, pas de gel (1 gel gagné au 7e… consommé ?)
    st.freezes = 0; reconcile(st, t); expect(st.count).toBe(0); expect(st.repair!.prev).toBe(10);
    hit(st, t); expect(markGoal(st, t)).toBe(false); hit(st, addDays(t, 1)); expect(markGoal(st, addDays(t, 1))).toBe(true);
    expect(st.count).toBe(12); expect(st.repair).toBeNull(); expect(st.notes!.at(-1)).toEqual({ k: 'repaired', count: 12 });
  });
  it('fenêtre dépassée → plus de réparation ; longue absence → pas d’offre', () => {
    const st = fresh(); days(st, D0, 5); reconcile(st, addDays(D0, 6)); expect(st.repair).toBeTruthy();
    reconcile(st, addDays(D0, 8)); expect(st.repair).toBeNull();
    const s2 = fresh(); days(s2, D0, 5); reconcile(s2, addDays(D0, 20)); expect(s2.repair).toBeNull(); expect(s2.count).toBe(0); expect(s2.best).toBe(5);
  });
});

describe('Mode vacances', () => {
  it('jusqu’à 7 jours, sans gel consommé ; retour → une réussite suffit', () => {
    const st = fresh(); days(st, D0, 7); expect(st.freezes).toBe(1);
    const v = startVacation(st, addDays(D0, 7), 30); expect(v.to).toBe(addDays(D0, 13)); // borné à 7 jours
    expect(atRisk(st, addDays(D0, 9))).toBe(false); expect(alive(st, addDays(D0, 12))).toBe(true);
    const r = hit(st, addDays(D0, 14)); expect(r!.count).toBe(8); expect(st.freezes).toBe(1); expect(st.vacation).toBeNull();
  });
  it('retour anticipé : les jours passés restent couverts', () => {
    const st = fresh(); days(st, D0, 3); startVacation(st, addDays(D0, 3), 5); endVacation(st, addDays(D0, 5));
    expect(st.vacation).toBeNull(); expect(st.count).toBe(3); expect(st.last).toBe(addDays(D0, 4)); expect(atRisk(st, addDays(D0, 5))).toBe(true);
  });
});

describe('Paliers, titres, textes', () => {
  it('3, 7, 30, 100, 365 : une célébration chacun, une seule fois', () => {
    const st = fresh(); const got: number[] = [];
    for (let i = 0; i < 365; i++) { const r = hit(st, addDays(D0, i)); if (r?.milestone) got.push(r.milestone); }
    expect(got).toEqual(MILESTONES); expect(st.cel).toBe(365); expect(titleFor(st.best)).toBe('Une année'); expect(titleFor(5)).toBe('Régulier');
  });
  it('aucun texte culpabilisant', () => {
    const notes: StreakNote[] = [{ k: 'freeze', day: D0 }, { k: 'broken', prev: 12, repair: true }, { k: 'broken', prev: 1, repair: false }, { k: 'earned', n: 7 }, { k: 'repaired', count: 9 }, { k: 'vacation-end' }];
    const all = notes.map(noteText).join(' ') + fs.readFileSync('src/pages/Streak.tsx', 'utf8');
    for (const w of ['perdu', 'dommage', 'honte', 'déçu', 'ne lâche pas', 'dépêche', 'vite !', 'dernière chance', 'tu vas perdre']) expect(all.toLowerCase()).not.toContain(w);
  });
  it('mineurs (<13) : série masquée par défaut, activable', () => {
    expect(streakVisible({ settings: {}, consent: { ageBand: '<13' } })).toBe(false);
    expect(streakVisible({ settings: { streakShow: true }, consent: { ageBand: '<13' } })).toBe(true);
    expect(streakVisible({ settings: {} })).toBe(true); expect(streakVisible({ settings: { streakShow: false } })).toBe(false);
  });
});

describe('Migration v4 et intégration', () => {
  it('gels de départ selon la série en cours, paliers passés sans célébration', () => {
    const r = migrate({ v: 3, jour: {}, streak: { count: 16, best: 31, last: '2026-11-23' } });
    expect(SCHEMA_VERSION).toBe(4); expect(r.state.streak).toMatchObject({ count: 16, best: 31, freezes: 2, seen: [3, 7, 30], cel: null, repair: null, vacation: null });
    expect(migrate({ v: 1 }).state.streak).toMatchObject({ count: 0, freezes: 0 });
  });
  it('addXp valide la journée via la série souple ; 12e carte du fil → objectif (réparation)', async () => {
    const { addXp, getState, setState, today } = await import('../src/lib/store');
    const { recordFeed, DAILY_CARDS } = await import('../src/coach/feed');
    setState((s) => { s.streak = { ...fresh(), count: 4, best: 4, last: addDays(today(), -2), freezes: 1 }; });
    addXp(5, 'test'); expect(getState().streak.count).toBe(5); expect(getState().streak.frozen).toEqual([addDays(today(), -1)]);
    setState((s) => { s.streak.repair = { prev: 3, lost: 'x', start: addDays(today(), -1), until: today(), done: [addDays(today(), -1)] }; s.feed = undefined as any; });
    for (let i = 0; i < DAILY_CARDS; i++) setState((s) => recordFeed(s, { id: 'c' + i, kind: 'puzzle', skill: null } as any, 'ok', 1000));
    expect(getState().streak.repair).toBeNull(); expect(getState().streak.count).toBe(8);
  });
});
