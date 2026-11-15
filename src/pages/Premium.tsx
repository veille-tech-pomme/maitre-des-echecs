import { useEffect, useState } from 'preact/hooks';
import { usePremium, getPlans, purchase, restore, manageUrl, providerId, devToggle, type Plan, type PlanId } from '../lib/entitlements';
import { PREMIUM_FEATURES, FREE_REVIEWS_PER_DAY } from '../lib/features';
import { PLANS } from '../lib/entitlements/config';
import { toast, Modal } from '../components/ui';
import { applyAppearance } from '../lib/theme';
import { play } from '../lib/sound';
import { isNative } from '../lib/platform';
import { LESSONS } from '../data/lessons';

const FREE_LIST = [`Tout le parcours Débutant → Avancé (${LESSONS.filter((l) => l.level !== 'expert').length} leçons interactives)`, 'Puzzles classés illimités, puzzle du jour et contre la montre', '9 bots à personnalité, tous niveaux, sans limite', `${FREE_REVIEWS_PER_DAY} bilans de partie complets par jour`, 'Analyse libre avec Stockfish 18', 'Révisions espacées et plan personnalisé', 'Zéro publicité, pour toujours'];
export function Premium() {
  const ent = usePremium();
  const [plans, setPlans] = useState<Plan[]>(PLANS as unknown as Plan[]);
  const [sel, setSel] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false); const [demo, setDemo] = useState(false);
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);
  const plan = plans.find((p) => p.id === sel)!;
  const buy = async () => {
    setBusy(true);
    try {
      if (providerId() === 'dev') { setDemo(true); setBusy(false); return; }
      const s = await purchase(sel); if (s.premium) { play('win'); toast('Bienvenue dans Premium !', '👑'); applyAppearance(); }
    } catch (e: any) { if (!String(e?.message || '').includes('cancel')) toast(e?.message || 'Achat impossible', '⚠️'); }
    setBusy(false);
  };
  if (ent.premium) {
    const url = manageUrl();
    return (
      <div class="page premium center-page">
        <div class="celebrate">👑</div><h1>Tu es Premium</h1>
        <p>{ent.plan === 'lifetime' ? 'Accès à vie. Merci pour ton soutien !' : ent.trialEndsAt && ent.trialEndsAt > Date.now() ? `Essai gratuit jusqu’au ${new Date(ent.trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, puis ${ent.plan === 'annual' ? '29,99 €/an' : '3,99 €/mois'}. Annulable à tout moment.` : `Abonnement ${ent.plan === 'annual' ? 'annuel' : 'mensuel'}${ent.expiresAt ? ` · renouvellement le ${new Date(ent.expiresAt).toLocaleDateString('fr-FR')}` : ''}.`}</p>
        <div class="feat-list">{PREMIUM_FEATURES.map((f) => <div class="feat"><span>{f.icon}</span><div><b>{f.title}</b><small class="muted">{f.desc}</small></div></div>)}</div>
        {url && <a class="btn ghost" href={url} target="_blank" rel="noopener">Gérer mon abonnement</a>}
        {ent.source === 'dev' && <button class="btn ghost" onClick={() => devToggle(false).then(applyAppearance)}>Désactiver le mode test</button>}
      </div>
    );
  }
  return (
    <div class="page premium">
      <div class="pw-hero">
        <span class="pw-crown">👑</span>
        <h1>Progresser est gratuit.<br /><span class="grad">Premium, c’est aller plus loin.</span></h1>
        <p class="muted">Pas de mur payant sur ta progression : tout ce qu’il faut pour devenir un joueur solide reste gratuit, sans pub. Premium ajoute la profondeur des maîtres.</p>
      </div>
      <div class="pw-cols">
        <div class="card pw-free"><h3>✅ Gratuit pour toujours</h3><ul>{FREE_LIST.map((f) => <li>{f}</li>)}</ul></div>
        <div class="card pw-prem"><h3>👑 Premium</h3><div class="feat-list">{PREMIUM_FEATURES.map((f) => <div class="feat"><span>{f.icon}</span><div><b>{f.title}</b><small class="muted">{f.desc}</small></div></div>)}</div></div>
      </div>
      <div class="plans" role="radiogroup" aria-label="Formules">
        {plans.map((p) => (
          <button role="radio" aria-checked={sel === p.id} class={'plan ' + (sel === p.id ? 'on' : '')} onClick={() => setSel(p.id)}>
            {p.badge && <span class="plan-badge">{p.badge}</span>}
            <b>{p.title}</b><span class="plan-price">{p.price}<small>{p.period}</small></span>{p.perMonth && <small class="muted">{p.perMonth}</small>}
            {p.trialDays && <small class="trial">{p.trialDays} jours gratuits</small>}
          </button>
        ))}
      </div>
      <button class="btn primary big cta" disabled={busy} onClick={buy}>{busy ? '…' : plan.trialDays ? `Commencer mes ${plan.trialDays} jours gratuits` : plan.id === 'lifetime' ? `Acheter à vie — ${plan.price}` : `S’abonner — ${plan.price}${plan.period}`}</button>
      <p class="pw-legal">{plan.trialDays ? `${plan.trialDays} jours gratuits, puis ${plan.price}${plan.period}, annulable à tout moment. Nous te rappellerons 2 jours avant la fin de l’essai.` : plan.id === 'lifetime' ? 'Paiement unique, sans abonnement.' : `${plan.price}${plan.period}, sans engagement, annulable à tout moment.`}
        {' '}{isNative() ? 'Le paiement est débité sur ton compte Apple à la confirmation. L’abonnement se renouvelle automatiquement sauf annulation au moins 24 h avant la fin de la période en cours, depuis les réglages de ton compte App Store.' : 'Paiement sécurisé par Stripe. Gestion et annulation depuis ton espace client.'}</p>
      <div class="row center"><button class="btn small ghost" onClick={async () => { try { const s = await restore(); toast(s.premium ? 'Achats restaurés' : 'Aucun achat trouvé', s.premium ? '✅' : 'ℹ️'); } catch (e: any) { toast(e?.message || 'Erreur', '⚠️'); } }}>Restaurer mes achats</button>
        <a class="btn small ghost" href="#/privacy">Confidentialité</a><a class="btn small ghost" href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener">Conditions (EULA)</a></div>
      <Modal open={demo} onClose={() => setDemo(false)} title="Mode démonstration">
        <p>Les paiements ne sont pas encore configurés sur cette version (voir <b>PUBLICATION_IOS.md</b>). Tu peux activer Premium en mode test pour découvrir toutes les fonctions.</p>
        <div class="row"><button class="btn primary" onClick={async () => { await devToggle(true, sel); setDemo(false); applyAppearance(); play('win'); toast('Premium (test) activé', '👑'); }}>Activer le mode test</button><button class="btn ghost" onClick={() => setDemo(false)}>Annuler</button></div>
      </Modal>
    </div>
  );
}
