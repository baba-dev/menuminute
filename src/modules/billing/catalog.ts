/**
 * Published INR subscription pricing in paise (the four tiers: Free, Ordering, Kitchen Pro, Dedicated).
 * Provider plan IDs remain runtime secrets/config and must match these amounts before billing launch.
 * Changing a price requires a reviewed provider-plan migration, not an admin edit.
 */
export const PAID_PLAN_CATALOG = {
  ordering: {
    product: "ordering",
    name: "Ordering",
    monthlyPricePaise: 11900,
  },
  kitchen_pro: {
    product: "kitchen_pro",
    name: "Kitchen Pro",
    monthlyPricePaise: 49900,
  },
} as const;
export type PaidPlan = keyof typeof PAID_PLAN_CATALOG;

/** Dedicated is sold by contract; this is the published monthly price. */
export const DEDICATED_MONTHLY_PAISE = 3_000_000;

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
export function inrMonthlyPrice(plan: PaidPlan): string {
  return formatInr(PAID_PLAN_CATALOG[plan].monthlyPricePaise);
}
