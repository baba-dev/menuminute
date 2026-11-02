import { describe, expect, it } from "vitest";
import {
  percentToBasisPoints,
  previewMerchantSalesTax,
  salesTaxPolicySchema,
} from "../src/modules/tax/sales-tax";
import { taxSettingsCommandSchema } from "../src/modules/tax/service";

const exclusive = {
  status: "configured" as const,
  label: "Sales tax",
  rateBps: 500,
  inclusive: false,
};
describe("outlet sales tax preferences and calculation", () => {
  it("parses only exact decimal percentages, without floating-point conversion", () => {
    expect(percentToBasisPoints("5")).toBe(500);
    expect(percentToBasisPoints("5.25")).toBe(525);
    expect(percentToBasisPoints("0.01")).toBe(1);
    expect(percentToBasisPoints("100.00")).toBe(10_000);
    for (const raw of ["-1", "1.234", "100.01", "NaN", "1e2", " 5", "5.", ""] as const)
      expect(percentToBasisPoints(raw)).toBeNull();
  });
  it("quotes exclusive tax correctly for INR, USD, JPY and OMR", () => {
    expect(previewMerchantSalesTax("INR", ["20000"], exclusive)).toMatchObject({
      subtotalMinor: "20000", taxableBaseMinor: "20000", taxMinor: "1000", totalMinor: "21000",
      currency: "INR", quotationOnly: true,
    });
    expect(previewMerchantSalesTax("USD", ["20000"], exclusive).taxMinor).toBe("1000");
    expect(
      previewMerchantSalesTax("JPY", ["100"], { ...exclusive, rateBps: 800 })
    ).toMatchObject({ exponent: 0, taxMinor: "8", totalMinor: "108" });
    expect(previewMerchantSalesTax("OMR", ["1250"], exclusive)).toMatchObject({
      exponent: 3, taxMinor: "63", totalMinor: "1313",
    });
  });
  it("extracts inclusive tax instead of charging it twice", () => {
    const result = previewMerchantSalesTax("INR", ["21000"], { ...exclusive, inclusive: true });
    expect(result).toMatchObject({
      subtotalMinor: "21000", taxableBaseMinor: "20000", taxMinor: "1000", totalMinor: "21000",
    });
  });
  it("rounds independently per line, and sums exactly to the receipt total", () => {
    const result = previewMerchantSalesTax("JPY", ["11", "11"], {
      ...exclusive, rateBps: 500,
    });
    expect(result.lineAmounts.map((line) => line.taxMinor)).toEqual(["1", "1"]);
    expect(result).toMatchObject({ taxMinor: "2", totalMinor: "24" });
    expect(result.lineAmounts.reduce((sum, line) => sum + BigInt(line.totalMinor), 0n))
      .toBe(BigInt(result.totalMinor));
  });
  it("keeps unconfigured and explicit no-tax policies distinct", () => {
    const unconfigured = previewMerchantSalesTax("INR", ["10000"], {
      status: "unconfigured", label: "Sales tax", rateBps: 0, inclusive: false,
    });
    const noTax = previewMerchantSalesTax("INR", ["10000"], {
      status: "no_tax", label: "Sales tax", rateBps: 0, inclusive: false,
    });
    expect(unconfigured.taxMinor).toBe("0");
    expect(noTax.taxMinor).toBe("0");
    expect(unconfigured.status).toBe("unconfigured");
    expect(noTax.status).toBe("no_tax");
  });
  it("rejects invalid rates, invalid minor amounts, unsupported currencies and overflow", () => {
    expect(salesTaxPolicySchema.safeParse({ ...exclusive, rateBps: 10001 }).success).toBe(false);
    expect(salesTaxPolicySchema.safeParse({ ...exclusive, status: "no_tax" }).success).toBe(false);
    expect(() => previewMerchantSalesTax("FAKE", ["100"], exclusive)).toThrow();
    expect(() => previewMerchantSalesTax("INR", ["0.1"], exclusive)).toThrow();
    expect(() => previewMerchantSalesTax("INR", ["2147483647"], exclusive)).toThrow();
    expect(() => previewMerchantSalesTax("INR", [], exclusive)).toThrow();
  });
  it("requires explicit confirmation and expected revision for mutation", () => {
    const policy = exclusive;
    expect(taxSettingsCommandSchema.safeParse({
      policy, confirmed: true, expectedRevision: 0,
    }).success).toBe(true);
    expect(taxSettingsCommandSchema.safeParse({
      policy, confirmed: false, expectedRevision: 0,
    }).success).toBe(false);
    expect(taxSettingsCommandSchema.safeParse({
      policy, confirmed: true, expectedRevision: -1,
    }).success).toBe(false);
  });
});
