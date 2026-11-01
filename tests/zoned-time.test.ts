import { describe, expect, it } from "vitest";
import { nextHalfHourLocal, zonedLocalToIso } from "../src/modules/hospitality/zoned-time";

describe("zoned time", () => {
  it("converts outlet wall time to the exact UTC instant", () => {
    expect(zonedLocalToIso("2026-11-01T19:00", "Asia/Kolkata")).toBe("2026-11-01T13:30:00.000Z");
    expect(zonedLocalToIso("2026-11-01T12:00", "America/New_York")).toBe(
      "2026-11-01T17:00:00.000Z"
    );
    expect(zonedLocalToIso("2026-07-01T12:00", "America/New_York")).toBe(
      "2026-07-01T16:00:00.000Z"
    );
    expect(zonedLocalToIso("2026-11-01T09:00", "UTC")).toBe("2026-11-01T09:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(() => zonedLocalToIso("tomorrow", "UTC")).toThrow();
  });
  it("suggests the next half hour in the outlet timezone", () => {
    const now = new Date("2026-11-01T13:40:00Z"); // 19:10 in Kolkata
    expect(nextHalfHourLocal(now, "Asia/Kolkata")).toBe("2026-11-01T19:30");
    expect(nextHalfHourLocal(new Date("2026-11-01T13:50:00Z"), "Asia/Kolkata")).toBe(
      "2026-11-01T20:00"
    );
  });
});
