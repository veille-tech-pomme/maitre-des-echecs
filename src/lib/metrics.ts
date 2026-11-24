// Mesures locales (R4a, plan §2.13) : rétention J1/J7/J30 de CET appareil, calculée sur l'appareil à partir du journal
// d'évènements (events.ts) et, pour les joueurs d'avant le journal, de l'historique d'activité déjà stocké.
// Définition (plan §4) : « revenu au moins une fois ce jour-là » → Jn = actif le n-ième jour local après l'installation.
// Aucun envoi : ce module ne fait que des calculs.
import type { AppEvent } from './events';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** jour local + n jours (passage heure d'été / d'hiver compris : on compte en jours calendaires) */
export function addDays(day: string, n: number): string { const [y, m, d] = day.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
/** semaine ISO 8601 d'un jour (« 2026-W48 ») : cohorte d'installation */
export function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); const wd = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - wd); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((+t - +y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

export type Ret = 'yes' | 'no' | 'pending';
export interface LocalMetrics {
  installDay: string; cohort: string; today: string; age: number;
  activeDays: string[]; sources: { eventDays: number; legacyDays: number };
  /** J1/J7/J30 exacts (actif CE jour-là) et « au moins une fois dans les n premiers jours » */
  ret: Record<'d1' | 'd7' | 'd30', Ret>; within: Record<'d7' | 'd30', Ret>;
  /** activité des 31 premiers jours (0 = jour d'installation) ; null = jour futur */
  curve: (boolean | null)[];
  last30: { day: string; active: boolean }[];
  sessions: number; sessionsPerActiveDay: number; minutes: number; minutesPerActiveDay: number;
  dailyPlayedDays: number; shares: number; cards: { served: number; ok: number };
  byType: Record<string, number>; events: number; firstEvent: number | null;
}

/** Jours actifs : tout évènement (ouverture, carte, …) + jours d'activité XP / puzzle du jour hérités de l'état. */
export function activeDaysOf(events: AppEvent[], legacy: { activity?: Record<string, number>; daily?: Record<string, boolean> } = {}) {
  const ev = new Set(events.map((e) => ymd(new Date(e.t))));
  const leg = new Set([...Object.keys(legacy.activity || {}), ...Object.keys(legacy.daily || {}).filter((k) => legacy.daily![k])].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)));
  const all = new Set([...ev, ...leg]);
  return { days: [...all].sort(), eventDays: ev.size, legacyDays: [...leg].filter((d) => !ev.has(d)).length };
}

export function computeMetrics(events: AppEvent[], st: { installDay: string; activity?: Record<string, number>; daily?: Record<string, boolean> }, now = new Date()): LocalMetrics {
  const td = ymd(now); const { days, eventDays, legacyDays } = activeDaysOf(events, st);
  // jour d'installation : celui de l'état, ou plus tôt si l'historique en montre un antérieur
  const installDay = [st.installDay, days[0]].filter(Boolean).sort()[0] || td;
  const act = new Set(days); const age = daysBetween(installDay, td);
  const exact = (n: number): Ret => (age < n ? 'pending' : act.has(addDays(installDay, n)) ? 'yes' : 'no');
  const within = (n: number): Ret => { for (let i = 1; i <= Math.min(n, age); i++) if (act.has(addDays(installDay, i))) return 'yes'; return age < n ? 'pending' : 'no'; };
  const curve = Array.from({ length: 31 }, (_, i) => (i > age ? null : act.has(addDays(installDay, i))));
  const last30 = Array.from({ length: 30 }, (_, i) => { const d = addDays(td, i - 29); return { day: d, active: act.has(d) }; });
  const byType: Record<string, number> = {}; for (const e of events) byType[e.type] = (byType[e.type] || 0) + 1;
  const ends = events.filter((e) => e.type === 'session_end' && !e.data.kind); // sessions d'usage (pas la séance de 5 min)
  const minutes = Math.round(ends.reduce((a, e) => a + Math.min(Number(e.data.ms) || 0, 4 * 3600e3), 0) / 60000);
  const sessions = byType.app_open || 0;
  const evActive = Math.max(1, eventDays);
  const dailyDays = new Set(events.filter((e) => e.type === 'daily_played').map((e) => ymd(new Date(e.t))));
  for (const [k, v] of Object.entries(st.daily || {})) if (v) dailyDays.add(k);
  const results = events.filter((e) => e.type === 'card_result');
  return {
    installDay, cohort: isoWeek(installDay), today: td, age, activeDays: days, sources: { eventDays, legacyDays },
    ret: { d1: exact(1), d7: exact(7), d30: exact(30) }, within: { d7: within(7), d30: within(30) },
    curve, last30, sessions, sessionsPerActiveDay: +(sessions / evActive).toFixed(2), minutes, minutesPerActiveDay: +(minutes / evActive).toFixed(1),
    dailyPlayedDays: dailyDays.size, shares: byType.share || 0, cards: { served: byType.card_served || 0, ok: results.filter((e) => e.data.out === 'ok').length },
    byType, events: events.length, firstEvent: events[0]?.t ?? null,
  };
}
