// Feuille « Ajouter à l'écran d'accueil » (R4d, plan §2.11) : montrée UNE fois, après le 1er Coup du jour réussi,
// sur le web seulement (ni app native, ni PWA déjà installée). Chromium : invite d'installation du navigateur ;
// iOS Safari : les deux gestes à faire. « Plus tard » a le même poids que « Installer ».
import { useState } from 'preact/hooks';
import { Icon } from './Icon';
import { getState, setState } from '../lib/store';
import { isIOS, isNative, isStandalone, installPrompt, clearInstallPrompt } from '../lib/platform';
import { log as logEv, flushEvents } from '../lib/events';
const log = (t: 'install', d: Record<string, unknown>) => { logEv(t, d); void flushEvents(); };


/** la feuille doit-elle s'ouvrir ? (1re réussite notée du Coup du jour, jamais montrée, web non installé) */
export function wantInstallSheet(ok: boolean) {
  const s = getState(); if (!ok || isNative() || isStandalone() || s.settings.installAsked) return false;
  return Object.values(s.jour || {}).filter((r) => r.ok).length <= 1;
}
export function InstallSheet({ onClose }: { onClose: () => void }) {
  const bip = installPrompt();
  const [shown] = useState(() => { setState((s) => { s.settings.installAsked = Date.now(); }); log('install', { shown: true, ios: isIOS(), prompt: !!bip }); return true; });
  void shown;
  const close = (accepted: boolean | null) => { log('install', { accepted }); onClose(); };
  const install = async () => {
    if (!bip) return close(null);
    try { bip.prompt(); const c = await bip.userChoice; clearInstallPrompt(); close(c?.outcome === 'accepted'); } catch { close(null); }
  };
  return (
    <div class="inst-sheet" role="dialog" aria-modal="true" aria-labelledby="is-title">
      <div class="cs-card">
        <span class="is-icon"><Icon name="smartphone" size={30} /></span>
        <h2 id="is-title">Garde ton coach à portée de pouce</h2>
        <p>Sur l’écran d’accueil, l’app s’ouvre en plein écran, marche hors ligne et ton Coup du jour t’attend en un geste.</p>
        {isIOS() ? <ol class="is-steps"><li>Touche <b>Partager</b> <Icon name="share" size={16} /> en bas de Safari.</li><li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li></ol>
          : !bip && <p class="muted small">Dans Chrome ou Edge : menu ⋮ → <b>Installer l’application</b> (ou l’icône dans la barre d’adresse).</p>}
        <div class="cs-btns">
          {bip ? <button class="btn cs-yes is-ok" onClick={install}>Installer</button> : <button class="btn cs-yes is-ok" onClick={() => close(null)}>C’est noté</button>}
          <button class="btn cs-no is-later" onClick={() => close(false)}>Plus tard</button>
        </div>
      </div>
    </div>
  );
}
