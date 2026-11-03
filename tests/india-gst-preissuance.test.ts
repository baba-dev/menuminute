import { describe, expect, it } from "vitest";
import { indiaGstDraftInputSchema, reviewIndiaGstDraft } from "../src/modules/pos/india-gst";

const frozen = {
  saleId: "sale-123",
  outletId: "outlet-a",
  country: "IN",
  currency: "INR",
  sellerCountry: "IN",
  sellerRegime: "requires_review",
  sellerName: "Fixture Foods Private Limited",
  sellerAddress: "Fixture address, Rajasthan, India",
  sellerTaxRegistration: "08ABCDE1234F1Z5",
  customer: {},
  lines: [{
    name: "Food preparation service",
    quantity: 1,
    baseMinor: "10000",
    taxMinor: "1800",
    totalMinor: "11800",
    classification: "996331",
    rateBps: 1800,
  }],
  billFrozen: true,
  billCurrency: "INR",
  billTaxMode: "classified",
  taxableBaseMinor: "10000",
  taxMinor: "1800",
  totalMinor: "11800",
  taxProfileRevision: 5,
  jurisdictionPolicy: "registered_external_adapter_required_v1",
  operatorFiscalApproved: true,
  operatorDocumentsEnabled: true,
  externalAdapterInstalled: false,
  irpIntegrationVerified: false,
  statutoryIssuanceAllowed: false,
};
const input = {
  saleId: "sale-123",
  kind: "tax_invoice_draft",
  supplyType: "b2c",
  placeOfSupplyStateCode: "08",
  reverseCharge: false,
  irpDecision: "undetermined",
  buyer: { name: "Sample Buyer", address: "Address in Rajasthan", stateCode: "08", gstin: "" },
  lines: [{
    hsnSac: "996331",
    classification: "services",
    unitCode: "NOS",
    rateBps: 1800,
    cessBps: 0,
    componentMode: "cgst_sgst",
  }],
} as const;

describe("India GST pre-issuance adapter: never legal issuance", () => {
  it("splits intra-state CGST and SGST exactly and reconciles a frozen bill", () => {
    const draft = reviewIndiaGstDraft(frozen, input);
    expect(draft.lines[0]).toMatchObject({
      taxableBaseMinor: "10000",
      cgstMinor: "900",
      sgstMinor: "900",
      igstMinor: "0",
      cessMinor: "0",
      totalMinor: "11800",
      reconciled: true,
    });
    expect(draft.totalMinor).toBe(frozen.totalMinor);
    expect("issuanceAllowed" in draft).toBe(false);
    expect(draft.statutoryIssuanceAllowed).toBe(false);
    expect(draft.serialAllocated).toBe(false);
    expect(draft.irpVerified).toBe(false);
    expect(draft.issues).toBeGreaterThan(0);
    expect(draft.notice).toMatch(/NOT A TAX INVOICE/);
  });

  it("computes inter-state IGST and rejects a wrong GST component basis", () => {
    const outOfState = { ...input, placeOfSupplyStateCode: "27",
      lines: [{ ...input.lines[0], componentMode: "igst" as const }] };
    const ok = reviewIndiaGstDraft(frozen, outOfState);
    expect(ok.lines[0]).toMatchObject({ cgstMinor: "0", sgstMinor: "0", igstMinor: "1800", reconciled: true });
    const bad = reviewIndiaGstDraft(frozen, { ...outOfState, lines: input.lines });
    expect(bad.checks.find((c) => c.id === "line_0_place_of_supply")?.satisfied).toBe(false);
  });

  it("reconciles bill-of-supply zero GST without producing an official bill of supply", () => {
    const taxFree = { ...frozen, lines: [{ ...frozen.lines[0], taxMinor: "0", totalMinor: "10000" }],
      taxMinor: "0", totalMinor: "10000" };
    const draft = reviewIndiaGstDraft(taxFree, { ...input, kind: "bill_of_supply_draft",
      lines: [{ ...input.lines[0], rateBps: 0 }] });
    expect(draft.checks.find((c) => c.id === "bill_of_supply")?.satisfied).toBe(true);
    expect(draft.statutoryIssuanceAllowed).toBe(false);
    const invalid = reviewIndiaGstDraft(frozen, { ...input, kind: "bill_of_supply_draft" });
    expect(invalid.checks.find((c) => c.id === "bill_of_supply")?.satisfied).toBe(false);
  });

  it("requires B2B buyer GSTIN and matches buyer GSTIN state code", () => {
    expect(() => reviewIndiaGstDraft(frozen, { ...input, supplyType: "b2b" })).not.toThrow();
    const missing = reviewIndiaGstDraft(frozen, { ...input, supplyType: "b2b" });
    expect(missing.checks.find((c) => c.id === "buyer")?.satisfied).toBe(false);
    const buyer = { ...input.buyer, gstin: "27ABCDE1234F1Z5", stateCode: "08" };
    const mismatch = reviewIndiaGstDraft(frozen, { ...input, supplyType: "b2b", buyer });
    expect(mismatch.checks.find((c) => c.id === "buyer_state")?.satisfied).toBe(false);
  });

  it("will not adjust a posted total to make a new tax classification appear to fit", () => {
    const wrongRate = reviewIndiaGstDraft(frozen, { ...input,
      lines: [{ ...input.lines[0], rateBps: 500 }] });
    expect(wrongRate.lines[0]).toMatchObject({ reconciled: false });
    expect(wrongRate.checks.find((c) => c.id === "ledger_totals")?.satisfied).toBe(false);
    expect(wrongRate.frozenBillTotalMinor).toBe("11800");
  });

  it("detects missing lines, stale sale identifiers and unsupported outlet currency", () => {
    const missing = reviewIndiaGstDraft({ ...frozen, lines: [...frozen.lines, ...frozen.lines] }, input);
    expect(missing.checks.find((c) => c.id === "number_of_lines")?.satisfied).toBe(false);
    const stale = reviewIndiaGstDraft(frozen, { ...input, saleId: "sale-456" });
    expect(stale.checks.find((c) => c.id === "frozen_bill")?.satisfied).toBe(false);
    const outsideIndia = reviewIndiaGstDraft({ ...frozen, currency: "OMR", billCurrency: "OMR" }, input);
    expect(outsideIndia.checks.find((c) => c.id === "jurisdiction")?.satisfied).toBe(false);
  });

  it("never accepts client-side prices, official IRN flags or extra unrecognized fields", () => {
    expect(indiaGstDraftInputSchema.safeParse({ ...input, totalMinor: "0" }).success).toBe(false);
    expect(indiaGstDraftInputSchema.safeParse({ ...input, statutoryIssuanceAllowed: true }).success).toBe(false);
    expect(indiaGstDraftInputSchema.safeParse({ ...input,
      buyer: { ...input.buyer, password: "no" } }).success).toBe(false);
    expect(indiaGstDraftInputSchema.safeParse({ ...input,
      lines: [{ ...input.lines[0], hsnSac: "FOOD" }] }).success).toBe(false);
    const falseClaim = reviewIndiaGstDraft(frozen, { ...input, irpDecision: "not_required" });
    expect(falseClaim.irpVerified).toBe(false);
    expect(falseClaim.statutoryIssuanceAllowed).toBe(false);
  });
});
