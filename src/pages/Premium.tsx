import { useEffect, useState } from 'preact/hooks';
import { usePremium, getPlans, purchase, restore, manageUrl, providerId, devToggle, type Plan, type PlanId } from '../lib/entitlements';
import { PREMIUM_FEATURES, FREE_REVIEWS_PER_DAY } from '../lib/features';
import { PLANS } from '../lib/entitlements/config';
import { toast, Modal } from '../components/ui';
import { applyAppearance } from '../lib/theme';
import { play } from '../lib/sound';
import { isNative } from '../lib/platform';
import { LESSONS } from '../data/lessons';
import { Icon, type IconName } from '../components/Icon';

const FREE_LIST = [`Parcours Débutant → Avancé (${LESSONS.filter((l) => l.level !== 'expert').length} leçons)`, 'Puzzles illimités, du jour, contre la montre et duels', 'Tous les bots, sans limite', `${FREE_REVIEWS_PER_DAY} bilans de partie par jour`, 'Analyse Stockfish 18 et explorateur des maîtres', 'Zéro publicité, pour toujours'];
const FEAT_ICON: Record<string, IconName> = { 'lessons.expert': 'crown', 'review.unlimited': 'microscope', 'review.deep': 'message', 'repertoire.builder': 'book', 'stats.advanced': 'chart', 'cosmetics.extra': 'palette' };
// Seules les fonctions réellement disponibles sont présentées (la synchronisation n’est pas encore livrée).
const SHORT: Record<string, string> = { 'lessons.expert': 'Calcul, prophylaxie et parties légendaires commentées.', 'review.unlimited': 'Analyse toutes tes parties, sans limite.', 'review.deep': 'Variantes, menaces et principes, coup par coup.', 'repertoire.builder': 'Tes lignes, révisées en répétition espacée.', 'stats.advanced': 'Précision par phase de jeu et thèmes faibles.', 'cosmetics.extra': '4 échiquiers et 4 jeux de pièces exclusifs.' };
const FEATS = PREMIUM_FEATURES.filter((f) => f.id in FEAT_ICON).map((f) => ({ ...f, desc: SHORT[f.id] || f.desc }));
const close = () => { if (history.length > 1) history.back(); else location.hash = '#/profile'; };
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
      const s = await purchase(sel); if (s.premium) { play('win'); toast('Bienvenue dans Premium', 'crown'); applyAppearance(); }
    } catch (e: any) { if (!String(e?.message || '').includes('cancel')) toast(e?.message || 'Achat impossible', 'info'); }
    setBusy(false);
  };
  const feats = <div class="feat-list">{FEATS.map((f) => <div class="feat"><span><Icon name={FEAT_ICON[f.id]} size={20} /></span><div><b>{f.title}</b><small>{f.desc}</small></div></div>)}</div>;
  const top = <div class="game-top"><button class="nb-btn round" onClick={close} aria-label="Fermer"><Icon name="close" size={18} stroke={2.5} /></button><span /><span /></div>;
  if (ent.premium) {
    const url = manageUrl();
    return (
      <div class="page premium paywall">
        {top}
        <div class="pw-hero"><span class="pw-crown"><Icon name="crown" size={42} stroke={1.8} /></span><h1>Tu es Premium</h1>
          <p>{ent.plan === 'lifetime' ? 'Accès à vie. Merci pour ton soutien.' : ent.trialEndsAt && ent.trialEndsAt > Date.now() ? `Essai gratuit jusqu’au ${new Date(ent.trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, puis ${ent.plan === 'annual' ? '29,99 €/an' : '3,99 €/mois'}. Annulable à tout moment.` : `Abonnement ${ent.plan === 'annual' ? 'annuel' : 'mensuel'}${ent.expiresAt ? ` · renouvellement le ${new Date(ent.expiresAt).toLocaleDateString('fr-FR')}` : ''}.`}</p></div>
        <div class="card">{feats}</div>
        <div class="col center-col">
          {url && <a class="btn secondary" href={url} target="_blank" rel="noopener">Gérer mon abonnement</a>}
          {ent.source === 'dev' && <button class="btn plain" onClick={() => devToggle(false).then(applyAppearance)}>Désactiver le mode test</button>}
        </div>
      </div>
    );
  }
  return (
    <div class="page premium paywall">
      {top}
      <div class="pw-hero">
        <span class="pw-crown"><Icon name="crown" size={42} stroke={1.8} /></span>
        <h1>Maître Premium</h1>
        <p>Ta progression reste gratuite et sans pub. Premium ajoute la profondeur des maîtres.</p>
      </div>
      {feats}
      <div class="plans" role="radiogroup" aria-label="Formules">
        {plans.map((p) => (
          <button role="radio" aria-checked={sel === p.id} class={'plan ' + (sel === p.id ? 'on' : '')} onClick={() => setSel(p.id)}>
            {p.badge && <span class="plan-badge">{p.badge}</span>}
            <span class="radio">{sel === p.id && <Icon name="check" size={15} stroke={3} />}</span>
            <span class="pl-main"><b>{p.title}</b>{p.trialDays ? <small class="trial">{p.trialDays} jours gratuits</small> : <small>{p.id === 'lifetime' ? 'Paiement unique' : 'Sans engagement'}</small>}</span>
            <span class="plan-price">{p.price}<small>{p.perMonth || p.period.trim()}</small></span>
          </button>
        ))}
      </div>
      {plan.trialDays ? (
        <section class="card">
          <h2 class="card-title">Comment fonctionne l’essai</h2>
          <ol class="timeline">
            <li><span class="tl-dot"><Icon name="lock" size={16} /></span><div><b>Aujourd’hui</b><small>Accès complet à Premium, sans payer.</small></div></li>
            <li><span class="tl-dot"><Icon name="bell" size={16} /></span><div><b>Jour {plan.trialDays - 2}</b><small>On te rappelle que l’essai se termine bientôt.</small></div></li>
            <li><span class="tl-dot"><Icon name="star" size={16} /></span><div><b>Jour {plan.trialDays}</b><small>{plan.price}{plan.period}, sauf si tu annules avant.</small></div></li>
          </ol>
        </section>
      ) : null}
      <details class="card pw-free">
        <summary><Icon name="checkCircle" size={18} />Ce qui reste gratuit, pour toujours<Icon name="down" size={18} class="chev" /></summary>
        <ul>{FREE_LIST.map((f) => <li>{f}</li>)}</ul>
      </details>
      <div class="pw-sticky">
        <button class="btn primary lg cta" disabled={busy} onClick={buy}>{busy ? 'Un instant…' : plan.trialDays ? `Essayer ${plan.trialDays} jours gratuits` : plan.id === 'lifetime' ? `Acheter à vie · ${plan.price}` : `S’abonner · ${plan.price}${plan.period}`}</button>
        <p class="pw-legal">{plan.trialDays ? `${plan.trialDays} jours gratuits, puis ${plan.price}${plan.period}, annulable à tout moment. Nous te rappellerons 2 jours avant la fin de l’essai.` : plan.id === 'lifetime' ? 'Paiement unique, sans abonnement.' : `${plan.price}${plan.period}, sans engagement, annulable à tout moment.`}</p>
      </div>
      <p class="pw-legal">{isNative() ? 'Le paiement est débité sur ton compte Apple à la confirmation. L’abonnement se renouvelle automatiquement sauf annulation au moins 24 h avant la fin de la période en cours, depuis les réglages de ton compte App Store.' : 'Paiement sécurisé par Stripe. Gestion et annulation depuis ton espace client.'}</p>
      <div class="pw-links"><button class="btn plain small" onClick={async () => { try { const s = await restore(); toast(s.premium ? 'Achats restaurés' : 'Aucun achat trouvé', s.premium ? 'checkCircle' : 'info'); } catch (e: any) { toast(e?.message || 'Erreur', 'info'); } }}>Restaurer</button>
        <a class="btn plain small" href="#/privacy">Confidentialité</a><a class="btn plain small" href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener">Conditions</a></div>
      <Modal open={demo} onClose={() => setDemo(false)} title="Mode démonstration">
        <p>Les paiements ne sont pas encore configurés sur cette version (voir <b>PUBLICATION_IOS.md</b>). Tu peux activer Premium en mode test pour découvrir toutes les fonctions.</p>
        <div class="col"><button class="btn primary" onClick={async () => { await devToggle(true, sel); setDemo(false); applyAppearance(); play('win'); toast('Premium (test) activé', 'crown'); }}>Activer le mode test</button><button class="btn plain" onClick={() => setDemo(false)}>Annuler</button></div>
      </Modal>
    </div>
  );
}
