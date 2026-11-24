// Rappels (R4d, plan §2.11, lignes rouges §9.3 et §9.8) — sans serveur, sans traceur, rien ne quitte l'appareil.
// - OPT-IN uniquement : désactivé par défaut ; jamais proposé automatiquement avant 13 ans (activable dans Réglages).
// - Au plus 1 rappel par jour, à l'heure choisie (07:00–21:30), écrit par le coach, utile, jamais culpabilisant.
// - App iOS (Capacitor) : notifications LOCALES programmées pour les 7 prochains jours, reprogrammées à chaque
//   ouverture ; celle du jour est annulée dès que le joueur a joué.
// - Web : pas de notification fiable sans serveur (Notification Triggers n'a jamais été livré, le Web Push exige un
//   serveur VAPID — phase 2). Repli : pastille d'icône (Badging API, app installée) + événement d'agenda .ics récurrent.
// - Le rappel de fin d'essai Premium (notify.ts, id 7001) n'est jamais touché ici.
import { stars, starStr, type DailyEntry } from './daily';
import { dateOf, numberOf } from './daily-num';

export interface Reminder { on: boolean; h: number; m: number; asked?: number; declined?: number; badge?: boolean }
export const DEFAULT_TIME = { h: 18, m: 30 };
export const EARLIEST = 7 * 60, LATEST = 21 * 60 + 30;
export const DAYS_AHEAD = 7, ID_BASE = 7100; // ids 7101..7107 ; 7001 = essai Premium (notify.ts)
export const clampTime = (h: number, m: number) => { const t = Math.min(LATEST, Math.max(EARLIEST, Math.round(h) * 60 + Math.round(m / 5) * 5)); return { h: Math.floor(t / 60), m: t % 60 }; };
export const hhmm = (r: { h: number; m: number }) => `${String(r.h).padStart(2, '0')}:${String(r.m).padStart(2, '0')}`;
export const isMinor = (s: { consent?: { ageBand?: string } }) => s.consent?.ageBand === '<13';
/** proposer le rappel (fin de séance) : jamais aux moins de 13 ans, une seule fois, jamais s'il est déjà actif */
export function shouldOffer(s: { consent?: { ageBand?: string }; settings: { reminder?: Reminder } }) {
  const r = s.settings.reminder; return !isMinor(s) && !r?.on && !r?.asked && !r?.declined;
}
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOTIF: Record<string, string> = { smotheredMate: 'un mat étouffé', doubleCheck: 'un échec double', sacrifice: 'une combinaison', quietMove: 'un coup tranquille', deflection: 'une combinaison', attraction: 'une combinaison', clearance: 'une combinaison', interference: 'une combinaison', xRayAttack: 'une combinaison' };
/** texte du coach pour le jour `date` : le Coup du jour annoncé (sans spoiler), sinon une invitation sobre */
export function reminderText(date: string, e?: Pick<DailyEntry, 'n' | 'theme' | 'rating'> | null, name = '') {
  const wd = WD[new Date(date + 'T12:00:00').getDay()];
  if (e) {
    const m = /^mateIn(\d)$/.exec(e.theme); const what = m ? `un mat en ${m[1]}` : MOTIF[e.theme] || 'une combinaison';
    return { title: `Coup du jour #${e.n} · ${starStr(e.rating)}`, body: `${name ? name + ', ton' : 'Ton'} coach a choisi ${what} pour ce ${wd}${stars(e.rating) >= 4 ? ', un beau défi' : ''}. Cinq minutes suffisent.` };
  }
  return { title: 'Tes 5 minutes d’échecs', body: `${name ? name + ', ton' : 'Ton'} coach t’a préparé une courte séance pour ce ${wd}.` };
}
/** prochains jours à programmer : aujourd'hui seulement si l'heure n'est pas passée et que le joueur n'a pas encore joué */
export function plan(now: Date, r: Reminder, playedToday: boolean, days = DAYS_AHEAD): { id: number; at: Date; date: string; n: number }[] {
  const out = [];
  for (let i = 0; i < days + 1 && out.length < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, r.h, r.m, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    if (i === 0 && playedToday) continue;
    const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    out.push({ id: ID_BASE + 1 + out.length, at, date, n: numberOf(date) });
  }
  return out;
}
/** événement d'agenda récurrent (.ics, RFC 5545) : rappel quotidien géré par l'agenda du joueur, sans serveur */
export function icsFile(r: Reminder, start = new Date(), url = 'https://veille-tech-pomme.github.io/maitre-des-echecs/#/jour') {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, r.h, r.m);
  const f = (x: Date) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
  const end = new Date(d.getTime() + 10 * 60000);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maitre des Echecs//Rappel//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:rappel-quotidien@maitre-des-echecs`, `DTSTAMP:${stamp}`, `DTSTART:${f(d)}`, `DTEND:${f(end)}`, 'RRULE:FREQ=DAILY',
    'SUMMARY:10 min d’échecs', `DESCRIPTION:Le Coup du jour et ta séance de 5 minutes t’attendent. ${url}`, `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:10 min d’échecs', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
export { dateOf };
