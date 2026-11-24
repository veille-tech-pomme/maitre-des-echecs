// R4d : chemin natif (Capacitor LocalNotifications simulé) — 7 rappels, 1 par jour, annulation, refus, désactivation.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { vi, describe, it, expect, beforeAll } from 'vitest';
const calls = vi.hoisted(() => ({ cancel: [] as any[], schedule: [] as any[], perm: 'granted', asked: 0 }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  cancel: async (x: any) => { calls.cancel.push(x); }, schedule: async (x: any) => { calls.schedule.push(x); },
  requestPermissions: async () => { calls.asked++; return { display: calls.perm }; }, addListener: async () => ({ remove() {} }),
} }));
let R: typeof import('../src/lib/reminders-run'); let S: typeof import('../src/lib/store');
beforeAll(async () => {
  (globalThis as any).window = { Capacitor: { isNativePlatform: () => true }, addEventListener() {} };
  (globalThis as any).fetch = async (u: string) => { const y = /daily\/(\d+)\.json/.exec(u)![1]; return { ok: true, json: async () => JSON.parse(fs.readFileSync(`public/daily/${y}.json`, 'utf8')) }; };
  S = await import('../src/lib/store'); R = await import('../src/lib/reminders-run');
});
describe('App iOS : notifications locales', () => {
  it('refus du système → rien n’est activé', async () => {
    calls.perm = 'denied'; expect(await R.enableReminder(9, 0, 'offer')).toBe('denied'); expect(S.getState().settings.reminder?.on).toBeFalsy(); expect(calls.schedule).toHaveLength(0);
  });
  it('accord → 7 rappels max, un par jour, à l’heure choisie, textes du coach ; 7001 jamais annulé', async () => {
    calls.perm = 'granted'; expect(await R.enableReminder(23, 50, 'offer')).toBe('ok'); // borné à 21:30
    const r = S.getState().settings.reminder!; expect(r).toMatchObject({ on: true, h: 21, m: 30 });
    const last = calls.schedule.at(-1).notifications; expect(last.length).toBeGreaterThanOrEqual(6); expect(last.length).toBeLessThanOrEqual(7);
    const dates = last.map((n: any) => n.schedule.at.toDateString()); expect(new Set(dates).size).toBe(last.length);
    for (const n of last) { expect(n.id).toBeGreaterThan(7100); expect(n.id).toBeLessThanOrEqual(7107); expect(n.schedule.at.getHours()).toBe(21); expect(n.body).toMatch(/coach/); }
    expect(calls.cancel.flatMap((c) => c.notifications.map((x: any) => x.id))).not.toContain(7001);
  });
  it('déjà joué aujourd’hui → pas de rappel aujourd’hui', async () => {
    S.setState((s) => { s.activity[S.today()] = 10; s.settings.reminder = { on: true, h: 21, m: 30 }; });
    await R.syncReminders(); const last = calls.schedule.at(-1).notifications;
    expect(last.every((n: any) => n.schedule.at.toDateString() !== new Date().toDateString())).toBe(true);
  });
  it('désactivé en un geste → tout est annulé, plus rien n’est programmé', async () => {
    const before = calls.schedule.length; await R.disableReminder('settings');
    expect(S.getState().settings.reminder?.on).toBe(false); expect(calls.schedule.length).toBe(before);
    expect(calls.cancel.at(-1).notifications.map((x: any) => x.id)).toEqual([7101, 7102, 7103, 7104, 7105, 7106, 7107]);
  });
});
