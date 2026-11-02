import { describe, expect, it } from "vitest";
import {
  PAID_PLAN_CATALOG,
  DEDICATED_MONTHLY_PAISE,
  DEDICATED_ON_PREMISE_USD_CENTS,
  formatSubscriptionMonthlyPrice,
  subscriptionMonthlyPriceMinor,
} from "../src/modules/billing/catalog";
import { planLadder, planPrice } from "../src/modules/plans/offer";

describe("independently priced INR and USD plan books", () => {
  it("retains all existing INR subscription and Dedicated monthly amounts", () => {
    expect(PAID_PLAN_CATALOG.ordering.monthlyPricePaise).toBe(11_900);
    expect(PAID_PLAN_CATALOG.kitchen_pro.monthlyPricePaise).toBe(49_900);
    expect(DEDICATED_MONTHLY_PAISE).toBe(3_000_000);
    expect(subscriptionMonthlyPriceMinor("ordering", "INR")).toBe(11_900);
    expect(subscriptionMonthlyPriceMinor("kitchen_pro", "INR")).toBe(49_900);
  });

  it("publishes exact USD cents for Ordering and Kitchen Pro, not dynamic FX calculations", () => {
    expect(PAID_PLAN_CATALOG.ordering.monthlyPriceUsdCents).toBe(500);
    expect(PAID_PLAN_CATALOG.kitchen_pro.monthlyPriceUsdCents).toBe(2_000);
    expect(subscriptionMonthlyPriceMinor("ordering", "USD")).toBe(500);
    expect(subscriptionMonthlyPriceMinor("kitchen_pro", "USD")).toBe(2_000);
    expect(formatSubscriptionMonthlyPrice("ordering", "USD")).toBe("$5.00");
    expect(formatSubscriptionMonthlyPrice("kitchen_pro", "USD")).toBe("$20.00");
  });

  it("lists Dedicated at USD 3000 as a private on-premise contract, not monthly", () => {
    expect(DEDICATED_ON_PREMISE_USD_CENTS).toBe(300_000);
    expect(planPrice("dedicated", "USD")).toMatchObject({
      label: "$3,000.00",
      note: "by contract",
      detail: "Private on-premise deployment",
      paid: false,
    });
    expect(planPrice("dedicated", "INR")).toMatchObject({
      label: "₹30,000",
      note: "per month",
    });
    expect(planLadder({ currency: "USD" })[3]?.label).toBe(
      "Dedicated · On-premise Private"
    );
  });

  it("uses the same price book throughout the four-card plan ladder", () => {
    expect(planLadder({ currency: "USD" }).map((p) => p.price.label)).toEqual([
      "$0",
      "$5.00",
      "$20.00",
      "$3,000.00",
    ]);
    expect(planLadder().map((p) => p.price.label)).toEqual(["₹0", "₹119", "₹499", "₹30,000"]);
    expect(planLadder({ currency: "INR" }).map((p) => p.price.label)).toEqual(
      planLadder().map((p) => p.price.label)
    );
  });

  it("does not activate USD payments in the existing INR-only provider path", () => {
    expect(planLadder({ currency: "USD" })[1]?.price.paid).toBe(true);
    expect(subscriptionMonthlyPriceMinor("ordering", "INR")).toBe(11_900);
  });
});
