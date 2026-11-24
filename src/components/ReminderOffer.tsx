// Proposition de rappel en fin de séance (R4d, plan §2.1/§2.11) : opt-in, une seule fois, jamais avant 13 ans.
// Le joueur choisit l'heure ; « Non merci » a le même poids que « Oui ». Rien n'est pré-activé.
import { useState } from 'preact/hooks';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { shouldOffer, hhmm, DEFAULT_TIME } from '../lib/reminders';
import { enableReminder, disableReminder, declineOffer, downloadIcs, type EnableResult } from '../lib/reminders-run';
import { isNative } from '../lib/platform';

export function TimeInput({ value, onChange, id }: { value: string; onChange: (h: number, m: number) => void; id: string }) {
  return <input id={id} class="rm-time" type="time" min="07:00" max="21:30" step={300} value={value}
    onChange={(e) => { const [h, m] = (e.currentTarget.value || '18:30').split(':').map(Number); onChange(h, m); }} />;
}
export function WebReminderNote() {
  return (<div class="rm-web">
    <p class="muted small">Sur le web, je ne peux pas t’envoyer de notification sans serveur (et je n’en utilise pas). Deux options sans rien envoyer :</p>
    <button class="btn secondary rm-ics" onClick={downloadIcs}><Icon name="calendar" size={18} />Ajouter à mon agenda (.ics)</button>
    <p class="muted small">Une fois l’app installée, son icône affiche une pastille tant que le Coup du jour n’est pas joué.</p>
  </div>);
}
export function ReminderOffer() {
  const s = useStore((x) => x);
  const [t, setT] = useState({ ...DEFAULT_TIME });
  const [res, setRes] = useState<EnableResult | 'no' | null>(null);
  if (!res && !shouldOffer(s)) return null;
  return (
    <div class="card rm-offer" aria-live="polite">
      {res === 'ok' ? <p class="rm-done"><Icon name="check" size={18} />C’est noté : un seul rappel par jour, à {hhmm(t)}. Tu peux l’arrêter dans Réglages.</p>
        : res === 'web' ? <><p class="rm-done"><Icon name="check" size={18} />Rappel noté pour {hhmm(t)}.</p><WebReminderNote /></>
        : res === 'denied' ? <p class="muted small">Les notifications sont refusées dans les réglages de ton téléphone. Pas de souci : tu peux changer d’avis plus tard.</p>
        : res === 'no' ? <p class="muted small">Pas de rappel. Tu peux en activer un quand tu veux dans Réglages.</p>
        : <>
          <p class="rm-q"><b>Un petit rappel demain ?</b> Un seul par jour, à l’heure de ton choix, avec le Coup du jour. Jamais de reproche.</p>
          <label class="rm-row" for="rm-offer-time"><span>Heure</span><TimeInput id="rm-offer-time" value={hhmm(t)} onChange={(h, m) => setT({ h, m })} /></label>
          <div class="cs-btns">
            <button class="btn cs-yes rm-yes" onClick={async () => setRes(await enableReminder(t.h, t.m, 'offer'))}>Oui, à {hhmm(t)}</button>
            <button class="btn cs-no rm-no" onClick={() => { declineOffer(); setRes('no'); }}>Non merci</button>
          </div>
          {!isNative() && <p class="muted small">Sur le web : pastille d’icône et agenda, sans notification.</p>}
        </>}
    </div>
  );
}
/** Réglages → Rappel : interrupteur, heure, et sur le web les options sans serveur. Coupé en un geste. */
export function ReminderSettings() {
  const s = useStore((x) => x); const r = s.settings.reminder; const on = !!r?.on;
  const t = r ? { h: r.h, m: r.m } : { ...DEFAULT_TIME };
  const [denied, setDenied] = useState(false);
  const minor = s.consent?.ageBand === '<13';
  return (<>
    <div class="list rm-settings">
      <label class="item switch-row"><span class="it-icon" style="--c:#FF9F0A"><Icon name="bell" size={18} /></span><span class="it-main"><span class="it-title">Rappel quotidien</span><span class="it-sub">{on ? `Un seul par jour, à ${hhmm(t)}, écrit par ton coach` : 'Désactivé'}</span></span>
        <input type="checkbox" class="switch rm-switch" checked={on} onChange={async (e) => { const v = (e.target as HTMLInputElement).checked;
          if (v) { const res = await enableReminder(t.h, t.m, 'settings'); setDenied(res === 'denied'); } else await disableReminder('settings'); }} /></label>
      {on && <label class="item field" for="rm-set-time"><span class="it-icon" style="--c:#8E8E93"><Icon name="clock" size={18} /></span><span class="it-main"><span class="it-title">Heure du rappel</span></span><TimeInput id="rm-set-time" value={hhmm(t)} onChange={(h, m) => { void enableReminder(h, m, 'settings'); }} /></label>}
    </div>
    {denied && <p class="list-foot" role="alert">Les notifications sont refusées dans les réglages du téléphone.</p>}
    {on && !isNative() && <div class="list-foot"><WebReminderNote /></div>}
    <p class="list-foot">Jamais de reproche, jamais la nuit (07:00–21:30), rien n’est envoyé à un serveur.{minor ? ' Moins de 13 ans : le rappel n’est jamais proposé, tu peux l’activer ici si tu le souhaites.' : ''}</p>
  </>);
}
