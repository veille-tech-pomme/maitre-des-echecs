// Rappels (R4d) côté plateforme : notifications locales Capacitor (app iOS), pastille d'icône et .ics (web).
import { getState, setState, today } from './store';
import { isNative } from './platform';
import { log as logEv, flushEvents } from './events';
// évènements rares (réglage) : écrits tout de suite plutôt qu'au prochain lot de 2 s
const log = (t: 'reminder' | 'notif_opened', d: Record<string, unknown>) => { logEv(t, d); void flushEvents(); };
import { entry } from './daily';
import { plan, reminderText, clampTime, icsFile, DEFAULT_TIME, DAYS_AHEAD, ID_BASE, type Reminder } from './reminders';

const ids = () => Array.from({ length: DAYS_AHEAD }, (_, i) => ({ id: ID_BASE + 1 + i }));
const playedToday = () => (getState().activity[today()] || 0) > 0;
async function ln() { return (await import('@capacitor/local-notifications')).LocalNotifications; }

/** pastille « 1 » tant que le Coup du jour n'est pas joué (app installée, rappel actif) ; effacée sinon */
export async function syncBadge() {
  const nav = navigator as any; if (!nav.setAppBadge) return;
  const r = getState().settings.reminder;
  try { if (r?.on && r.badge !== false && !playedToday()) await nav.setAppBadge(1); else await nav.clearAppBadge?.(); } catch {}
}
/** reprogramme les rappels natifs (7 jours) ; celui d'aujourd'hui saute si le joueur a déjà joué */
export async function syncReminders() {
  void syncBadge();
  if (!isNative()) return;
  const s = getState(); const r = s.settings.reminder;
  try {
    const L = await ln(); await L.cancel({ notifications: ids() });
    if (!r?.on) return;
    const days = plan(new Date(), r, playedToday());
    const notifications = await Promise.all(days.map(async (d) => {
      const e = await entry(d.n).catch(() => null); const t = reminderText(d.date, e, s.settings.name);
      return { id: d.id, title: t.title, body: t.body, schedule: { at: d.at, allowWhileIdle: true }, extra: { kind: 'daily', n: d.n } };
    }));
    if (notifications.length) await L.schedule({ notifications });
  } catch (e) { console.warn('rappels', e); }
}
export type EnableResult = 'ok' | 'denied' | 'web';
export async function enableReminder(h: number, m: number, from: 'offer' | 'settings'): Promise<EnableResult> {
  const t = clampTime(h, m);
  if (isNative()) {
    try { const L = await ln(); const p = await L.requestPermissions(); if (p.display !== 'granted') { log('reminder', { on: false, denied: true, from }); return 'denied'; } } catch { return 'denied'; }
  }
  setState((s) => { s.settings.reminder = { ...(s.settings.reminder || {}), on: true, h: t.h, m: t.m, asked: s.settings.reminder?.asked || Date.now() } as Reminder; });
  log('reminder', { on: true, h: t.h, m: t.m, from, native: isNative() });
  await syncReminders();
  return isNative() ? 'ok' : 'web';
}
export async function disableReminder(from: 'offer' | 'settings') {
  setState((s) => { s.settings.reminder = { ...(s.settings.reminder || { ...DEFAULT_TIME }), on: false } as Reminder; });
  log('reminder', { on: false, from }); await syncReminders();
}
export function declineOffer() {
  setState((s) => { s.settings.reminder = { ...(s.settings.reminder || { ...DEFAULT_TIME, on: false }), asked: Date.now(), declined: Date.now() } as Reminder; });
  log('reminder', { on: false, declined: true, from: 'offer' });
}
export function downloadIcs() {
  const r = getState().settings.reminder || { ...DEFAULT_TIME, on: false };
  const url = URL.createObjectURL(new Blob([icsFile(r)], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = 'maitre-des-echecs-rappel.ics'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000); log('reminder', { ics: true });
}
let started = false;
export function startReminders() {
  if (started) return; started = true;
  void syncReminders();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncReminders(); });
  // joué aujourd'hui → la pastille s'efface et le rappel du jour est annulé
  let was = playedToday(); setInterval(() => { const p = playedToday(); if (p !== was) { was = p; void syncReminders(); } }, 4000);
  if (isNative()) void ln().then((L) => L.addListener('localNotificationActionPerformed', (a: any) => {
    const id = a?.notification?.id; if (id > ID_BASE && id <= ID_BASE + DAYS_AHEAD) { log('notif_opened', { kind: 'daily', n: a.notification.extra?.n }); location.hash = '#/jour'; }
  })).catch(() => {});
}
