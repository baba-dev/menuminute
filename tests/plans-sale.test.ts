import { describe, expect, it } from "vitest";
import {
  CONTACT_TOPICS,
  NOTHING_FOR_SALE,
  parseContactTopic,
  planSale,
  saleFootnote,
  type SaleFacts,
} from "../src/modules/plans/sale";
import { PLAN_ORDER } from "../src/modules/plans/catalog";

const off: SaleFacts = NOTHING_FOR_SALE;
const orderingOnly: SaleFacts = {
  community: false,
  checkoutOpen: true,
  kitchenCheckoutOpen: false,
};
const everything: SaleFacts = { community: false, checkoutOpen: true, kitchenCheckoutOpen: true };
const community: SaleFacts = { community: true, checkoutOpen: false, kitchenCheckoutOpen: false };

describe("public plan calls to action never promise an unavailable purchase", () => {
  it("payments off: Free works, Ordering starts free, Kitchen Pro is by request", () => {
    expect(planSale("free", "INR", off)).toMatchObject({ state: "free", href: "/register" });
    expect(planSale("ordering", "INR", off)).toMatchObject({
      state: "opening_soon",
      label: "Start free for now",
      href: "/register",
    });
    expect(planSale("kitchen_pro", "INR", off)).toMatchObject({
      state: "early_access",
      label: "Request early access",
      href: "/contact?topic=kitchen-pro",
    });
    expect(planSale("dedicated", "INR", off)).toMatchObject({
      state: "contact",
      label: "Talk to us about Dedicated",
      href: "/contact",
    });
  });

  it("Ordering checkout open, Kitchen release still off: only Ordering is purchasable", () => {
    expect(planSale("ordering", "INR", orderingOnly)).toMatchObject({
      state: "checkout",
      label: "Get Ordering",
      href: "/billing?plan=ordering",
      note: null,
    });
    expect(planSale("kitchen_pro", "INR", orderingOnly).state).toBe("early_access");
  });

  it("both open: both paid plans go to their Billing card", () => {
    expect(planSale("ordering", "INR", everything).href).toBe("/billing?plan=ordering");
    expect(planSale("kitchen_pro", "INR", everything)).toMatchObject({
      state: "checkout",
      label: "Get Kitchen Pro",
      href: "/billing?plan=kitchen_pro",
    });
  });

  it("USD is always an enquiry, whatever INR checkout does", () => {
    for (const facts of [off, orderingOnly, everything]) {
      expect(planSale("ordering", "USD", facts)).toMatchObject({
        state: "contact",
        label: "Ask about USD billing",
        href: "/contact",
      });
      expect(planSale("kitchen_pro", "USD", facts).label).toBe("Ask about USD billing");
      expect(planSale("dedicated", "USD", facts).label).toBe("Discuss private deployment");
    }
  });

  it("self-hosted Community Edition says everything is unlocked instead of selling", () => {
    expect(planSale("ordering", "INR", community).state).toBe("community");
    expect(planSale("kitchen_pro", "INR", community).state).toBe("community");
    expect(planSale("free", "INR", community).state).toBe("free");
  });

  it("every plan, currency and state yields a real destination", () => {
    for (const facts of [off, orderingOnly, everything, community])
      for (const currency of ["INR", "USD"] as const)
        for (const plan of PLAN_ORDER) {
          const sale = planSale(plan, currency, facts);
          expect(sale.href).toMatch(/^\/[a-z]/);
          expect(sale.href).not.toBe("#");
          expect(sale.label.length).toBeGreaterThan(0);
        }
  });

  it("an unknown or failed lookup is treated as nothing for sale", () => {
    expect(NOTHING_FOR_SALE).toEqual({
      community: false,
      checkoutOpen: false,
      kitchenCheckoutOpen: false,
    });
  });
});

describe("footnote agrees with the buttons", () => {
  it("states checkout only when it is open", () => {
    expect(saleFootnote("INR", everything)).toMatch(/Current self-service checkout charges in INR/);
    expect(saleFootnote("INR", off)).toMatch(/checkout is not open yet/);
    expect(saleFootnote("INR", off)).not.toMatch(/charges in INR/);
  });
  it("keeps the USD statement", () => {
    expect(saleFootnote("USD", everything)).toMatch(/USD checkout is not yet active/);
  });
});

describe("contact topics", () => {
  it("accepts only known topics", () => {
    expect(parseContactTopic("kitchen-pro")).toBe("kitchen-pro");
    expect(parseContactTopic("<script>")).toBeNull();
    expect(parseContactTopic("__proto__")).toBeNull();
    expect(parseContactTopic("constructor")).toBeNull();
    expect(parseContactTopic(["kitchen-pro"])).toBeNull();
    expect(parseContactTopic(undefined)).toBeNull();
    expect(CONTACT_TOPICS["kitchen-pro"].subject).toBe("Kitchen Pro early access");
  });
});
