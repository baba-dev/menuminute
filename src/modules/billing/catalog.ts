/**
 * Published INR and USD prices in integer minor units, independently set by the owner.
 * USD is a fixed commercial price book, not an exchange-rate conversion of INR.
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
    monthlyPriceUsdCents: 500,
  },
  kitchen_pro: {
    product: "kitchen_pro",
    name: "Kitchen Pro",
    monthlyPricePaise: 49900,
    monthlyPriceUsdCents: 2000,
  },
} as const;
export type PaidPlan = keyof typeof PAID_PLAN_CATALOG;

/** INR Dedicated remains the published monthly contract rate. */
export const DEDICATED_MONTHLY_PAISE = 3_000_000;
/** USD Dedicated is a private on-premise deployment quote; term agreed by contract. */
export const DEDICATED_ON_PREMISE_USD_CENTS = 300_000;
export type BillingCurrency = "INR" | "USD";

/** Active subscriptions retain their recorded provider price and currency. */
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
