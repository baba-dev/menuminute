import { describe, expect, it } from "vitest";
import { formatFinancialDocumentEmail } from "@/modules/pos/document-email";

describe("private financial document email", () => {
  const snapshot = {
    bill: {
      currency: "INR",
      subtotalMinor: "26500",
      taxMinor: "1500",
      totalMinor: "28000",
      seller: { legalName: "The Example Bakery", registeredAddress: "Main Road" },
      customer: { name: "Customer" },
      lines: [
        {
          name: "Paneer\nSandwich",
          variant: "Large",
          quantity: 2,
          totalMinor: "28000",
        },
      ],
    },
    legalStatus: "non_tax_receipt",
  };
  it("sends itemized immutable values in human-readable currency and strips line breaks", () => {
    const text = formatFinancialDocumentEmail({
      documentNumber: "RECEIPT-2026-00001",
      kind: "receipt",
      snapshot,
    });
    expect(text).toContain("2 × Paneer Sandwich (Large) — INR");
    expect(text).toContain("Total billed: INR");
    expect(text).toContain("280.00");
    expect(text).not.toContain("28000 minor units");
    expect(text).not.toContain("Paneer\nSandwich");
    expect(text).toContain("not proof of bank settlement");
  });
  it("supports three-decimal currencies without rounding to two decimals", () => {
    const text = formatFinancialDocumentEmail({
      documentNumber: "RECEIPT-2",
      kind: "receipt",
      snapshot: {
        ...snapshot,
        bill: { ...snapshot.bill, currency: "OMR", totalMinor: "12345" },
      },
    });
    expect(text).toContain("OMR");
    expect(text).toContain("12.345");
  });
  it("never guesses financial figures when an archived snapshot is malformed", () => {
    const text = formatFinancialDocumentEmail({
      documentNumber: "RECEIPT-3",
      kind: "receipt",
      snapshot: { bill: { totalMinor: "Infinity" } },
    });
    expect(text).toContain("could not be formatted");
    expect(text).not.toContain("Total billed");
    expect(text).toContain("contact the restaurant");
    expect(text).not.toContain("private Ledger");
  });
});
