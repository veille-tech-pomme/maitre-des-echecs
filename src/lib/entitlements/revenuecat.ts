// Fournisseur iOS : achats intégrés StoreKit via RevenueCat (@revenuecat/purchases-capacitor).
// Inactif (stub) tant qu'on n'est pas dans l'app native ou qu'aucune clé n'est configurée.
import type { EntitlementProvider, EntState, PlanId, Plan } from './types';
import { PAY_CONFIG, PLANS } from './config';
import { isNative } from '../platform';

let RC: any = null;
let pkgs: Record<string, any> = {};
async function sdk() {
  if (RC) return RC;
  const mod: any = await import('@revenuecat/purchases-capacitor');
  RC = mod.Purchases; return RC;
}
function toState(info: any): EntState {
  const ent = info?.customerInfo?.entitlements?.active?.[PAY_CONFIG.entitlementId] || info?.entitlements?.active?.[PAY_CONFIG.entitlementId];
  if (!ent) return { premium: false, source: 'none' };
  const pid: string = ent.productIdentifier || '';
  const plan: PlanId = pid.includes('lifetime') ? 'lifetime' : pid.includes('annual') ? 'annual' : 'monthly';
  const exp = ent.expirationDate ? Date.parse(ent.expirationDate) : undefined;
  return { premium: true, source: 'revenuecat', plan, expiresAt: exp, willRenew: ent.willRenew, trialEndsAt: ent.periodType === 'TRIAL' || ent.periodType === 'trial' ? exp : undefined };
}
export const revenueCatProvider: EntitlementProvider = {
  id: 'revenuecat',
  async available() { return isNative() && !!PAY_CONFIG.revenueCatAppleKey; },
  async init() { const P = await sdk(); await P.configure({ apiKey: PAY_CONFIG.revenueCatAppleKey }); },
  async getState() { const P = await sdk(); return toState(await P.getCustomerInfo()); },
  async plans(): Promise<Plan[]> {
    const P = await sdk();
    try {
      const off = await P.getOfferings(); const cur = off?.current; const out: Plan[] = [];
      for (const base of PLANS) {
        const pkg = cur?.availablePackages?.find((p: any) => p.product?.identifier === base.storeProductId);
        if (pkg) { pkgs[base.id] = pkg; out.push({ ...(base as any), price: pkg.product.priceString || base.price }); } else out.push(base as any);
      }
      return out;
    } catch { return PLANS as unknown as Plan[]; }
  },
  async purchase(plan: PlanId) {
    const P = await sdk(); if (!pkgs[plan]) await this.plans();
    const pkg = pkgs[plan]; if (!pkg) throw new Error('Produit indisponible sur l’App Store.');
    return toState(await P.purchasePackage({ aPackage: pkg }));
  },
  async restore() { const P = await sdk(); return toState(await P.restorePurchases()); },
  manageUrl() { return 'https://apps.apple.com/account/subscriptions'; },
};
