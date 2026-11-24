// Feuille de consentement (brief P0 §6) : plein écran, une fois, boutons de poids visuel égal, rien de pré-coché.
import { useState } from 'preact/hooks';
import { CONSENT_TITLE, CONSENT_TEXT, AGE_13P, AGE_U13, setConsent } from '../lib/consent';

export function ConsentSheet({ onClose, from = 'sheet' }: { onClose: (detail: boolean) => void; from?: 'sheet' | 'settings' }) {
  const [age, setAge] = useState<'13+' | '<13' | null>(null);
  const [need, setNeed] = useState(false);
  const answer = (detail: boolean) => {
    if (detail && !age) { setNeed(true); return; } // l'âge est demandé pour dire oui
    setConsent(detail, age ?? undefined, from); onClose(detail);
  };
  return (
    <div class="consent-sheet" role="dialog" aria-modal="true" aria-labelledby="cs-title" aria-describedby="cs-text">
      <div class="cs-card">
        <h2 id="cs-title">{CONSENT_TITLE}</h2>
        <p id="cs-text">{CONSENT_TEXT}</p>
        <fieldset class="cs-age" aria-invalid={need && !age}>
          <legend class="sr-only">Ton âge</legend>
          {([['13+', AGE_13P], ['<13', AGE_U13]] as const).map(([v, l]) => (
            <label class={'cs-opt' + (age === v ? ' on' : '')}><input type="radio" name="cs-age" value={v} checked={age === v} onChange={() => { setAge(v); setNeed(false); }} />{l}</label>
          ))}
          {need && !age && <p class="cs-need" role="alert">Indique d’abord ton âge.</p>}
        </fieldset>
        <div class="cs-btns">
          <button class="btn cs-yes" onClick={() => answer(true)}>Oui, d’accord</button>
          <button class="btn cs-no" onClick={() => answer(false)}>Non merci</button>
        </div>
      </div>
    </div>
  );
}
