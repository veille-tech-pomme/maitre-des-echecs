// Série souple (R4c, plan §2.3) : une seule réussite valide la journée (l'objectif de 12 cartes reste séparé).
// - Gels GAGNÉS en jouant : 1 tous les 7 jours de série, 2 au plus. Jamais vendus (ligne rouge §9.2).
// - Un jour manqué est couvert par un gel au lancement suivant, et on le dit (« Ton gel a protégé mardi ❄️ »).
// - Sans gel : 48 h pour réparer en faisant 2 jours d'objectif complet (aujourd'hui et demain). Ça se mérite en jouant.
// - Mode vacances : jusqu'à 7 jours de pause déclarés, sans rien perdre.
// - Paliers 3, 7, 30, 100, 365 : célébration, carte partageable, titre.
// Fonctions pures sur l'objet `streak` de l'état (testables sans navigateur). Jours = AAAA-MM-JJ locaux.
export interface Repair { prev: number; lost: string; start: string; until: string; done: string[] }
export type StreakNote = { k: 'freeze'; day: string } | { k: 'broken'; prev: number; repair: boolean } | { k: 'earned'; n: number } | { k: 'repaired'; count: number } | { k: 'vacation-end' };
export interface Streak {
  count: number; best: number; last: string;
  freezes?: number; frozen?: string[]; goalDays?: string[];
  repair?: Repair | null; vacation?: { from: string; to: string } | null;
  seen?: number[]; cel?: number | null; notes?: StreakNote[];
}
export const MAX_FREEZES = 2, FREEZE_EVERY = 7, VACATION_MAX = 7, REPAIR_DAYS = 2, REPAIR_MAX_GAP = 2;
export const MILESTONES = [3, 7, 30, 100, 365];
export const TITLES: Record<number, string> = { 3: 'Régulier', 7: 'Une semaine', 30: 'Un mois', 100: 'Centurion', 365: 'Une année' };
const DAY = 86_400_000;
const utc = (d: string) => { const [y, m, j] = d.split('-').map(Number); return Date.UTC(y, m - 1, j); };
export function addDays(d: string, n: number) { return new Date(utc(d) + n * DAY).toISOString().slice(0, 10); }
export const dayDiff = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);
export const inVacation = (st: Streak, d: string) => !!st.vacation && d >= st.vacation.from && d <= st.vacation.to;
const note = (st: Streak, n: StreakNote) => { (st.notes ||= []).push(n); if (st.notes.length > 8) st.notes.shift(); };

/** couvre les jours manqués entre `last` et aujourd'hui (vacances, puis gels) ; sinon la série s'arrête (réparation possible) */
export function reconcile(st: Streak, today: string): StreakNote[] {
  const before = st.notes?.length || 0;
  st.freezes ??= 0; st.frozen ??= [];
  if (st.repair && today > st.repair.until) st.repair = null; // fenêtre de réparation passée
  if (st.last && st.count > 0) {
    for (let d = addDays(st.last, 1); d < today; d = addDays(d, 1)) {
      if (inVacation(st, d)) { st.last = d; continue; }
      if (st.freezes > 0) { st.freezes--; st.frozen.push(d); if (st.frozen.length > 60) st.frozen.shift(); st.last = d; note(st, { k: 'freeze', day: d }); continue; }
      const repair = dayDiff(d, today) <= REPAIR_MAX_GAP;
      if (repair) st.repair = { prev: st.count, lost: d, start: today, until: addDays(today, REPAIR_DAYS - 1), done: [] };
      note(st, { k: 'broken', prev: st.count, repair });
      st.count = 0; break;
    }
  }
  if (st.vacation && st.vacation.to < today) st.vacation = null; // appliquées ci-dessus, puis retirées
  return (st.notes || []).slice(before);
}
export interface HitResult { count: number; milestone?: number; earned?: boolean; repaired?: boolean }
/** une réussite aujourd'hui : la journée est validée (une fois par jour) */
export function hit(st: Streak, today: string): HitResult | null {
  reconcile(st, today);
  if (st.last === today) return null;
  st.count = st.last === addDays(today, -1) && st.count > 0 ? st.count + 1 : 1;
  st.last = today; st.best = Math.max(st.best, st.count);
  const r: HitResult = { count: st.count };
  if (st.count % FREEZE_EVERY === 0 && (st.freezes || 0) < MAX_FREEZES) { st.freezes = (st.freezes || 0) + 1; r.earned = true; note(st, { k: 'earned', n: st.count }); }
  if (MILESTONES.includes(st.count) && !(st.seen ||= []).includes(st.count)) { st.seen.push(st.count); st.cel = st.count; r.milestone = st.count; }
  return r;
}
/** branchements (journal) posés par streak-sync ; vides dans les tests */
export const streakHooks: { repaired?: (count: number) => void } = {};
/** objectif du jour atteint (12 cartes du fil) : compte pour la réparation */
export function markGoal(st: Streak, day: string): boolean {
  const g = (st.goalDays ||= []); if (!g.includes(day)) { g.push(day); if (g.length > 14) g.shift(); }
  const rp = st.repair;
  if (!rp || day < rp.start || day > rp.until || rp.done.includes(day)) return false;
  rp.done.push(day);
  if (rp.done.length < REPAIR_DAYS) return false;
  st.count = rp.prev + st.count; st.best = Math.max(st.best, st.count); st.repair = null;
  note(st, { k: 'repaired', count: st.count }); streakHooks.repaired?.(st.count);
  return true;
}
export function startVacation(st: Streak, today: string, days: number) {
  reconcile(st, today);
  const n = Math.max(1, Math.min(VACATION_MAX, Math.round(days)));
  st.vacation = { from: today, to: addDays(today, n - 1) };
  return st.vacation;
}
export function endVacation(st: Streak, today: string) {
  reconcile(st, today);
  // les jours de vacances déjà passés restent couverts (reconcile a avancé `last`) ; aujourd'hui, une réussite suffit
  st.vacation = null; note(st, { k: 'vacation-end' });
}
/** série en cours vue d'aujourd'hui, sans modifier l'état */
export function project(st: Streak, today: string): Streak { const c: Streak = JSON.parse(JSON.stringify(st)); reconcile(c, today); return c; }
export function alive(st: Streak, today: string) { const p = project(st, today); return p.count > 0 && (p.last === today || p.last === addDays(today, -1) || inVacation(p, today)); }
/** la série attend une réussite aujourd'hui (mission « sauve ta série ») */
export function atRisk(st: Streak, today: string) { const p = project(st, today); return p.count > 0 && p.last === addDays(today, -1) && !inVacation(p, today); }
export const titleFor = (best: number) => { let t = ''; for (const m of MILESTONES) if (best >= m) t = TITLES[m]; return t; };
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const weekdayFr = (d: string) => WD[new Date(utc(d)).getUTCDay()];
/** textes des notes : informatifs, jamais culpabilisants (ligne rouge §9.3) */
export function noteText(n: StreakNote): string {
  switch (n.k) {
    case 'freeze': return `Ton gel a protégé ${weekdayFr(n.day)} ❄️`;
    case 'broken': return n.repair ? `Ta série de ${n.prev} jour${n.prev > 1 ? 's' : ''} est en pause. Tu peux la réparer : atteins ton objectif du jour aujourd’hui et demain.` : `Nouvelle série à partir d’aujourd’hui. Ton record reste.`;
    case 'earned': return `${n.n} jours de suite : tu gagnes un gel ❄️`;
    case 'repaired': return `Série réparée : ${n.count} jours 🔥`;
    case 'vacation-end': return 'Bon retour !';
  }
}
/** mineurs (plan §5, DSA art. 28) : la série est masquée par défaut, activable */
export const streakVisible = (s: { settings: { streakShow?: boolean }; consent?: { ageBand?: string } }) => s.settings.streakShow ?? s.consent?.ageBand !== '<13';
