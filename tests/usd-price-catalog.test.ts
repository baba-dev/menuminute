import { describe, expect, it } from "vitest";
import {
  PAID_PLAN_CATALOG,
  DEDICATED_MONTHLY_PAISE,
  DEDICATED_MONTHLY_USD_CENTS,
  USD_PRICE_REFERENCE,
  formatSubscriptionMonthlyPrice,
  subscriptionMonthlyPriceMinor,
} from "../src/modules/billing/catalog";
import { planLadder, planPrice } from "../src/modules/plans/offer";

describe("fixed USD subscription price book", () => {
  // The 50% premium is calculated at a locked INR 95 / USD reference,
  // rounded once to cents when the product catalog is approved.
  const usdMinor = (inrPaise: number) => Math.floor((inrPaise * 3 + 95) / 190);

  it("keeps the approved INR prices and maps their 50%-premium USD equivalents", () => {
    expect(USD_PRICE_REFERENCE).toMatchObject({
      inrPerUsd: 95,
      markupPercent: 50,
    });
    expect(PAID_PLAN_CATALOG.ordering.monthlyPricePaise).toBe(11_900);
    expect(PAID_PLAN_CATALOG.kitchen_pro.monthlyPricePaise).toBe(49_900);
    for (const plan of ["ordering", "kitchen_pro"] as const) {
      const inr = PAID_PLAN_CATALOG[plan].monthlyPricePaise;
      expect(subscriptionMonthlyPriceMinor(plan, "INR")).toBe(inr);
      expect(subscriptionMonthlyPriceMinor(plan, "USD")).toBe(usdMinor(inr));
    }
    expect(DEDICATED_MONTHLY_USD_CENTS).toBe(usdMinor(DEDICATED_MONTHLY_PAISE));
  });

  it("renders a consistent, independent INR or USD catalog without conversions in checkout", () => {
    expect(formatSubscriptionMonthlyPrice("ordering", "INR")).toBe("₹119");
    expect(formatSubscriptionMonthlyPrice("ordering", "USD")).toBe("$1.88");
    expect(formatSubscriptionMonthlyPrice("kitchen_pro", "USD")).toBe("$7.88");
    expect(planPrice("dedicated", "USD").label).toBe("$473.68");
    expect(planPrice("free", "USD").label).toBe("$0");
    expect(planPrice("free").label).toBe("₹0");
    expect(planLadder({ currency: "USD" }).map((p) => p.price.label)).toEqual([
      "$0",
      "$1.88",
      "$7.88",
      "$473.68",
    ]);
    expect(planLadder().map((p) => p.price.label)).toEqual(["₹0", "₹119", "₹499", "₹30,000"]);
  });

  it("does not conflate published USD prices with existing INR provider payment contracts", () => {
    // Only the catalog is expanded here. Provider approval and currency-pinned
    // ledgers must be implemented before exposing USD self-service checkout.
    expect(planLadder({ currency: "USD" })[1]?.price.paid).toBe(true);
    expect(subscriptionMonthlyPriceMinor("ordering", "INR")).toBe(11_900);
  });
});
