import { describe, expect, it } from "vitest";
import { assessFiscalReadiness } from "../src/modules/pos/fiscal-readiness";

const packet = {
  saleId: "sale-fixture",
  outletId: "outlet-fixture",
  country: "IN",
  currency: "INR",
  sellerCountry: "IN",
  sellerRegime: "requires_review",
  sellerName: "Sample Registered Seller",
  sellerAddress: "Test address, Rajasthan",
  sellerTaxRegistration: "08ABCDE1234F1Z5",
  customer: {
    supplyType: "b2b",
    placeOfSupplyStateCode: "08",
    name: "Fixture Buyer",
    taxRegistration: "08ABCDE1234F1Z5",
  },
  lines: [
    {
      classification: "996331",
      placeOfSupplyStateCode: "08",
      taxComponents: [
        { kind: "CGST", amountMinor: "90" },
        { kind: "SGST", amountMinor: "90" },
      ],
    },
  ],
  billFrozen: true,
  billCurrency: "INR",
  billTaxMode: "classified",
  taxableBaseMinor: "1000",
  taxMinor: "180",
  totalMinor: "1180",
  taxProfileRevision: 1,
  jurisdictionPolicy: "registered_external_adapter_required_v1",
  operatorFiscalApproved: true,
  operatorDocumentsEnabled: true,
  externalAdapterInstalled: false,
  irpIntegrationVerified: false,
  statutoryIssuanceAllowed: false,
} as const;

describe("POS E: no statutory issuance from generic billing or readiness evidence", () => {
  it("identifies configured India fields but never certifies fiscal issuance", () => {
    const result = assessFiscalReadiness(packet);
    expect(result.supportedDiagnosticCountry).toBe("IN");
    expect(result.reviewOnly).toBe(true);
    expect(result.statutoryIssuanceAllowed).toBe(false);
    expect(result.checks.find((c) => c.id === "registration")?.satisfied).toBe(true);
    expect(result.checks.find((c) => c.id === "external")?.satisfied).toBe(false);
    expect(result.checks.find((c) => c.id === "serial")?.satisfied).toBe(false);
    expect(result.failedCount).toBeGreaterThan(0);
  });

  it("does not equate generic classified tax with a GST component breakdown", () => {
    const result = assessFiscalReadiness({
      ...packet,
      lines: [{ classification: "FOOD", rateBps: 500 }],
      customer: {},
      totalMinor: "1100",
    });
    expect(result.checks.find((c) => c.id === "classification")?.satisfied).toBe(false);
    expect(result.checks.find((c) => c.id === "buyer")?.satisfied).toBe(false);
    expect(result.checks.find((c) => c.id === "bill")?.satisfied).toBe(false);
  });

  it("rejects forged readiness or arbitrary country claims", () => {
    expect(() => assessFiscalReadiness({ ...packet, externalAdapterInstalled: true })).toThrow();
    expect(() => assessFiscalReadiness({ ...packet, statutoryIssuanceAllowed: true })).toThrow();
    const unsupported = assessFiscalReadiness({
      ...packet,
      country: "OM",
      sellerCountry: "OM",
    });
    expect(unsupported.supportedDiagnosticCountry).toBeNull();
    expect(unsupported.statutoryIssuanceAllowed).toBe(false);
  });
});
