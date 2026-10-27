import { describe, expect, it } from "vitest";
import {
  canonicalOutletTimezone,
  canonicalTimezoneOptions,
  isRuntimeTimezone,
  outletLocalClock,
} from "@/lib/outlet-timezones";
import { createRestaurantSchema } from "@/modules/restaurants/service";

describe("outlet timezone contract", () => {
  it("canonicalizes the incident-causing legacy alias", () => {
    expect(canonicalOutletTimezone(" Asia/Calcutta ")).toBe("Asia/Kolkata");
    expect(canonicalTimezoneOptions()).toContain("Asia/Kolkata");
    expect(canonicalTimezoneOptions()).not.toContain("Asia/Calcutta");
  });

  it("never accepts arbitrary offsets, invalid identifiers or device timezone", () => {
    for (const timezone of ["Mars/Olympus", "+05:30", "", "../../UTC", "Asia/NoSuchCity"]) {
      expect(isRuntimeTimezone(timezone)).toBe(false);
    }
  });

  it("normalizes the alias in the first-outlet schema", () => {
    const result = createRestaurantSchema.parse({
      name: "Timezone test outlet",
      country: "IN",
      currency: "INR",
      timezone: "Asia/Calcutta",
      outletType: "restaurant",
    });
    expect(result.timezone).toBe("Asia/Kolkata");
  });

  it("uses the outlet timezone for preview independent of process timezone", () => {
    const instant = new Date("2026-10-27T00:00:00.000Z");
    expect(outletLocalClock("Asia/Kolkata", instant)).toContain("5:30");
    expect(outletLocalClock("Asia/Muscat", instant)).toContain("4:00");
  });
});
