// Fournisseur web / Windows : Stripe Checkout (abonnement avec trial_period_days=7 sur l'annuel).
// Stub tant que les liens/endpoint ne sont pas configurés.
import type { EntitlementProvider, EntState, PlanId, Plan } from './types';
import { PAY_CONFIG, PLANS } from './config';
import { isNative } from '../platform';
const K = 'echecs-stripe-ent';
export const stripeProvider: EntitlementProvider = {
  id: 'stripe',
  async available() { const s = PAY_CONFIG.stripe; return !isNative() && !!(s.checkoutEndpoint || s.paymentLinks.annual); },
  async init() {},
  async getState(): Promise<EntState> {
    const ep = PAY_CONFIG.stripe.entitlementEndpoint;
    if (ep) { try { const r = await fetch(ep, { credentials: 'include' }); if (r.ok) { const j = await r.json(); const st: EntState = { premium: !!j.premium, source: 'stripe', plan: j.plan, expiresAt: j.expiresAt, trialEndsAt: j.trialEndsAt, willRenew: j.willRenew }; localStorage.setItem(K, JSON.stringify(st)); return st; } } catch {} }
    try { const c = JSON.parse(localStorage.getItem(K) || 'null'); if (c?.premium) return c; } catch {}
    return { premium: false, source: 'none' };
  },
  async plans() { return PLANS as unknown as Plan[]; },
  async purchase(plan: PlanId) {
    const s = PAY_CONFIG.stripe;
    if (s.checkoutEndpoint) {
      const r = await fetch(s.checkoutEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan, successUrl: location.href.split('#')[0] + '#/premium?ok=1', cancelUrl: location.href }) });
      const j = await r.json(); if (j.url) location.href = j.url; else throw new Error('Paiement indisponible');
    } else if (s.paymentLinks[plan]) location.href = s.paymentLinks[plan];
    else throw new Error('Le paiement web n’est pas encore configuré.');
    return { premium: false, source: 'none' };
  },
  async restore() { return this.getState(); },
  manageUrl() { return PAY_CONFIG.stripe.portalUrl || null; },
};
