import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "../src/modules/plans/catalog";
import {
  buildMeter,
  buildPlanUsageView,
  meterState,
  overflowNotice,
} from "../src/modules/plans/view";

describe("meterState", () => {
  it("is ok under 80%, near from 80%, full at the cap and over above it", () => {
    expect(meterState(15, 20)).toBe("ok");
    expect(meterState(16, 20)).toBe("near");
    expect(meterState(19, 20)).toBe("near");
    expect(meterState(20, 20)).toBe("full");
    expect(meterState(23, 20)).toBe("over");
  });
});

describe("buildMeter", () => {
  it("clamps the bar, never conveys state by colour alone and handles existing over-cap data", () => {
    expect(buildMeter("dishes", "Dishes", "dishes", 5, 20)).toMatchObject({
      percent: 25,
      statusText: "15 left",
      state: "ok",
    });
    expect(buildMeter("dishes", "Dishes", "dishes", 20, 20)).toMatchObject({
      percent: 100,
      statusText: "Limit reached",
    });
    expect(buildMeter("dishes", "Dishes", "dishes", 47, 20)).toMatchObject({
      percent: 100,
      state: "over",
      statusText: "27 over the limit",
    });
    expect(buildMeter("dishes", "Dishes", "dishes", -3, 20).used).toBe(0);
  });
});

describe("buildPlanUsageView", () => {
  const free = {
    plan: "free" as const,
    limits: PLAN_LIMITS.free,
    counts: { dishes: 14, qrCodes: 2, tables: 0, chairs: 0 },
  };

  it("shows dish and QR meters for Free and only real, enforced limits", () => {
    const view = buildPlanUsageView({ ...free, intake: null })!;
    expect(view.meters.map((m) => m.key)).toEqual(["dishes", "qrCodes", "tables", "chairs"]);
    expect(view.planLabel).toBe("Free");
    expect(view.nextPlanLabel).toBe("Ordering");
    expect(view.features.find((f) => f.key === "ordering")).toMatchObject({
      status: "locked",
      unlockWith: "Ordering",
    });
  });

  it("adds the monthly order meter only while free intake is on", () => {
    const off = buildPlanUsageView({ ...free, intake: { enabled: false, used: 0, cap: 100 } })!;
    expect(off.meters.map((m) => m.key)).not.toContain("orders");
    const on = buildPlanUsageView({ ...free, intake: { enabled: true, used: 82, cap: 100 } })!;
    expect(on.meters.find((m) => m.key === "orders")).toMatchObject({
      used: 82,
      cap: 100,
      state: "near",
    });
    expect(on.features.find((f) => f.key === "ordering")).toMatchObject({
      status: "limited",
      note: "Up to 100 orders a month",
    });
  });

  it("does not show an order meter to paid plans", () => {
    const view = buildPlanUsageView({
      plan: "ordering",
      limits: PLAN_LIMITS.ordering,
      counts: { dishes: 10, qrCodes: 3, tables: 0, chairs: 0 },
      intake: { enabled: true, used: 5, cap: 100 },
    })!;
    expect(view.meters.map((m) => m.key)).toEqual(["dishes", "qrCodes", "tables", "chairs"]);
    expect(view.nextPlanLabel).toBe("Kitchen Pro");
    expect(view.features.find((f) => f.key === "ordering")?.status).toBe("included");
    expect(view.features.find((f) => f.key === "kitchen")).toMatchObject({
      status: "locked",
      unlockWith: "Kitchen Pro",
    });
  });

  it("marks everything included on Kitchen Pro and renders nothing for contract plans", () => {
    const pro = buildPlanUsageView({
      plan: "kitchen_pro",
      limits: PLAN_LIMITS.kitchen_pro,
      counts: { dishes: 1, qrCodes: 1, tables: 0, chairs: 0 },
      intake: null,
    })!;
    expect(pro.features.every((f) => f.status === "included")).toBe(true);
    expect(pro.nextPlanLabel).toBeNull();
    expect(
      buildPlanUsageView({
        plan: "dedicated",
        limits: PLAN_LIMITS.dedicated,
        counts: { dishes: 9, qrCodes: 9, tables: 0, chairs: 0 },
        intake: null,
      })
    ).toBeNull();
  });
});

describe("upgrade hints", () => {
  it("name what the next plan allows only once usage is near the cap, without prices", () => {
    const calm = buildPlanUsageView({
      plan: "free",
      limits: PLAN_LIMITS.free,
      counts: { dishes: 5, qrCodes: 0, tables: 0, chairs: 0 },
      intake: null,
    })!;
    expect(calm.meters.every((m) => m.upgradeHint === undefined)).toBe(true);
    const hot = buildPlanUsageView({
      plan: "free",
      limits: PLAN_LIMITS.free,
      counts: { dishes: 18, qrCodes: 2, tables: 2, chairs: 6 },
      intake: { enabled: true, used: 100, cap: 100 },
    })!;
    expect(hot.meters.map((m) => m.upgradeHint)).toEqual([
      "Ordering allows 200",
      "Ordering allows 25",
      "Ordering allows 10",
      "Ordering allows 30",
      "Ordering has no monthly cap",
    ]);
    expect(JSON.stringify(hot)).not.toMatch(/₹|\$|price/i);
  });
});

describe("number formatting", () => {
  it("uses a fixed locale so server and browser render identical text", () => {
    expect(buildMeter("dishes", "Dishes", "dishes", 240, 2000).statusText).toBe("1,760 left");
    expect(buildMeter("dishes", "Dishes", "dishes", 2600, 2000).statusText).toBe(
      "600 over the limit"
    );
  });
});

describe("overflow notice", () => {
  const overflow = (hidden: number) => ({
    cap: 20,
    count: 27,
    graceUntil: "2026-12-02T10:00:00Z",
    hidden,
  });
  it("explains the grace period, then what is hidden, and always that nothing is deleted or lost", () => {
    expect(overflowNotice(overflow(0))).toBe(
      "After 2 Dec 2026, dishes beyond the first 20 are hidden from guests. Nothing is deleted."
    );
    expect(overflowNotice(overflow(7))).toMatch(/^7 dishes are hidden from guests\. They are safe/);
    expect(overflowNotice(overflow(1))).toMatch(/^1 dish is hidden from guests/);
  });
  it("attaches only to the dishes meter", () => {
    const view = buildPlanUsageView({
      plan: "free",
      limits: PLAN_LIMITS.free,
      counts: { dishes: 27, qrCodes: 1, tables: 0, chairs: 0 },
      intake: null,
      overflow: overflow(7),
    })!;
    expect(view.meters.find((m) => m.key === "dishes")?.notice).toMatch(/hidden from guests/);
    expect(view.meters.filter((m) => m.notice).map((m) => m.key)).toEqual(["dishes"]);
  });
});
