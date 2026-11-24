// Modèle de données versionné (R4a, plan §6) : chaque changement de forme de l'état local passe par une migration
// numérotée, appliquée dans l'ordre au chargement ET à l'import d'une sauvegarde. Une version plus récente que celle
// de l'app (ancienne app en cache) n'est jamais « rétrogradée » : on la laisse telle quelle.
import { ulid } from './ulid';

export const SCHEMA_VERSION = 4;
type Raw = Record<string, any>;
export interface Migration { to: number; note: string; up: (s: Raw) => void }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** jour (local) le plus ancien connu : création de l'état ou première activité enregistrée */
export function earliestDay(s: Raw): string {
  const days: string[] = [];
  if (typeof s.createdAt === 'number' && s.createdAt > 0) days.push(ymd(new Date(s.createdAt)));
  for (const k of [...Object.keys(s.activity || {}), ...Object.keys(s.daily || {})]) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days.push(k);
  return days.sort()[0] || ymd(new Date());
}

export const MIGRATIONS: Migration[] = [
  {
    to: 2,
    note: 'R4a : identifiant d’installation (ULID local) et jour d’installation',
    up(s) {
      if (typeof s.deviceId !== 'string' || !s.deviceId) s.deviceId = ulid();
      if (typeof s.installDay !== 'string' || !s.installDay) s.installDay = earliestDay(s);
    },
  },
  {
    to: 3,
    note: 'R4b : résultats du Coup du jour (calendrier figé, par numéro)',
    up(s) { if (!s.jour || typeof s.jour !== 'object') s.jour = {}; },
  },
  {
    to: 4,
    note: 'R4c : série souple (gels gagnés, réparation, vacances, paliers) ; gels de départ = 1 par tranche de 7 jours de la série en cours (2 au plus)',
    up(s) {
      const st = (s.streak && typeof s.streak === 'object') ? s.streak : (s.streak = { count: 0, best: 0, last: '' });
      st.count = +st.count || 0; st.best = Math.max(+st.best || 0, st.count); st.last = typeof st.last === 'string' ? st.last : '';
      if (typeof st.freezes !== 'number') st.freezes = Math.min(2, Math.floor(st.count / 7));
      st.frozen ||= []; st.goalDays ||= []; st.repair ??= null; st.vacation ??= null; st.notes ||= []; st.cel ??= null;
      // paliers déjà franchis : pas de célébration rétroactive
      st.seen ||= [3, 7, 30, 100, 365].filter((m) => st.best >= m);
    },
  },
];

export interface MigrationResult { state: Raw; from: number; to: number; applied: number[]; future: boolean }
/** Applique les migrations manquantes (ne modifie pas l'objet reçu). */
export function migrate(input: Raw): MigrationResult {
  const s: Raw = structuredClone(input);
  const from = typeof s.v === 'number' && s.v >= 1 ? s.v : 1;
  if (from > SCHEMA_VERSION) return { state: s, from, to: from, applied: [], future: true };
  const applied: number[] = [];
  for (const m of MIGRATIONS) if (m.to > from && m.to <= SCHEMA_VERSION) { m.up(s); s.v = m.to; applied.push(m.to); }
  s.v = Math.max(from, s.v || 1);
  return { state: s, from, to: s.v, applied, future: false };
}
