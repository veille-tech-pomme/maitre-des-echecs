export type PlanId = 'monthly' | 'annual' | 'lifetime';
export interface Plan { id: PlanId; title: string; price: string; priceValue: number; period: string; perMonth?: string; badge?: string; trialDays?: number; storeProductId: string }
export interface EntState { premium: boolean; source: 'none' | 'dev' | 'revenuecat' | 'stripe'; plan?: PlanId; expiresAt?: number; trialEndsAt?: number; willRenew?: boolean }
export interface EntitlementProvider {
  id: 'dev' | 'revenuecat' | 'stripe';
  available(): Promise<boolean>;
  init(): Promise<void>;
  getState(): Promise<EntState>;
  plans(): Promise<Plan[]>;
  purchase(plan: PlanId): Promise<EntState>;
  restore(): Promise<EntState>;
  manageUrl?(): string | null;
}
