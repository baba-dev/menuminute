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

/** Kitchen Pro includes this many outlets; each further outlet (up to the plan cap) costs extra. */
export const KITCHEN_PRO_INCLUDED_OUTLETS = 3;
export const EXTRA_OUTLET_MONTHLY_PAISE = 14900;
/** Dedicated is sold by contract; this is the published monthly price. */
export const DEDICATED_MONTHLY_PAISE = 3_000_000;
/**
 * Kitchen Pro was first sold at this price. Subscriptions created on that provider plan keep renewing
 * at it (RAZORPAY_PLAN_KITCHEN_LEGACY_ID); new subscriptions use the current catalog price.
 */
export const LEGACY_KITCHEN_PRO_MONTHLY_PAISE = 29900;

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
export function inrMonthlyPrice(plan: PaidPlan): string {
  return formatInr(PAID_PLAN_CATALOG[plan].monthlyPricePaise);
}
