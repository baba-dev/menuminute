/**
 * Published INR subscription pricing in paise. Provider plan IDs remain
 * runtime secrets/config and must match these amounts before billing launch.
 * Changing a price requires a reviewed provider-plan migration, not an admin edit.
 */
export const PAID_PLAN_CATALOG = {
  ordering: {
    product: "ordering",
    name: "Live Table Ordering",
    monthlyPricePaise: 11900,
  },
  kitchen_pro: {
    product: "kitchen_pro",
    name: "Kitchen Pro KDS",
    monthlyPricePaise: 29900,
  },
} as const;
export type PaidPlan = keyof typeof PAID_PLAN_CATALOG;

export function inrMonthlyPrice(plan: PaidPlan): string {
  const amount = PAID_PLAN_CATALOG[plan].monthlyPricePaise / 100;
  return `₹${amount.toLocaleString("en-IN")}`;
}
