import { describe, expect, it } from "vitest";
import { registerBillingActions } from "../src/modules/pos/register-actions";

const base = { orderId: "ord_1", saleId: "sale_1", status: "served", paymentStatus: "unpaid" };

describe("registerBillingActions", () => {
  it("offers Show bill and Record payment on the exact sale in the Ledger", () => {
    const actions = registerBillingActions(base);
    expect(actions.map((a) => a.label)).toEqual(["Show bill", "Record payment"]);
    expect(actions[0]!.href).toBe("/dashboard/pos/ledger?sale=sale_1&focus=bill");
    expect(actions[1]!.href).toBe("/dashboard/pos/ledger?sale=sale_1&focus=payment");
  });

  it("sends an order with no POS sale to the Till to be attached first", () => {
    const actions = registerBillingActions({ ...base, saleId: null });
    expect(actions.every((a) => a.href === "/dashboard/pos?attachOrder=ord_1")).toBe(true);
  });

  it("offers nothing for paid, voided or dead orders", () => {
    expect(registerBillingActions({ ...base, paymentStatus: "paid" })).toEqual([]);
    expect(registerBillingActions({ ...base, paymentStatus: "voided" })).toEqual([]);
    for (const status of ["cancelled", "rejected", "expired"])
      expect(registerBillingActions({ ...base, status })).toEqual([]);
  });

  it("encodes ids so they cannot alter the link", () => {
    const [bill] = registerBillingActions({ ...base, saleId: "a&focus=x" });
    expect(bill!.href).toBe("/dashboard/pos/ledger?sale=a%26focus%3Dx&focus=bill");
  });
});
