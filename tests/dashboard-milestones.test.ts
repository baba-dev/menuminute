import { describe, expect, it } from "vitest";
import {
  crossedMilestone,
  hasSeenMilestone,
  markMilestoneSeen,
  milestoneStorageKey,
  outletLocalDate,
} from "../src/modules/dashboard/milestones";

describe("service milestones", () => {
  it("fires only when a successful read crosses a threshold", () => {
    expect(crossedMilestone(0, 1)?.id).toBe("first-order");
    expect(crossedMilestone(24, 25)?.id).toBe("orders-25");
    expect(crossedMilestone(99, 100)?.id).toBe("orders-100");
  });

  it("never replays on load, on no change, or when the counter falls", () => {
    expect(crossedMilestone(null, 40)).toBeNull();
    expect(crossedMilestone(30, 30)).toBeNull();
    expect(crossedMilestone(30, 31)).toBeNull();
    expect(crossedMilestone(120, 0)).toBeNull();
    expect(crossedMilestone(0, Number.NaN)).toBeNull();
  });

  it("shows one ticket for a jump, choosing the most significant milestone", () => {
    expect(crossedMilestone(0, 30)?.id).toBe("orders-25");
    expect(crossedMilestone(0, 120)?.id).toBe("orders-100");
  });

  it("uses the outlet-local date, not the browser's", () => {
    // 23:30 UTC on 1 Jan is already 2 Jan in Kolkata and still 1 Jan in New York.
    const at = "2027-01-01T23:30:00.000Z";
    expect(outletLocalDate(at, "Asia/Kolkata")).toBe("2027-01-02");
    expect(outletLocalDate(at, "America/New_York")).toBe("2027-01-01");
    expect(outletLocalDate("not a date", "UTC")).toBe("");
    expect(outletLocalDate(at, "Not/AZone")).toBe("2027-01-01");
  });

  it("remembers once per outlet, day and milestone, even when storage is unavailable", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const seen = new Set<string>();
    const key = milestoneStorageKey("outlet1", "2027-01-02", "first-order");
    expect(hasSeenMilestone(storage, key, seen)).toBe(false);
    markMilestoneSeen(storage, key, seen);
    expect(hasSeenMilestone(storage, key, new Set())).toBe(true);
    expect(
      hasSeenMilestone(storage, milestoneStorageKey("outlet2", "2027-01-02", "first-order"), seen)
    ).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const session = new Set<string>();
    expect(hasSeenMilestone(broken, key, session)).toBe(false);
    markMilestoneSeen(broken, key, session);
    expect(hasSeenMilestone(broken, key, session)).toBe(true);
    expect(hasSeenMilestone(null, key, new Set())).toBe(false);
  });
});
