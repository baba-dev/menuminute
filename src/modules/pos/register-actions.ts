/** Which billing actions the order register offers for one row. Pure so it can be tested. */
export type RegisterBillingRow = {
  orderId: string;
  saleId: string | null;
  status: string;
  paymentStatus: string;
};

export type RegisterBillingAction = { kind: "bill" | "payment"; label: string; href: string };

const DEAD = new Set(["cancelled", "rejected", "expired"]);

/**
 * "Show bill" and "Record payment" for an unpaid, live order. Both open the existing Ledger on the exact
 * sale, so the shift, frozen-bill and manual-attestation rules of the finance commands still apply. An
 * order with no POS sale yet is first attached in the Till, where a sale is created.
 */
export function registerBillingActions(row: RegisterBillingRow): RegisterBillingAction[] {
  if (row.paymentStatus !== "unpaid" || DEAD.has(row.status)) return [];
  if (!row.saleId) {
    const href = "/dashboard/pos?attachOrder=" + encodeURIComponent(row.orderId);
    return [
      { kind: "bill", label: "Show bill", href },
      { kind: "payment", label: "Record payment", href },
    ];
  }
  const base = "/dashboard/pos/ledger?sale=" + encodeURIComponent(row.saleId) + "&focus=";
  return [
    { kind: "bill", label: "Show bill", href: base + "bill" },
    { kind: "payment", label: "Record payment", href: base + "payment" },
  ];
}
