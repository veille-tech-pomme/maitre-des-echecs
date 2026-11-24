import { useState } from 'preact/hooks';
import { useStore, setState, exportData, importData, resetAll } from '../lib/store';
import { clearEvents, exportJsonl } from '../lib/events';
import { withdrawConsent } from '../lib/consent';
import { lazy } from '../lib/lazy';
import { ReminderSettings } from '../components/ReminderOffer';
const ConsentSheet = lazy<{ onClose: (d: boolean) => void; from?: 'sheet' | 'settings' }>(() => import('../components/ConsentSheet'), 'ConsentSheet', () => <div />);
/** export complet (brief P0 §6) : état + journal (JSON Lines) dans un ZIP (fflate, déjà une dépendance) */
async function exportZip() {
  const { zipSync, strToU8 } = await import('fflate');
  const z = zipSync({ 'etat.json': strToU8(exportData()), 'journal.jsonl': strToU8(await exportJsonl()), 'LISEZMOI.txt': strToU8('Maître des Échecs : export de tes données.\netat.json = ta progression (importable dans Réglages).\njournal.jsonl = ton journal local, un évènement par ligne : {id, dev, sid, t, type, v, data}.\n') });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([z as BlobPart], { type: 'application/zip' })); a.download = `maitre-echecs-donnees-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
}
import { BOARDS, PIECE_SETS, applyAppearance } from '../lib/theme';
import { usePremium, devToggle, providerId } from '../lib/entitlements';
import { setSoundEnabled, play } from '../lib/sound';
import { toast, NavBar, Item } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { Board } from '../components/Board';
import { isNative } from '../lib/platform';

const VERSION = '1.0.0';
export function Settings() {
  const st = useStore((s) => s.settings); const ent = usePremium();
  const [taps, setTaps] = useState(0); const consent = useStore((s) => s.consent); const [askC, setAskC] = useState(false);
  const dev = taps >= 5 || (import.meta as any).env?.DEV || location.search.includes('dev=1');
  const set = (k: keyof typeof st, v: any) => { setState((s) => { (s.settings as any)[k] = v; }); if (k === 'sound') setSoundEnabled(v); setTimeout(applyAppearance, 0); };
  const Toggle = ({ k, label, desc, icon, color }: { k: keyof typeof st; label: string; desc?: string; icon: IconName; color: string }) => (
    <label class="item switch-row"><span class="it-icon" style={{ '--c': color } as any}><Icon name={icon} size={18} /></span><span class="it-main"><span class="it-title">{label}</span>{desc && <span class="it-sub">{desc}</span>}</span><input type="checkbox" class="switch" checked={!!st[k]} onChange={(e) => set(k, (e.target as HTMLInputElement).checked)} /></label>
  );
  return (
    <div class="page settings">
      <NavBar back="#/profile" backLabel="Moi" title="Réglages" />
      <div class="section-label">Profil</div>
      <div class="list"><label class="item field"><span class="it-icon" style="--c:#8E8E93"><Icon name="user" size={18} /></span><span class="it-main"><span class="it-title">Prénom</span></span><input class="inline-input" value={st.name} onInput={(e) => set('name', (e.target as HTMLInputElement).value)} placeholder="Facultatif" maxLength={24} aria-label="Ton prénom" /></label></div>

      <div class="section-label">Apparence</div>
      <section class="card">
        <div class="seg" role="radiogroup" aria-label="Thème">{(['auto', 'light', 'dark'] as const).map((t) => <button role="radio" aria-checked={st.theme === t} class={st.theme === t ? 'on' : ''} onClick={() => set('theme', t)}>{t === 'auto' ? 'Auto' : t === 'light' ? 'Clair' : 'Sombre'}</button>)}</div>
        <div class="preview-board"><Board fen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" viewOnly /></div>
        <h4>Échiquier</h4>
        <div class="swatches">{BOARDS.map((b) => { const lock = b.premium && !ent.premium; return <button class={'swatch ' + (st.board === b.id ? 'on' : '')} aria-label={b.name + (lock ? ' (Premium)' : '')} aria-pressed={st.board === b.id} title={b.name} onClick={() => lock ? (location.hash = '#/premium') : set('board', b.id)} style={{ background: `conic-gradient(${b.dark} 0 25%, ${b.light} 0 50%, ${b.dark} 0 75%, ${b.light} 0)` }}>{lock && <span class="sw-lock"><Icon name="crown" size={12} /></span>}</button>; })}</div>
        <h4>Pièces</h4>
        <div class="chips">{PIECE_SETS.map((p) => { const lock = p.premium && !ent.premium; return <button class={'chip ' + (st.pieces === p.id ? 'on' : '')} aria-pressed={st.pieces === p.id} onClick={() => lock ? (location.hash = '#/premium') : set('pieces', p.id)}>{lock && <Icon name="crown" size={13} />}{p.name}</button>; })}</div>
      </section>

      <div class="section-label">Jeu</div>
      <div class="list">
        <Toggle k="sound" label="Sons" desc="Coups, réussites et erreurs" icon="sound" color="#FF453A" />
        <Toggle k="coords" label="Coordonnées" desc="a–h et 1–8 sur l’échiquier" icon="grid" color="#0A84FF" />
        <Toggle k="showLegal" label="Coups possibles" desc="Points sur les cases accessibles" icon="crosshair" color="#30A46C" />
        <Toggle k="animation" label="Animations des pièces" icon="move" color="#5E5CE6" />
        <Toggle k="reduceMotion" label="Réduire les animations" desc="Accessibilité" icon="eye" color="#8E8E93" />
        <Toggle k="autoQueen" label="Promotion automatique en dame" icon="queen" color="#F2B544" />
        <Toggle k="coachInPlay" label="Coach pendant les parties" desc="Il juge chacun de tes coups" icon="message" color="#30A46C" />
        <Item onClick={() => play('success')} icon="playIcon" color="#FF9F0A" title="Tester le son" chevron={false} />
      </div>

      <div class="section-label">Rappel</div>
      <ReminderSettings />

      <div class="section-label">Données et coach</div>
      <div class="list">
        <label class="item switch-row"><span class="it-icon" style="--c:#5E5CE6"><Icon name="brain" size={18} /></span><span class="it-main"><span class="it-title">Analyse détaillée sur l’appareil</span><span class="it-sub">Temps par coup, hésitations, essais : pour que le coach te comprenne. Rien ne quitte l’appareil.</span></span>
          <input type="checkbox" class="switch detail-switch" checked={!!consent?.detail} onChange={async (e) => { const on = (e.target as HTMLInputElement).checked;
            if (on) { (e.target as HTMLInputElement).checked = false; setAskC(true); return; }
            await withdrawConsent(confirm('Analyse détaillée arrêtée. Effacer aussi les données détaillées déjà enregistrées ?')); toast('Analyse détaillée arrêtée', 'info'); }} /></label>
        <Item href="#/dev/events" icon="eye" color="#0A84FF" title="Voir ce que le coach sait de moi" sub="Nombre d’évènements, taille, date du plus ancien" />
        <Item onClick={() => { void exportZip(); }} icon="download" color="#30A46C" title="Exporter mes données" sub="Un ZIP : ta progression et ton journal" chevron={false} />
      </div>
      {consent?.ageBand === '<13' && <p class="list-foot">Moins de 13 ans : aucun envoi vers un serveur ne sera jamais proposé.</p>}
      {askC && <ConsentSheet from="settings" onClose={() => setAskC(false)} />}

      <div class="section-label">Données</div>
      <div class="list">
        <Item onClick={() => { const b = new Blob([exportData()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `maitre-echecs-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }} icon="download" color="#0A84FF" title="Exporter ma progression" sub="Un fichier à garder ou à importer sur un autre appareil" chevron={false} />
        <label class="item"><span class="it-icon" style="--c:#30A46C"><Icon name="upload" size={18} /></span><span class="it-main"><span class="it-title">Importer une sauvegarde</span></span><input type="file" accept="application/json" class="sr-only" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; try { importData(await f.text()); applyAppearance(); toast('Progression restaurée', 'checkCircle'); } catch (err: any) { toast(err.message, 'info'); } }} /></label>
        <Item onClick={() => { if (confirm('Effacer toute ta progression ? Cette action est irréversible.')) { resetAll(); void clearEvents(); applyAppearance(); toast('Progression effacée', 'trash'); } }} icon="trash" color="#FF453A" title={<span class="danger-text">Tout effacer</span>} chevron={false} />
        <Item href="#/serie" icon="flame" color="#FF9F0A" title="Ma série" sub="Gels, vacances, affichage" />
        <Item href="#/dev/metrics" icon="chart" color="#5E5CE6" title="Mes mesures" sub="Est-ce que je reviens ? Calculé ici, rien n’est envoyé" />
      </div>
      <p class="list-foot">Ta progression reste sur cet appareil : aucun compte, aucune publicité, aucun traceur.</p>

      <div class="section-label">Abonnement</div>
      <div class="list"><Item href="#/premium" icon="crown" color="#F2B544" title={ent.premium ? 'Premium actif' : 'Découvrir Premium'} sub={ent.premium ? `${ent.plan === 'lifetime' ? 'À vie' : ent.plan === 'annual' ? 'Annuel' : 'Mensuel'}${ent.trialEndsAt && ent.trialEndsAt > Date.now() ? ` · essai jusqu’au ${new Date(ent.trialEndsAt).toLocaleDateString('fr-FR')}` : ''}` : 'Ta progression reste gratuite, pour toujours'} /></div>

      <div class="section-label">À propos</div>
      <div class="list">
        <Item href="#/privacy" icon="shield" color="#30A46C" title="Confidentialité" />
        <div class="item"><span class="it-icon" style="--c:#8E8E93"><Icon name="info" size={18} /></span><span class="it-main"><span class="it-title">Version</span></span><span class="it-val" onClick={() => setTaps(taps + 1)}>{VERSION} · {isNative() ? 'iOS' : 'Web'}</span></div>
      </div>
      <p class="list-foot">Moteur Stockfish 18 (GPLv3) · échiquier chessground (GPLv3, Lichess) · règles chess.js (BSD) · puzzles Lichess (CC0) · icônes Lucide (ISC) · pièces sous licences libres (voir LICENCES.md). Paiement : {providerId()}.</p>
      {dev && (
        <>
          <div class="section-label">Développeur</div>
          <div class="list dev">
            <label class="item switch-row"><span class="it-icon" style="--c:#FF9F0A"><Icon name="code" size={18} /></span><span class="it-main"><span class="it-title">Débloquer Premium (test)</span><span class="it-sub">Simule un abonnement annuel avec essai, sans paiement.</span></span><input type="checkbox" class="switch" checked={ent.premium && ent.source === 'dev'} onChange={(e) => devToggle((e.target as HTMLInputElement).checked).then(applyAppearance)} /></label>
            <Item onClick={() => setState((s) => { for (const k of ['debutant', 'intermediaire', 'avance', 'expert']) s.lessons['unlock-' + k] = { done: false, stars: 0, step: 0 }; })} icon="lockOpen" color="#FF9F0A" title="Débloquer toutes les leçons" chevron={false} />
          </div>
        </>
      )}
    </div>
  );
}
