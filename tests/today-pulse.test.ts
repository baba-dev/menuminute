import { describe, expect, it } from "vitest";
import { outletDayParts, percentChange } from "../src/modules/dashboard/pulse-math";
import { barWindow } from "../src/components/dashboard/pulse/today-pulse";

describe("today pulse helpers", () => {
  it("reads the outlet-local date and hour, not the server's", () => {
    // 2026-11-01 20:30 UTC is already 02:00 on the 2nd in India and 12:30 on the 1st in Los Angeles.
    const now = new Date("2026-11-01T20:30:00Z");
    expect(outletDayParts(now, "Asia/Kolkata")).toEqual({ date: "2026-11-02", hour: 2 });
    expect(outletDayParts(now, "America/Los_Angeles")).toEqual({ date: "2026-11-01", hour: 12 });
    expect(outletDayParts(now, "Asia/Kolkata", -1).date).toBe("2026-11-01");
  });

  it("computes percent change and refuses a zero or invalid baseline", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(100, 100)).toBe(0);
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(Number.NaN, 10)).toBeNull();
  });

  it("windows the hourly bars from just before the first sale to now", () => {
    const hourly = Array.from({ length: 24 }, () => 0);
    expect(barWindow(hourly, 14)).toEqual([9, 10, 11, 12, 13, 14]);
    hourly[8] = 500;
    expect(barWindow(hourly, 14)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(barWindow(hourly, 0)).toEqual([0]);
    expect(barWindow(hourly, 3)[0]).toBe(0);
  });
});
