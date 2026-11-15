import { useState } from 'preact/hooks';
import { useStore, setState, exportData, importData, resetAll } from '../lib/store';
import { BOARDS, PIECE_SETS, applyAppearance } from '../lib/theme';
import { usePremium, devToggle, providerId } from '../lib/entitlements';
import { setSoundEnabled, play } from '../lib/sound';
import { toast } from '../components/ui';
import { Board } from '../components/Board';
import { isNative } from '../lib/platform';

const VERSION = '1.0.0';
export function Settings() {
  const st = useStore((s) => s.settings); const ent = usePremium();
  const [taps, setTaps] = useState(0);
  const dev = taps >= 5 || (import.meta as any).env?.DEV || location.search.includes('dev=1');
  const set = (k: keyof typeof st, v: any) => { setState((s) => { (s.settings as any)[k] = v; }); if (k === 'sound') setSoundEnabled(v); setTimeout(applyAppearance, 0); };
  const Toggle = ({ k, label, desc }: { k: keyof typeof st; label: string; desc?: string }) => (
    <label class="switch-row"><input type="checkbox" checked={!!st[k]} onChange={(e) => set(k, (e.target as HTMLInputElement).checked)} /><span><b>{label}</b>{desc && <small class="muted">{desc}</small>}</span></label>
  );
  return (
    <div class="page settings">
      <h1>Réglages</h1>
      <section class="card">
        <h2>Profil</h2>
        <label>Ton prénom<input value={st.name} onInput={(e) => set('name', (e.target as HTMLInputElement).value)} placeholder="Facultatif" maxLength={24} /></label>
      </section>
      <section class="card">
        <h2>Apparence</h2>
        <div class="seg">{(['auto', 'light', 'dark'] as const).map((t) => <button class={st.theme === t ? 'on' : ''} onClick={() => set('theme', t)}>{t === 'auto' ? '🌓 Auto' : t === 'light' ? '☀️ Clair' : '🌙 Sombre'}</button>)}</div>
        <h4>Échiquier</h4>
        <div class="swatches">{BOARDS.map((b) => { const lock = b.premium && !ent.premium; return <button class={'swatch ' + (st.board === b.id ? 'on' : '')} title={b.name + (lock ? ' (Premium)' : '')} onClick={() => lock ? (location.hash = '#/premium') : set('board', b.id)} style={{ background: `linear-gradient(135deg, ${b.light} 50%, ${b.dark} 50%)` }}>{lock && '👑'}</button>; })}</div>
        <h4>Pièces</h4>
        <div class="chips">{PIECE_SETS.map((p) => { const lock = p.premium && !ent.premium; return <button class={'chip ' + (st.pieces === p.id ? 'on' : '')} onClick={() => lock ? (location.hash = '#/premium') : set('pieces', p.id)}>{lock && '👑 '}{p.name}</button>; })}</div>
        <div class="preview-board"><Board fen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" viewOnly /></div>
      </section>
      <section class="card">
        <h2>Jeu</h2>
        <Toggle k="sound" label="Sons" desc="Bruitages des coups, réussites et erreurs" />
        <Toggle k="coords" label="Coordonnées" desc="Afficher a-h et 1-8 sur l’échiquier" />
        <Toggle k="showLegal" label="Coups possibles" desc="Points sur les cases accessibles" />
        <Toggle k="animation" label="Animations" />
        <Toggle k="reduceMotion" label="Réduire les mouvements" desc="Accessibilité : moins d’animations" />
        <Toggle k="autoQueen" label="Promotion automatique en dame" />
        <Toggle k="coachInPlay" label="Coach pendant les parties" desc="Commentaires et classification de chaque coup" />
        <button class="btn small ghost" onClick={() => play('success')}>🔊 Tester le son</button>
      </section>
      <section class="card">
        <h2>Données</h2>
        <p class="muted small">Ta progression est enregistrée uniquement sur cet appareil. Aucun compte, aucune publicité, aucun traceur.</p>
        <div class="row wrap">
          <button class="btn ghost" onClick={() => { const b = new Blob([exportData()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `maitre-echecs-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }}>⬇️ Exporter</button>
          <label class="btn ghost">⬆️ Importer<input type="file" accept="application/json" hidden onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; try { importData(await f.text()); applyAppearance(); toast('Progression restaurée', '✅'); } catch (err: any) { toast(err.message, '⚠️'); } }} /></label>
          <button class="btn ghost danger" onClick={() => { if (confirm('Effacer toute ta progression ? Cette action est irréversible.')) { resetAll(); applyAppearance(); toast('Progression effacée', '🗑'); } }}>🗑 Tout effacer</button>
        </div>
        <p class="muted small">☁️ Synchronisation iPhone ↔ PC : {ent.premium ? 'bientôt disponible (en attendant, utilise Exporter/Importer).' : 'fonction Premium (en attendant, Exporter/Importer est gratuit).'}</p>
      </section>
      <section class="card">
        <h2>Abonnement</h2>
        <p>{ent.premium ? `👑 Premium actif (${ent.plan === 'lifetime' ? 'à vie' : ent.plan === 'annual' ? 'annuel' : 'mensuel'})${ent.trialEndsAt && ent.trialEndsAt > Date.now() ? ` — essai gratuit jusqu’au ${new Date(ent.trialEndsAt).toLocaleDateString('fr-FR')}` : ''}` : 'Version gratuite — ta progression est gratuite pour toujours.'}</p>
        <a class="btn primary" href="#/premium">{ent.premium ? 'Gérer' : 'Découvrir Premium'}</a>
      </section>
      <section class="card">
        <h2>À propos</h2>
        <p class="small">Maître des Échecs v{VERSION} · <span onClick={() => setTaps(taps + 1)}>{isNative() ? 'App iOS' : 'Web/PWA'}</span> · paiement : {providerId()}</p>
        <p class="small muted">Moteur Stockfish 18 (GPLv3) · Échiquier chessground (GPLv3, Lichess) · Règles chess.js (BSD) · Puzzles : base Lichess (CC0) · Pièces : cburnett, merida, chessnut, fantasy, celtic, spatial (licences libres, voir LICENCES.md).</p>
        <a href="#/privacy">Politique de confidentialité</a>
      </section>
      {dev && (
        <section class="card dev">
          <h2>🛠 Développeur</h2>
          <label class="switch-row"><input type="checkbox" checked={ent.premium && ent.source === 'dev'} onChange={(e) => devToggle((e.target as HTMLInputElement).checked).then(applyAppearance)} /><span><b>Débloquer Premium (test)</b><small class="muted">Simule un abonnement annuel avec essai de 7 jours, sans paiement.</small></span></label>
          <button class="btn small ghost" onClick={() => setState((s) => { for (const k of ['debutant', 'intermediaire', 'avance', 'expert']) s.lessons['unlock-' + k] = { done: false, stars: 0, step: 0 }; })}>Débloquer toutes les leçons</button>
        </section>
      )}
    </div>
  );
}
