import { describe, expect, it } from "vitest";
import { buildBentoView } from "../src/modules/plans/bento";
import { buildBillingPageView } from "../src/modules/plans/billing-page";
import {
  buildLifecycleNotices,
  nextUpFor,
  trialChip,
  trialDaysLeft,
  type LifecycleSnapshot,
} from "../src/modules/plans/lifecycle";

const now = new Date("2026-11-10T10:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const trialOf = (days: number): LifecycleSnapshot => ({
  trial: { startedAt: inDays(days - 14), endsAt: inDays(days) },
  dunning: null,
});

describe("trial maths and copy", () => {
  it("rounds up whole days and never goes negative", () => {
    expect(trialDaysLeft(inDays(9), now)).toBe(9);
    expect(trialDaysLeft(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(1);
    expect(trialDaysLeft(inDays(-2), now)).toBe(0);
    expect(trialChip(trialOf(1).trial, now)).toBe("Trial · 1 day left");
    expect(trialChip(trialOf(9).trial, now)).toBe("Trial · 9 days left");
    expect(trialChip(null, now)).toBeNull();
  });

  it("warns in the last three days and tells owners exactly what subscribing does", () => {
    const early = buildLifecycleNotices(trialOf(9), { canManage: true, billingEnabled: true, now });
    expect(early[0]).toMatchObject({
      key: "trial",
      tone: "info",
      title: "Your Ordering trial ends in 9 days",
      action: { label: "Subscribe to keep Ordering", href: "/billing?plan=ordering" },
    });
    expect(early[0]!.body).toMatch(/replaces the trial days left/);
    const late = buildLifecycleNotices(trialOf(2), { canManage: true, billingEnabled: true, now });
    expect(late[0]).toMatchObject({ tone: "warn", title: "Your Ordering trial ends in 2 days" });
  });

  it("never offers a purchase to non-owners or while payments are off", () => {
    const staff = buildLifecycleNotices(trialOf(5), {
      canManage: false,
      billingEnabled: true,
      now,
    });
    expect(staff[0]!.action).toBeNull();
    expect(staff[0]!.body).toMatch(/Ask your organization owner/);
    const off = buildLifecycleNotices(trialOf(5), { canManage: true, billingEnabled: false, now });
    expect(off[0]!.action).toBeNull();
  });
});

describe("payment-problem notices", () => {
  const retrying: LifecycleSnapshot = {
    trial: null,
    dunning: { status: "pending", graceUntil: inDays(4) },
  };
  it("explains the grace window while the payment is retried", () => {
    const [n] = buildLifecycleNotices(retrying, { canManage: true, billingEnabled: true, now });
    expect(n).toMatchObject({ key: "dunning-retrying", tone: "warn" });
    expect(n!.body).toContain("Your access continues until 14 Nov 2026");
    expect(n!.action).toEqual({ label: "View billing", href: "/billing" });
  });
  it("says plainly that the menu keeps working once the subscription has stopped", () => {
    const [n] = buildLifecycleNotices(
      { trial: null, dunning: { status: "halted", graceUntil: null } },
      { canManage: true, billingEnabled: true, now }
    );
    expect(n).toMatchObject({ key: "dunning-stopped", tone: "alert" });
    expect(n!.body).toMatch(/menu and QR codes keep working/);
    expect(n!.action?.label).toBe("Subscribe again");
  });
  it("shows nothing when there is nothing to say", () => {
    expect(
      buildLifecycleNotices(
        { trial: null, dunning: null },
        { canManage: true, billingEnabled: true }
      )
    ).toEqual([]);
  });
});

describe("during a trial the next-plan tile means 'keep what you have'", () => {
  it("frames the same before/after rows as what subscribing keeps", () => {
    const next = nextUpFor("ordering", { trialActive: true })!;
    expect(next).toMatchObject({ plan: "ordering", mode: "keep" });
    expect(next.benefits.map((b) => [b.key, b.from, b.to])).toContainEqual(["dishes", "20", "200"]);
    expect(nextUpFor("ordering", { trialActive: false })?.plan).toBe("kitchen_pro");
    expect(nextUpFor("free", { trialActive: true })?.plan).toBe("ordering");
  });

  it("gives the dashboard widget a status chip, a subscribe button and no duplicate trial notice", () => {
    const view = buildBentoView({
      plan: "ordering",
      usage: null,
      intake: null,
      canManageBilling: true,
      billingEnabled: true,
      lifecycle: trialOf(9),
      now,
    })!;
    expect(view.statusChip).toBe("Trial · 9 days left");
    expect(view.next).toMatchObject({ mode: "keep" });
    expect(view.cta).toEqual({
      kind: "upgrade",
      label: "Subscribe to keep Ordering",
      href: "/billing?plan=ordering",
    });
    expect(view.notices).toEqual([]);
  });

  it("surfaces a failed renewal on the widget", () => {
    const view = buildBentoView({
      plan: "ordering",
      usage: null,
      intake: null,
      canManageBilling: true,
      billingEnabled: true,
      lifecycle: { trial: null, dunning: { status: "pending", graceUntil: inDays(3) } },
      now,
    })!;
    expect(view.notices.map((n) => n.key)).toEqual(["dunning-retrying"]);
  });
});

describe("billing page during a trial or a failed renewal", () => {
  const base = {
    organizationName: "Saffron",
    intake: null,
    usage: null,
    canManage: true,
    billing: { billingEnabled: true, kitchenCommerceEnabled: false, subscriptions: [], grants: [] },
    now,
  };
  it("shows the trial in the cycle, banner and chip, and lets the owner subscribe from the current plan", () => {
    const view = buildBillingPageView({ ...base, plan: "ordering", lifecycle: trialOf(9) });
    expect(view.cycle).toMatchObject({
      headline: "Trial ends 19 Nov 2026",
      payment: "None needed yet",
    });
    expect(view.trial).toEqual({ endsAt: inDays(9), daysLeft: 9 });
    expect(view.notices.map((n) => n.key)).toEqual(["trial"]);
    const ordering = view.ladder.find((c) => c.key === "ordering")!;
    expect(ordering.state).toBe("current");
    expect(ordering.action).toMatchObject({
      kind: "checkout",
      label: "Subscribe to keep Ordering",
    });
    expect(view.next).toMatchObject({ mode: "keep" });
  });
  it("blocks the subscribe action for non-owners and while billing is off, with a reason", () => {
    const staff = buildBillingPageView({
      ...base,
      canManage: false,
      plan: "ordering",
      lifecycle: trialOf(9),
    });
    expect(staff.ladder.find((c) => c.key === "ordering")).toMatchObject({
      action: null,
      note: "Only the organization owner can subscribe.",
    });
    const off = buildBillingPageView({
      ...base,
      plan: "ordering",
      lifecycle: trialOf(9),
      billing: { ...base.billing, billingEnabled: false },
    });
    expect(off.ladder.find((c) => c.key === "ordering")?.note).toBe("Paid plans are opening soon.");
  });
  it("describes the retry window instead of calling it a gift", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "ordering",
      lifecycle: { trial: null, dunning: { status: "pending", graceUntil: inDays(4) } },
    });
    expect(view.cycle.headline).toBe("Payment retry until 14 Nov 2026");
    expect(view.notices[0]).toMatchObject({ key: "dunning-retrying" });
  });
});
