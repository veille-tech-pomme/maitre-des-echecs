// Rappel de fin d'essai gratuit : notification locale (iOS natif) + bandeau dans l'app (toutes plateformes).
import { isNative } from './platform';
const K = 'echecs-trial-reminder';
const DAY = 86400000;
export async function scheduleTrialReminder(trialEndsAt: number) {
  const at = trialEndsAt - 2 * DAY;
  const prev = JSON.parse(localStorage.getItem(K) || 'null');
  if (prev && prev.trialEndsAt === trialEndsAt) return;
  localStorage.setItem(K, JSON.stringify({ trialEndsAt, at, dismissed: false }));
  if (isNative() && at > Date.now()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') await LocalNotifications.schedule({ notifications: [{ id: 7001, title: 'Ton essai Premium se termine dans 2 jours', body: 'Sans action de ta part, l’abonnement annuel (29,99 €/an) démarrera. Tu peux l’annuler à tout moment dans les réglages de l’App Store.', schedule: { at: new Date(at) } }] });
    } catch (e) { console.warn('notification', e); }
  }
}
/** Renvoie le rappel à afficher dans l'app (2 jours avant la fin de l'essai), ou null. */
export function trialBanner(): { endsAt: number } | null {
  try { const r = JSON.parse(localStorage.getItem(K) || 'null'); if (!r || r.dismissed) return null; const now = Date.now(); if (now >= r.at && now < r.trialEndsAt) return { endsAt: r.trialEndsAt }; } catch {}
  return null;
}
export function dismissTrialBanner() { try { const r = JSON.parse(localStorage.getItem(K) || 'null'); if (r) { r.dismissed = true; localStorage.setItem(K, JSON.stringify(r)); } } catch {} }
