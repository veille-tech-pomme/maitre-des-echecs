// Exemple d'endpoint (Node / Vercel / Netlify / Cloudflare) pour le paiement web & Windows via Stripe Checkout.
// L'app appelle POST {VITE_STRIPE_CHECKOUT_ENDPOINT} avec {"plan":"monthly"|"annual"|"lifetime"} et reçoit {"url": "..."}.
// Variables : STRIPE_SECRET_KEY, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_LIFETIME, APP_URL.
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICES = { monthly: process.env.PRICE_MONTHLY, annual: process.env.PRICE_ANNUAL, lifetime: process.env.PRICE_LIFETIME };

export default async function handler(req, res) {
  const { plan } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!PRICES[plan]) return res.status(400).json({ error: 'plan inconnu' });
  const isSub = plan !== 'lifetime';
  const session = await stripe.checkout.sessions.create({
    mode: isSub ? 'subscription' : 'payment',
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    locale: 'fr',
    allow_promotion_codes: true,
    // Essai gratuit de 7 jours uniquement sur l'annuel ; la carte est demandée, rien n'est débité avant J+7.
    ...(isSub && plan === 'annual' ? { subscription_data: { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } } : {}),
    payment_method_collection: 'always',
    success_url: `${process.env.APP_URL}/#/premium?ok={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/#/premium`,
  });
  res.status(200).json({ url: session.url });
}
// Webhook conseillé : customer.subscription.trial_will_end (envoyé 3 jours avant la fin de l'essai)
// → e-mail de rappel ; customer.subscription.updated/deleted → mise à jour de l'accès Premium.
