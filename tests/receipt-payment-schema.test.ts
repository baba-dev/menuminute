import { describe, expect, it } from "vitest";
import { receiptPaymentCommandSchema } from "../src/modules/receipt-payment/service";

const valid = {
  expectedRevision: 0,
  upiId: " Spice@OkHDFC ",
  payeeName: "  Spice   Route ",
  enabled: true,
};

describe("receiptPaymentCommandSchema", () => {
  it("normalises the UPI ID and payee name", () => {
    expect(receiptPaymentCommandSchema.parse(valid)).toEqual({
      expectedRevision: 0,
      upiId: "spice@okhdfc",
      payeeName: "Spice Route",
      enabled: true,
    });
  });
  it("rejects unknown keys, invalid IDs and unusable payee names", () => {
    expect(receiptPaymentCommandSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(receiptPaymentCommandSchema.safeParse({ ...valid, upiId: "a@b&am=1" }).success).toBe(
      false
    );
    expect(receiptPaymentCommandSchema.safeParse({ ...valid, payeeName: "A" }).success).toBe(false);
    expect(receiptPaymentCommandSchema.safeParse({ ...valid, expectedRevision: -1 }).success).toBe(
      false
    );
    expect(receiptPaymentCommandSchema.safeParse({ ...valid, enabled: "yes" }).success).toBe(false);
  });
});
