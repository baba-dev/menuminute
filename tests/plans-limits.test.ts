import { describe, expect, it } from "vitest";
import { LimitReachedError, serializeError } from "../src/lib/errors";
import { PLAN_LIMITS } from "../src/modules/plans/catalog";
import {
  assertWithinLimit,
  checkLimit,
  resolveLimits,
  resolvePlan,
  upgradeTargetFor,
} from "../src/modules/plans/limits";

describe("plan resolution", () => {
  it("defaults to Free and lets the highest active entitlement win", () => {
    expect(resolvePlan({ ordering: false, kitchen: false })).toBe("free");
    expect(resolvePlan({ ordering: true, kitchen: false })).toBe("ordering");
    expect(resolvePlan({ ordering: false, kitchen: true })).toBe("kitchen_pro");
    expect(resolvePlan({ ordering: true, kitchen: true })).toBe("kitchen_pro");
    expect(resolvePlan({ ordering: true, kitchen: true, dedicated: true })).toBe("dedicated");
  });
});

describe("approved caps", () => {
  it("matches the owner-approved Free, Ordering and Kitchen Pro numbers", () => {
    expect(PLAN_LIMITS.free).toMatchObject({
      dishes: 20,
      qrCodes: 2,
      ordersPerMonth: 100,
      mediaBytes: 100 * 1024 * 1024,
    });
    expect(PLAN_LIMITS.ordering).toMatchObject({ dishes: 200, mediaBytes: 300 * 1024 * 1024 });
    expect(PLAN_LIMITS.kitchen_pro.mediaBytes).toBe(500 * 1024 * 1024);
    expect(PLAN_LIMITS.kitchen_pro.customDomains).toBe(10);
    // Dining floor (owner-approved 2026-11-02): tables and chairs, Dedicated unlimited.
    expect([PLAN_LIMITS.free.tables, PLAN_LIMITS.free.chairs]).toEqual([2, 6]);
    expect([PLAN_LIMITS.ordering.tables, PLAN_LIMITS.ordering.chairs]).toEqual([10, 30]);
    expect([PLAN_LIMITS.kitchen_pro.tables, PLAN_LIMITS.kitchen_pro.chairs]).toEqual([20, 60]);
    expect([PLAN_LIMITS.dedicated.tables, PLAN_LIMITS.dedicated.chairs]).toEqual([null, null]);
    expect(PLAN_LIMITS.free.customDomains).toBe(0);
  });
  it("is non-decreasing across self-serve tiers for every resource", () => {
    for (const k of Object.keys(PLAN_LIMITS.free) as (keyof typeof PLAN_LIMITS.free)[]) {
      const f = PLAN_LIMITS.free[k];
      const o = PLAN_LIMITS.ordering[k];
      const p = PLAN_LIMITS.kitchen_pro[k];
      if (k === "ordersPerMonth") continue; // Free is capped; paid tiers are uncapped
      expect(o ?? Infinity).toBeGreaterThanOrEqual(f ?? Infinity);
      expect(p ?? Infinity).toBeGreaterThanOrEqual(o ?? Infinity);
    }
  });
});

describe("limit checks", () => {
  const free = resolveLimits("free");
  it("allows up to the cap and rejects beyond it", () => {
    expect(checkLimit("free", free, "dishes", 19)).toEqual({ allowed: true, remaining: 0 });
    expect(checkLimit("free", free, "dishes", 20)).toEqual({
      allowed: false,
      limit: 20,
      remaining: 0,
      upgradeTo: "ordering",
    });
  });
  it("rejects a batch that would cross the cap even if one more fits", () => {
    expect(checkLimit("free", free, "dishes", 15, 6).allowed).toBe(false);
    expect(checkLimit("free", free, "dishes", 15, 5).allowed).toBe(true);
  });
  it("points at the first plan that can actually hold the request", () => {
    expect(upgradeTargetFor("free", "dishes", 21)).toBe("ordering");
    expect(upgradeTargetFor("free", "dishes", 201)).toBe("kitchen_pro");
    expect(upgradeTargetFor("kitchen_pro", "dishes", 2001)).toBeNull();
    expect(upgradeTargetFor("free", "customDomains", 1)).toBe("kitchen_pro");
  });
  it("treats a zero cap as always reached", () => {
    expect(checkLimit("free", free, "kitchenDevices", 0).allowed).toBe(false);
  });
  it("never caps null-limit resources", () => {
    const dedicated = resolveLimits("dedicated");
    expect(checkLimit("dedicated", dedicated, "dishes", 1_000_000)).toEqual({
      allowed: true,
      remaining: null,
    });
  });
  it("rejects invalid counts instead of guessing", () => {
    expect(() => checkLimit("free", free, "dishes", -1)).toThrow(RangeError);
    expect(() => checkLimit("free", free, "dishes", 1.5)).toThrow(RangeError);
    expect(() => checkLimit("free", free, "dishes", 0, 0)).toThrow(RangeError);
  });
});

describe("overrides", () => {
  it("can raise or lift a cap but never lower it", () => {
    const raised = resolveLimits("free", { dishes: 50, qrCodes: 1, staffSeats: null });
    expect(raised.dishes).toBe(50);
    expect(raised.qrCodes).toBe(2);
    expect(raised.staffSeats).toBeNull();
  });
  it("ignores non-finite overrides", () => {
    expect(resolveLimits("free", { dishes: Number.NaN }).dishes).toBe(20);
  });
});

describe("LIMIT_REACHED error", () => {
  it("is typed and serializes without internal detail", () => {
    let caught: unknown;
    try {
      assertWithinLimit("free", resolveLimits("free"), "qrCodes", 2);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LimitReachedError);
    const err = caught as LimitReachedError;
    expect(err).toMatchObject({
      code: "LIMIT_REACHED",
      statusCode: 402,
      resource: "QR codes",
      limit: 2,
      upgradeTo: "Ordering",
    });
    expect(serializeError(err, false)).toEqual({
      message: "Your plan allows 2 QR codes.",
      code: "LIMIT_REACHED",
    });
  });
  it("does not throw while within the cap", () => {
    expect(() => assertWithinLimit("free", resolveLimits("free"), "qrCodes", 1)).not.toThrow();
  });
});
