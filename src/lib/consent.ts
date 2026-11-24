// Consentement à l'analyse détaillée sur l'appareil (brief P0 §6). Texte versionné (textV) : tout changement de texte
// incrémente CONSENT_TEXT_V. Chaque décision écrit un évènement `consent` (base : toujours écrit, jamais compacté).
import { getState, setState, type Consent } from './store';
import { log, eraseTier } from './events';

export const CONSENT_TEXT_V = 1;
export const CONSENT_TITLE = 'Aide ton coach à mieux te comprendre';
export const CONSENT_TEXT = 'Avec ton accord, l’app enregistre sur ce téléphone comment tu joues : le temps passé sur chaque coup, les pièces que tu hésites à jouer, tes essais dans les puzzles. Ton coach s’en sert pour te conseiller. Rien ne quitte ton appareil. Tu peux tout voir, exporter ou effacer dans Réglages.';
export const AGE_13P = 'J’ai 13 ans ou plus', AGE_U13 = 'J’ai moins de 13 ans';
export const REASK_MS = 7 * 86400e3;

/** Montrer la feuille ? Jamais avant la fin de l'accueil ; une fois ; si « Non », une seule nouvelle demande après 7 jours. */
export function shouldAskConsent(s = getState(), now = Date.now()): boolean {
  if (!s.onboarded) return false;
  const c = s.consent;
  if (!c) return true;
  return !c.detail && (c.asked || 1) < 2 && now - c.at >= REASK_MS;
}
export function setConsent(detail: boolean, ageBand: '13+' | '<13' | undefined, from: 'sheet' | 'settings') {
  const prev = getState().consent;
  const c: Consent = { detail, upload: false, ageBand: ageBand ?? prev?.ageBand, at: Date.now(), textV: CONSENT_TEXT_V, asked: (prev?.asked || 0) + (from === 'sheet' ? 1 : 0) };
  setState((s) => { s.consent = c; });
  // upload : verrouillé à false en P0 (et toujours pour les moins de 13 ans)
  log('consent', { detail, upload: false, ageBand: c.ageBand ?? null, textV: CONSENT_TEXT_V, from });
  if (detail) (navigator as any).storage?.persist?.().catch?.(() => {});
  return c;
}
/** retrait de l'accord depuis les Réglages ; `erase` : efface aussi les données détaillées déjà écrites */
export async function withdrawConsent(erase: boolean) { setConsent(false, undefined, 'settings'); if (erase) await eraseTier('detail'); }
