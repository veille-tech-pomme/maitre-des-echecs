// Configuration des paiements. Remplace les valeurs par tes clés (voir PUBLICATION_IOS.md).
export const PAY_CONFIG = {
  revenueCatAppleKey: (import.meta as any).env?.VITE_RC_APPLE_KEY || '', // « appl_… » (RevenueCat > Project > API keys)
  entitlementId: 'premium',
  productIds: { monthly: 'com.echecs.maitre.premium.monthly', annual: 'com.echecs.maitre.premium.annual', lifetime: 'com.echecs.maitre.premium.lifetime' },
  // Stripe (web / Windows) : liens de paiement Stripe Payment Links, ou un endpoint de session Checkout
  stripe: {
    publishableKey: (import.meta as any).env?.VITE_STRIPE_PK || '',
    paymentLinks: { monthly: (import.meta as any).env?.VITE_STRIPE_LINK_MONTHLY || '', annual: (import.meta as any).env?.VITE_STRIPE_LINK_ANNUAL || '', lifetime: (import.meta as any).env?.VITE_STRIPE_LINK_LIFETIME || '' },
    checkoutEndpoint: (import.meta as any).env?.VITE_STRIPE_CHECKOUT_ENDPOINT || '', // POST {plan} -> {url}
    entitlementEndpoint: (import.meta as any).env?.VITE_ENTITLEMENT_ENDPOINT || '', // GET -> {premium, plan, expiresAt, trialEndsAt}
    portalUrl: (import.meta as any).env?.VITE_STRIPE_PORTAL_URL || '',
  },
};
export const PLANS = [
  { id: 'monthly', title: 'Mensuel', price: '3,99 €', priceValue: 3.99, period: '/mois', storeProductId: PAY_CONFIG.productIds.monthly },
  { id: 'annual', title: 'Annuel', price: '29,99 €', priceValue: 29.99, period: '/an', perMonth: 'soit 2,50 €/mois', badge: '7 jours gratuits · −37 %', trialDays: 7, storeProductId: PAY_CONFIG.productIds.annual },
  { id: 'lifetime', title: 'À vie', price: '59,99 €', priceValue: 59.99, period: ' une fois', storeProductId: PAY_CONFIG.productIds.lifetime },
] as const;
