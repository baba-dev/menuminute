import { describe, expect, it } from "vitest";
import { buildBentoView } from "../src/modules/plans/bento";
import { buildBillingPageView, coerceSubscriptions } from "../src/modules/plans/billing-page";
import { benefitsBetween, buildNextUp, planLadder, planPrice } from "../src/modules/plans/offer";

describe("prices and benefits come from the reviewed catalogs", () => {
  it("publishes the four prices: INR 0, 119, a flat 499 for up to 10 outlets, and 30,000", () => {
    expect(planPrice("free")).toEqual({ label: "₹0", note: "forever", paid: false });
    expect(planPrice("ordering")).toEqual({ label: "₹119", note: "per month", paid: true });
    expect(planPrice("kitchen_pro")).toEqual({
      label: "₹499",
      note: "per month",
      paid: true,
      detail: "One flat price for up to 10 outlets",
    });
    // Dedicated is sold by contract: its price is published but it is not a checkout product.
    expect(planPrice("dedicated")).toEqual({ label: "₹30,000", note: "per month", paid: false });
  });

  it("matches the published four-tier limits table", () => {
    const rows = (key: "free" | "ordering" | "kitchen_pro" | "dedicated") =>
      planLadder().find((p) => p.key === key)!.highlights;
    expect(rows("free").slice(0, 3)).toEqual(["1 outlet", "20 dishes", "2 QR codes"]);
    expect(rows("ordering").slice(0, 3)).toEqual(["1 outlet", "200 dishes", "25 QR codes"]);
    expect(rows("kitchen_pro").slice(0, 3)).toEqual([
      "Up to 10 outlets",
      "2,000 dishes",
      "200 QR codes",
    ]);
    expect(rows("dedicated")[0]).toBe("Virtually unlimited outlets, dishes and QR codes");
  });

  it("lists only real, enforced differences between plans", () => {
    expect(benefitsBetween("free", "ordering").map((b) => [b.key, b.from, b.to])).toEqual([
      ["dishes", "20", "200"],
      ["qrCodes", "2", "25"],
      ["floor", "2 tables · 6 chairs", "10 tables · 30 chairs"],
      ["orders", "Not included", "No monthly cap"],
    ]);
    const withIntake = benefitsBetween("free", "ordering", {
      intake: { enabled: true, used: 0, cap: 100 },
    });
    expect(withIntake.find((b) => b.key === "orders")?.from).toBe("100 a month");
    expect(benefitsBetween("ordering", "kitchen_pro").map((b) => [b.key, b.from, b.to])[0]).toEqual(
      ["outlets", "1", "10"]
    );
    expect(benefitsBetween("ordering", "kitchen_pro").map((b) => b.key)).toEqual([
      "outlets",
      "dishes",
      "qrCodes",
      "floor",
      "kitchen",
    ]);
  });

  it("has a next step for Free and Ordering, none for Kitchen Pro or Dedicated", () => {
    expect(buildNextUp("free")?.plan).toBe("ordering");
    expect(buildNextUp("ordering")?.plan).toBe("kitchen_pro");
    expect(buildNextUp("kitchen_pro")).toBeNull();
    expect(buildNextUp("dedicated")).toBeNull();
    expect(planLadder().map((p) => p.key)).toEqual([
      "free",
      "ordering",
      "kitchen_pro",
      "dedicated",
    ]);
  });
});

describe("dashboard bento view", () => {
  const base = { usage: null, intake: null, canManageBilling: true, billingEnabled: true };
  it("sends owners straight to checkout for Ordering and for Kitchen Pro", () => {
    expect(buildBentoView({ ...base, plan: "free" })?.cta).toEqual({
      kind: "upgrade",
      label: "Upgrade to Ordering",
      href: "/billing?plan=ordering",
    });
    expect(buildBentoView({ ...base, plan: "ordering" })?.cta).toEqual({
      kind: "upgrade",
      label: "Upgrade to Kitchen Pro",
      href: "/billing?plan=kitchen_pro",
    });
  });
  it("never offers a purchase to non-owners or while billing is off", () => {
    expect(buildBentoView({ ...base, plan: "free", canManageBilling: false })?.cta?.kind).toBe(
      "ask-owner"
    );
    expect(buildBentoView({ ...base, plan: "free", billingEnabled: false })?.cta?.kind).toBe(
      "see-plans"
    );
  });
  it("has no upsell on the top plan and renders nothing for contract plans", () => {
    expect(buildBentoView({ ...base, plan: "kitchen_pro" })?.cta).toBeNull();
    expect(buildBentoView({ ...base, plan: "dedicated" })).toBeNull();
  });
});

describe("billing page view", () => {
  const input = {
    organizationName: "Saffron",
    intake: null,
    usage: null,
    canManage: true,
  };
  const live = {
    billingEnabled: true,
    kitchenCommerceEnabled: false,
    subscriptions: [],
    grants: [],
  };

  it("lets an owner on Free start an Ordering checkout, and Kitchen Pro too once its checkout is open", () => {
    const view = buildBillingPageView({ ...input, plan: "free", billing: live });
    const ordering = view.ladder.find((c) => c.key === "ordering")!;
    expect(ordering).toMatchObject({
      state: "upgrade",
      action: { kind: "checkout", plan: "ordering" },
    });
    // No "talk to us" path: while the server keeps Kitchen Pro checkout closed, the card says so.
    expect(view.ladder.find((c) => c.key === "kitchen_pro")).toMatchObject({
      action: null,
      note: "Kitchen Pro checkout is not available on this deployment yet.",
    });
    const open = buildBillingPageView({
      ...input,
      plan: "free",
      billing: { ...live, kitchenCommerceEnabled: true },
    });
    expect(open.ladder.find((c) => c.key === "kitchen_pro")?.action).toEqual({
      kind: "checkout",
      plan: "kitchen_pro",
      label: "Upgrade to Kitchen Pro",
    });
    expect(JSON.stringify(open.ladder.find((c) => c.key === "kitchen_pro"))).not.toMatch(
      /Talk to us|\/contact/
    );
    // Dedicated is sold by contract, so its only action is a conversation.
    expect(open.ladder.find((c) => c.key === "dedicated")).toMatchObject({
      state: "upgrade",
      action: { kind: "contact", href: "/contact" },
    });
    expect(view.ladder.find((c) => c.key === "free")?.state).toBe("current");
    expect(view.cycle.headline).toBe("No subscription");
    expect(view.cycle.payment).toBe("None needed");
  });

  it("warns that Kitchen Pro replaces an active Ordering subscription, and only then", () => {
    const withSub = {
      ...live,
      kitchenCommerceEnabled: true,
      subscriptions: [
        {
          subscriptionId: "sub_1",
          product: "ordering",
          status: "active",
          currentPeriodEnd: "2026-12-12T00:00:00Z",
        },
      ],
    };
    const view = buildBillingPageView({ ...input, plan: "ordering", billing: withSub });
    expect(view.ladder.find((c) => c.key === "kitchen_pro")?.switchNote).toMatch(
      /stops renewing once Kitchen Pro starts.*already paid for stay active/
    );
    expect(view.ladder.find((c) => c.key === "ordering")?.switchNote).toBeNull();
    // No note without an active Ordering subscription, or when it is already stopping.
    const free = buildBillingPageView({
      ...input,
      plan: "free",
      billing: { ...live, kitchenCommerceEnabled: true },
    });
    expect(free.ladder.find((c) => c.key === "kitchen_pro")?.switchNote).toBeNull();
    const stopping = buildBillingPageView({
      ...input,
      plan: "ordering",
      billing: {
        ...withSub,
        subscriptions: [
          { ...withSub.subscriptions[0]!, cancelRequestedAt: "2026-11-20T00:00:00Z" },
        ],
      },
    });
    expect(stopping.ladder.find((c) => c.key === "kitchen_pro")?.switchNote).toBeNull();
  });

  it("opens Kitchen Pro checkout only when the platform release is approved", () => {
    const view = buildBillingPageView({
      ...input,
      plan: "ordering",
      billing: { ...live, kitchenCommerceEnabled: true },
    });
    expect(view.ladder.find((c) => c.key === "kitchen_pro")?.action).toMatchObject({
      kind: "checkout",
      plan: "kitchen_pro",
    });
    expect(view.ladder.find((c) => c.key === "free")?.state).toBe("lower");
  });

  it("explains why an upgrade is unavailable instead of hiding it", () => {
    const staff = buildBillingPageView({ ...input, plan: "free", canManage: false, billing: null });
    expect(staff.ladder.find((c) => c.key === "ordering")).toMatchObject({
      action: null,
      note: "Only the organization owner can change the plan.",
    });
    const off = buildBillingPageView({
      ...input,
      plan: "free",
      billing: { ...live, billingEnabled: false },
    });
    expect(off.ladder.find((c) => c.key === "ordering")?.note).toBe(
      "Paid upgrades are opening soon."
    );
    const oss = buildBillingPageView({
      ...input,
      plan: "free",
      billing: { ...live, isCommunityEdition: true },
    });
    expect(oss.ladder.find((c) => c.key === "ordering")?.note).toMatch(/Self-hosted/);
  });

  it("reports the billing cycle from the subscription, or from a granted window", () => {
    const renews = buildBillingPageView({
      ...input,
      plan: "ordering",
      billing: {
        ...live,
        subscriptions: [
          {
            subscriptionId: "sub_1",
            product: "ordering",
            status: "active",
            currentPeriodEnd: "2026-12-12T00:00:00Z",
          },
        ],
      },
    });
    expect(renews.cycle).toMatchObject({
      interval: "Monthly",
      headline: "Renews 12 Dec 2026",
      payment: "Managed by Razorpay",
    });
    expect(renews.subscriptions[0]).toMatchObject({ canCancel: true, product: "Online ordering" });

    const ending = buildBillingPageView({
      ...input,
      plan: "ordering",
      billing: {
        ...live,
        subscriptions: [
          {
            subscriptionId: "sub_1",
            product: "ordering",
            status: "active",
            currentPeriodEnd: "2026-12-12T00:00:00Z",
            cancelRequestedAt: "2026-11-20T00:00:00Z",
          },
        ],
      },
    });
    expect(ending.cycle.headline).toBe("Ends 12 Dec 2026");
    expect(ending.subscriptions[0]).toMatchObject({ cancelScheduled: true, canCancel: false });

    const granted = buildBillingPageView({
      ...input,
      plan: "ordering",
      billing: {
        ...live,
        grants: [
          {
            capability: "ordering.new",
            startsAt: new Date(Date.now() - 86400000),
            endsAt: "2999-01-01T00:00:00Z",
            revokedAt: null,
          },
        ],
      },
    });
    expect(granted.cycle.detail).toBe("Granted by MenuMinute. No card is charged.");
    expect(granted.cycle.payment).toBe("None, access granted");
    expect(granted.history[0]).toMatchObject({ label: "Online ordering", status: "active" });
  });

  it("says billing is unavailable instead of guessing when an owner's details fail to load", () => {
    const view = buildBillingPageView({
      ...input,
      plan: "free",
      billing: null,
      billingUnavailable: true,
    });
    expect(view.billingUnavailable).toBe(true);
    expect(view.ladder.find((c) => c.key === "ordering")).toMatchObject({
      action: null,
      note: "Billing details are temporarily unavailable. Please try again shortly.",
    });
  });

  it("keeps only well-formed provider subscription rows", () => {
    expect(coerceSubscriptions(null)).toEqual([]);
    expect(
      coerceSubscriptions([
        {
          subscriptionId: "s1",
          product: "ordering",
          status: "active",
          currentPeriodEnd: "2026-12-12",
        },
        { subscriptionId: 5, product: "ordering", status: "active" },
        "junk",
      ])
    ).toEqual([
      {
        subscriptionId: "s1",
        product: "ordering",
        status: "active",
        currentPeriodEnd: "2026-12-12",
        cancelRequestedAt: null,
      },
    ]);
  });

  it("never lets non-owners cancel and carries a valid focus plan only", () => {
    const view = buildBillingPageView({
      ...input,
      canManage: false,
      plan: "ordering",
      focus: "kitchen_pro",
      billing: {
        ...live,
        subscriptions: [
          {
            subscriptionId: "s",
            product: "ordering",
            status: "active",
            currentPeriodEnd: "2026-12-12T00:00:00Z",
          },
        ],
      },
    });
    expect(view.subscriptions[0]?.canCancel).toBe(false);
    expect(view.focus).toBe("kitchen_pro");
    expect(
      buildBillingPageView({ ...input, plan: "free", focus: "<script>", billing: null }).focus
    ).toBeNull();
  });
});
