import { describe, expect, it } from "vitest";
import {
  browserOutletRegion,
  currencyFor,
  regions,
  suggestedCurrencyForCountry,
} from "../src/modules/onboarding/locales";
import { currencyExponent, displayToMinor } from "../src/lib/money";

describe("worldwide merchant onboarding hints", () => {
  it("has unique two-letter countries and only valid suggested currencies", () => {
    expect(new Set(regions).size).toBe(regions.length);
    for (const [country, currency] of Object.entries(currencyFor)) {
      expect(regions).toContain(country);
      expect(currencyExponent(currency)).not.toBeNull();
    }
  });

  it("uses browser region and timezone only as suggestions for new outlets", () => {
    expect(browserOutletRegion("en-US", "America/New_York")).toEqual({
      country: "US",
      currency: "USD",
      timezone: "America/New_York",
    });
    expect(browserOutletRegion("ar-OM", "Asia/Muscat")).toEqual({
      country: "OM",
      currency: "OMR",
      timezone: "Asia/Muscat",
    });
    expect(browserOutletRegion("ja-JP", "Asia/Tokyo")?.currency).toBe("JPY");
    expect(browserOutletRegion("en", "UTC")).toBeNull();
    expect(browserOutletRegion("en-XX", "UTC")).toBeNull();
    expect(browserOutletRegion("en-US", "Not/AZone")?.timezone).toBe("UTC");
  });

  it("does not silently retain an unrelated currency for unmapped regions", () => {
    expect(suggestedCurrencyForCountry("US")).toBe("USD");
    expect(suggestedCurrencyForCountry("OM")).toBe("OMR");
    expect(suggestedCurrencyForCountry("BW")).toBe("");
    expect(browserOutletRegion("en-BW", "Africa/Gaborone")).toMatchObject({
      country: "BW",
      currency: "",
    });
  });
});

describe("minor-unit price precision across currencies", () => {
  it.each([
    ["JPY", 0, "120", 120],
    ["INR", 2, "120.50", 12050],
    ["USD", 2, "120.50", 12050],
    ["OMR", 3, "1.250", 1250],
    ["BHD", 3, "1.234", 1234],
  ] as const)("%s preserves %d fraction digits", (currency, exponent, value, minor) => {
    expect(currencyExponent(currency)).toBe(exponent);
    expect(displayToMinor(value, currency)).toBe(minor);
  });

  it("rejects fractional subunits, unsupported codes, and overflowing amounts", () => {
    expect(() => displayToMinor("1.1", "JPY")).toThrow();
    expect(() => displayToMinor("1.2345", "OMR")).toThrow();
    expect(() => displayToMinor("1.001", "INR")).toThrow();
    expect(() => displayToMinor("10", "NOT_A_CURRENCY")).toThrow();
    expect(() => displayToMinor("2147483648", "JPY")).toThrow();
    expect(() => displayToMinor("1e10", "USD")).toThrow();
    expect(() => displayToMinor("-1", "USD")).toThrow();
  });
});
