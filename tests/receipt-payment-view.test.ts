import { describe, expect, it } from "vitest";
import { buildThermalReceipt, payBlockForReceipt } from "../src/modules/pos/thermal-view";
import type { PosReceipt } from "../src/modules/pos/service";
import type { ReceiptPaymentProfile } from "../src/modules/receipt-payment/service";

const profile: ReceiptPaymentProfile = {
  configured: true,
  upiId: "spiceroute@okhdfc",
  payeeName: "Spice Route Kitchen",
  enabled: true,
  revision: 1,
  updatedAt: "2026-11-22T00:00:00.000Z",
};
const receipt = {
  saleId: "sale-1",
  orderNumber: 1042,
  createdAt: "2026-11-22T10:00:00.000Z",
  currency: "INR",
  subtotalMinor: "80000",
  totalMinor: "84000",
  paymentStatus: "pending",
  refundRecorded: false,
  paymentEvidence: "none",
  paymentMethod: null,
  sellerName: "Spice Route Kitchen",
  sellerAddress: null,
  customerName: null,
  customerPhone: null,
  tableNumber: "4",
  tableLabel: null,
  fulfillmentMode: "dine_in",
  issuedDocumentId: null,
  items: [{ name: "Thali", variant: null, quantity: 1, unitMinor: "80000", lineMinor: "80000" }],
} as unknown as PosReceipt;
const outlet = { name: "Spice Route Kitchen", timezone: "Asia/Kolkata" };

describe("payBlockForReceipt", () => {
  it("builds the block for an unpaid INR bill from the receipt's total", () => {
    const block = payBlockForReceipt(receipt, profile)!;
    expect(block.amountLabel).toBe("Rs 840.00");
    expect(block.upiId).toBe("spiceroute@okhdfc");
    expect(block.uri).toContain("pa=spiceroute@okhdfc");
    expect(block.uri).toContain("am=840.00");
    expect(block.uri).toContain("tn=Bill%201042");
    expect(block.uri).toContain("cu=INR");
  });
  it("falls back to the subtotal when the receipt has no total", () => {
    const block = payBlockForReceipt({ ...receipt, totalMinor: undefined }, profile)!;
    expect(block.amountLabel).toBe("Rs 800.00");
  });
  it("prints nothing for paid, refunded, non-INR, zero-total, disabled or missing profiles", () => {
    expect(payBlockForReceipt({ ...receipt, paymentStatus: "complete" }, profile)).toBeNull();
    expect(payBlockForReceipt({ ...receipt, paymentStatus: "refunded" }, profile)).toBeNull();
    expect(payBlockForReceipt({ ...receipt, currency: "USD" }, profile)).toBeNull();
    expect(payBlockForReceipt({ ...receipt, totalMinor: "0" }, profile)).toBeNull();
    expect(payBlockForReceipt(receipt, { ...profile, enabled: false })).toBeNull();
    expect(payBlockForReceipt(receipt, { ...profile, configured: false, upiId: null })).toBeNull();
    expect(payBlockForReceipt(receipt, null)).toBeNull();
  });
});

describe("buildThermalReceipt with a payment profile", () => {
  it("adds payBlock only when the profile qualifies and leaves everything else identical", () => {
    const plain = buildThermalReceipt(receipt, outlet);
    expect("payBlock" in plain).toBe(false);
    const withBlock = buildThermalReceipt(receipt, outlet, profile);
    expect(withBlock.payBlock?.amountLabel).toBe("Rs 840.00");
    const { payBlock: _ignored, ...rest } = withBlock;
    expect(rest).toEqual(plain);
    const paid = buildThermalReceipt({ ...receipt, paymentStatus: "complete" }, outlet, profile);
    expect("payBlock" in paid).toBe(false);
  });
});
