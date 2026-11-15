// Couche d'abstraction des droits Premium : choisit le bon fournisseur selon la plateforme.
import { useEffect, useState } from 'preact/hooks';
import type { EntState, EntitlementProvider, Plan, PlanId } from './types';
import { devProvider } from './dev';
import { revenueCatProvider } from './revenuecat';
import { stripeProvider } from './stripe';
import { scheduleTrialReminder } from '../notify';
export type { EntState, Plan, PlanId };

let provider: EntitlementProvider = devProvider;
let state: EntState = { premium: false, source: 'none' };
const subs = new Set<() => void>();
const set = (s: EntState) => { state = s; subs.forEach((f) => f()); if (s.trialEndsAt) scheduleTrialReminder(s.trialEndsAt); };

export async function initEntitlements() {
  for (const p of [revenueCatProvider, stripeProvider]) { try { if (await p.available()) { provider = p; break; } } catch {} }
  try { await provider.init(); } catch (e) { console.warn('entitlements init', e); provider = devProvider; }
  let st = await provider.getState().catch(() => ({ premium: false, source: 'none' } as EntState));
  if (!st.premium && provider !== devProvider) { const d = await devProvider.getState(); if (d.premium) st = d; }
  set(st);
}
export const providerId = () => provider.id;
export const getEnt = () => state;
export async function getPlans(): Promise<Plan[]> { return provider.plans(); }
/** Achat : sur le web sans Stripe configuré, on retombe sur le mode démo explicite. */
export async function purchase(plan: PlanId): Promise<EntState> { const s = await provider.purchase(plan); if (s.premium) set(s); return s; }
export async function restore() { const s = await provider.restore(); set(s); return s; }
export async function devToggle(on: boolean, plan: PlanId = 'annual') { if (on) set(await devProvider.purchase(plan)); else { (await import('./dev')).devSet(null); set({ premium: false, source: 'none' }); } }
export const manageUrl = () => provider.manageUrl?.() || null;
export function usePremium() {
  const [, f] = useState(0);
  useEffect(() => { const cb = () => f((x) => x + 1); subs.add(cb); return () => { subs.delete(cb); }; }, []);
  return state;
}
