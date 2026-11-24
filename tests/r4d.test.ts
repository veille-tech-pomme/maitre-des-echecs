// R4d (plan rétention §2.11, lignes rouges §9.3/§9.8) : rappels opt-in, 1/jour max, écrits par le coach, jamais culpabilisants.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { plan, reminderText, clampTime, shouldOffer, icsFile, hhmm, isMinor, DAYS_AHEAD, ID_BASE, type Reminder } from '../src/lib/reminders';

const R = (h = 18, m = 30, on = true): Reminder => ({ on, h, m });
const src = (p: string) => fs.readFileSync(p, 'utf8');
const ALL = [...JSON.parse(src('public/daily/2026.json')), ...JSON.parse(src('public/daily/2027.json')), ...JSON.parse(src('public/daily/2028.json'))];
// vocabulaire interdit (§9.3 : pas de culpabilisation, pas d'urgence artificielle, pas de série brandie comme une menace)
const GUILT = /(perd|perdre|perdu|manqu|oubli|déçu|triste|dernière chance|vite|urgent|plus que|sinon|série|flamme|ne laisse|attention|n'oublie|n’oublie|reviens|où es-tu|tu nous manques|!)/i;

describe('Opt-in et protection des mineurs', () => {
  it('jamais actif par défaut, proposé une seule fois, jamais aux moins de 13 ans', () => {
    expect(shouldOffer({ settings: {} })).toBe(true);
    expect(shouldOffer({ consent: { ageBand: '13+' }, settings: {} })).toBe(true);
    expect(shouldOffer({ consent: { ageBand: '<13' }, settings: {} })).toBe(false);
    expect(isMinor({ consent: { ageBand: '<13' } })).toBe(true);
    expect(shouldOffer({ settings: { reminder: { ...R(), on: false, asked: 1, declined: 1 } } })).toBe(false);
    expect(shouldOffer({ settings: { reminder: { ...R(), on: false, asked: 1 } } })).toBe(false);
    expect(shouldOffer({ settings: { reminder: R() } })).toBe(false);
    const st = src('src/lib/store.ts'); expect(st).not.toMatch(/reminder:\s*\{\s*on:\s*true/);
  });
  it('heures de jour uniquement (07:00–21:30), pas de 5 min', () => {
    expect(clampTime(3, 0)).toEqual({ h: 7, m: 0 }); expect(clampTime(23, 45)).toEqual({ h: 21, m: 30 }); expect(clampTime(18, 32)).toEqual({ h: 18, m: 30 });
    expect(hhmm({ h: 7, m: 5 })).toBe('07:05');
  });
});

describe('Au plus un rappel par jour', () => {
  it('7 jours programmés, un par date, ids 7101..7107 (7001 = essai Premium intact)', () => {
    const p = plan(new Date(2026, 10, 24, 10, 0), R(), false);
    expect(p).toHaveLength(DAYS_AHEAD); expect(new Set(p.map((x) => x.date)).size).toBe(DAYS_AHEAD);
    expect(p[0].date).toBe('2026-11-24'); expect(p.map((x) => x.id)).toEqual([7101, 7102, 7103, 7104, 7105, 7106, 7107]);
    expect(p.every((x) => x.at.getHours() === 18 && x.at.getMinutes() === 30)).toBe(true);
    expect(p.some((x) => x.id === 7001)).toBe(false); expect(ID_BASE).toBe(7100);
    expect(p[0].n).toBe(1);
  });
  it('déjà joué aujourd’hui → rien aujourd’hui ; heure passée → commence demain', () => {
    expect(plan(new Date(2026, 10, 24, 10, 0), R(), true)[0].date).toBe('2026-11-25');
    expect(plan(new Date(2026, 10, 24, 19, 0), R(), false)[0].date).toBe('2026-11-25');
  });
  it('le rappel de fin d’essai Premium est conservé dans notify.ts', () => {
    const n = src('src/lib/notify.ts'); expect(n).toMatch(/id: 7001/); expect(n).toMatch(/scheduleTrialReminder/);
    expect(src('src/lib/entitlements/index.ts')).toMatch(/scheduleTrialReminder/);
  });
});

describe('Écrits par le coach, jamais culpabilisants', () => {
  it('chaque jour du calendrier (3 ans) produit un texte sobre, sans spoiler ni reproche', () => {
    for (const e of ALL) {
      const t = reminderText(e.date, e, 'Léa');
      expect(t.title).toMatch(new RegExp(`^Coup du jour #${e.n} · [★☆]{5}$`));
      expect(t.body).toMatch(/coach/); expect(`${t.title} ${t.body}`).not.toMatch(GUILT);
      for (const mv of e.moves.split(' ')) expect(t.body).not.toContain(mv); // aucun coup dévoilé
      expect(t.body.length).toBeLessThan(140);
    }
    const f = reminderText('2026-11-29', null); expect(f.title).toBe('Tes 5 minutes d’échecs'); expect(f.body).not.toMatch(GUILT);
    expect(reminderText('2026-11-29', { n: 6, theme: 'mateIn3', rating: 1900 }).body).toBe('Ton coach a choisi un mat en 3 pour ce dimanche, un beau défi. Cinq minutes suffisent.');
  });
  it('aucun texte de l’interface rappel/installation ne culpabilise', () => {
    for (const p of ['src/components/ReminderOffer.tsx', 'src/components/InstallSheet.tsx']) {
      const strs = [...src(p).matchAll(/>\s*([A-Za-zÀ-ÿ][^<>{}();=&|]{7,})</g)].map((m) => m[1]);
      for (const s of strs) expect(s, p + ' : ' + s).not.toMatch(/(perd|manqu|dernière chance|urgent|tu nous manques|!)/i);
    }
  });
});

describe('Sans serveur, rien ne sort (§9.8)', () => {
  it('aucun Web Push, aucun appel réseau dans les rappels', () => {
    for (const p of ['src/lib/reminders.ts', 'src/lib/reminders-run.ts', 'src/components/ReminderOffer.tsx', 'src/components/InstallSheet.tsx']) {
      const s = src(p).replace(/\/\/.*$/gm, '');
      expect(s, p).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|PushManager|pushManager|subscribe\(|vapid|WebSocket/i);
    }
  });
  it('.ics : événement quotidien valide (RFC 5545), lien vers le Coup du jour', () => {
    const ics = icsFile(R(8, 5), new Date(2026, 10, 24, 12));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true); expect(ics).toMatch(/\r\nRRULE:FREQ=DAILY\r\n/);
    expect(ics).toMatch(/DTSTART:20261125T080500\r\n/); expect(ics).toMatch(/DTEND:20261125T081500\r\n/);
    expect(ics).toMatch(/URL:https:\/\/veille-tech-pomme\.github\.io\/maitre-des-echecs\/#\/jour/); expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(GUILT);
  });
});
