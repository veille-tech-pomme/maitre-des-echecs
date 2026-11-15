// Fournisseur de test : active Premium localement (réglages > développeur).
import type { EntitlementProvider, EntState, PlanId, Plan } from './types';
import { PLANS } from './config';
const K = 'echecs-dev-premium';
export const devProvider: EntitlementProvider = {
  id: 'dev',
  async available() { return true; },
  async init() {},
  async getState(): Promise<EntState> { try { const s = JSON.parse(localStorage.getItem(K) || 'null'); if (s && (!s.expiresAt || s.expiresAt > Date.now())) return s; } catch {} return { premium: false, source: 'none' }; },
  async plans() { return PLANS as unknown as Plan[]; },
  async purchase(plan: PlanId) {
    const now = Date.now(); const day = 86400000;
    const st: EntState = plan === 'annual' ? { premium: true, source: 'dev', plan, trialEndsAt: now + 7 * day, expiresAt: now + 372 * day, willRenew: true }
      : plan === 'monthly' ? { premium: true, source: 'dev', plan, expiresAt: now + 31 * day, willRenew: true } : { premium: true, source: 'dev', plan };
    localStorage.setItem(K, JSON.stringify(st)); return st;
  },
  async restore() { return this.getState(); },
};
export function devSet(st: EntState | null) { if (st) localStorage.setItem(K, JSON.stringify(st)); else localStorage.removeItem(K); }
