/**
 * Published subscription prices in exact minor units. The USD catalogue is a fixed 50%-premium
 * price book at the owner-approved reference of INR 95 per USD, not a live FX quote.
 * Only INR is currently enabled for provider checkout; USD prices must not be collected until
 * the payment integration, verified webhook, refund handling and DB ledger are currency-aware.
 * Provider plan IDs remain runtime secrets/config and must match these amounts before billing launch.
 * Changing a price requires a reviewed provider-plan migration, not an admin edit.
 */
export const PAID_PLAN_CATALOG = {
  ordering: {
    product: "ordering",
    name: "Ordering",
    monthlyPricePaise: 11900,
    monthlyPriceUsdCents: 188,
  },
  kitchen_pro: {
    product: "kitchen_pro",
    name: "Kitchen Pro",
    monthlyPricePaise: 49900,
    monthlyPriceUsdCents: 788,
  },
} as const;
export type PaidPlan = keyof typeof PAID_PLAN_CATALOG;

/** Dedicated is sold by contract; this is the published monthly price. */
export const DEDICATED_MONTHLY_PAISE = 3_000_000;
export const DEDICATED_MONTHLY_USD_CENTS = 47_368;
export type BillingCurrency = "INR" | "USD";

/** These price book values are immutable for active subscriptions. */
export const USD_PRICE_REFERENCE = {
  inrPerUsd: 95,
  markupPercent: 50,
  effectiveDate: "2026-11-03",
} as const;

/** Money display only. Provider amounts are integer units from the catalog. */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
export function subscriptionMonthlyPriceMinor(plan: PaidPlan, currency: BillingCurrency): number {
  const price = PAID_PLAN_CATALOG[plan];
  return currency === "USD" ? price.monthlyPriceUsdCents : price.monthlyPricePaise;
}
export function formatSubscriptionMonthlyPrice(plan: PaidPlan, currency: BillingCurrency): string {
  const minor = subscriptionMonthlyPriceMinor(plan, currency);
  return currency === "USD" ? formatUsd(minor) : formatInr(minor);
}

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
export function inrMonthlyPrice(plan: PaidPlan): string {
  return formatInr(PAID_PLAN_CATALOG[plan].monthlyPricePaise);
}
