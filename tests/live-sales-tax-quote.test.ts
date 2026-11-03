import { describe, expect, it } from "vitest";
import {
  calculateCheckoutTax,
  checkoutTaxPolicySchema,
  requireCheckoutRevision,
} from "../src/modules/tax/checkout";

const configured = {
  revision: 3,
  status: "configured" as const,
  label: "Merchant sales tax",
  rateBps: 500,
  inclusive: false,
  applied: true,
  currency: "INR",
};

describe("Live merchant tax checkout boundaries", () => {
  it("never silently activates a previously configured preview-only rate", () => {
    const previewOnly = calculateCheckoutTax("INR", ["10000"], { ...configured, applied: false, rateBps: 0 });
    expect(previewOnly).toMatchObject({
      taxableBaseMinor: "10000",
      taxMinor: "0",
      totalMinor: "10000",
    });
    const enabled = calculateCheckoutTax("INR", ["10000"], configured);
    expect(enabled).toMatchObject({ taxableBaseMinor: "10000", taxMinor: "500", totalMinor: "10500" });
  });

  it("rejects stale revisions, missing live confirmations and mismatched currencies", () => {
    expect(() => requireCheckoutRevision(undefined, configured)).toThrow();
    expect(() => requireCheckoutRevision(2, configured)).toThrow();
    expect(() => requireCheckoutRevision(3, configured)).not.toThrow();
    expect(() => calculateCheckoutTax("USD", ["10000"], configured)).toThrow();
    expect(() => requireCheckoutRevision(undefined, { ...configured, applied: false })).not.toThrow();
  });

  it("uses exact per-line half-up rounding for 0, 2 and 3 decimals", () => {
    const yen = calculateCheckoutTax("JPY", ["11", "11"], {
      ...configured, currency: "JPY",
    });
    expect(yen).toMatchObject({ exponent: 0, taxMinor: "2", totalMinor: "24" });
    const rupees = calculateCheckoutTax("INR", ["101", "101"], configured);
    expect(rupees).toMatchObject({ exponent: 2, taxMinor: "10", totalMinor: "212" });
    const baisa = calculateCheckoutTax("OMR", ["1250"], {
      ...configured, currency: "OMR",
    });
    expect(baisa).toMatchObject({ exponent: 3, taxMinor: "63", totalMinor: "1313" });
  });

  it("extracts inclusive tax instead of charging a second time", () => {
    const quote = calculateCheckoutTax("INR", ["10500"], {
      ...configured, inclusive: true,
    });
    expect(quote).toMatchObject({
      subtotalMinor: "10500",
      taxableBaseMinor: "10000",
      taxMinor: "500",
      totalMinor: "10500",
    });
  });

  it("does not accept invalid policy types, rates or money overflows", () => {
    expect(checkoutTaxPolicySchema.safeParse({ ...configured, revision: -1 }).success).toBe(false);
    expect(checkoutTaxPolicySchema.safeParse({ ...configured, fakeAuthorityApproval: true }).success).toBe(false);
    expect(() => calculateCheckoutTax("INR", ["2147483647"], configured)).toThrow();
  });
});
