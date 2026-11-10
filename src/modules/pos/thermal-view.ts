import type { PosReceipt } from "@/modules/pos/service";
import type { ThermalReceipt } from "@/lib/pos/thermal-receipt";

/** Formats an immutable minor-unit string for display. Never used to recalculate totals. */
export function formatReceiptMoney(minor: string, currency: string) {
  const precision =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(minor) / 10 ** precision
  );
}

const money = formatReceiptMoney;

/** Single mapping from the immutable POS receipt view to the thermal (ESC/POS) receipt.
 * Shared by the receipt page and the native print bridge so both print exactly the same facts.
 * Prices, taxes and statuses are copied from the receipt, never recalculated.
 */
export function buildThermalReceipt(
  receipt: PosReceipt,
  outlet: { name: string; timezone: string }
): ThermalReceipt {
  const paid = receipt.paymentStatus === "complete";
  const refunded = receipt.paymentStatus === "refunded";
  const staffPaid = paid && receipt.paymentEvidence === "staff_recorded";
  return {
    merchantName: receipt.sellerName ?? outlet.name,
    outletName: outlet.name,
    address: receipt.sellerAddress,
    orderNumber: String(receipt.orderNumber),
    issuedAt: new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: outlet.timezone,
    }).format(new Date(receipt.createdAt)),
    service: receipt.fulfillmentMode === "dine_in" ? "Dine-in" : "Pickup",
    customerName: receipt.customerName,
    customerPhone: receipt.customerPhone,
    table:
      receipt.fulfillmentMode === "dine_in"
        ? receipt.tableNumber
          ? receipt.tableNumber + (receipt.tableLabel ? " · " + receipt.tableLabel : "")
          : receipt.tableLabel || "Not assigned"
        : null,
    paymentStatus: refunded ? "REFUNDED" : paid ? "COMPLETE" : "PENDING",
    paymentMethod: receipt.paymentMethod?.replace("_external", " (staff recorded)"),
    items: receipt.items.map((item) => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: money(item.unitMinor, receipt.currency),
      lineTotal: money(item.lineMinor, receipt.currency),
    })),
    subtotalLabel:
      receipt.taxApplied && receipt.taxInclusive ? "Tax-inclusive prices" : "Item subtotal",
    subtotal: money(receipt.subtotalMinor, receipt.currency),
    taxableBase: receipt.taxApplied
      ? money(receipt.taxableBaseMinor ?? receipt.subtotalMinor, receipt.currency)
      : null,
    taxLabel: receipt.taxApplied
      ? (receipt.taxLabel ?? "Merchant tax") + (receipt.taxInclusive ? " (included)" : " (added)")
      : null,
    taxAmount: receipt.taxApplied ? money(receipt.taxMinor ?? "0", receipt.currency) : null,
    totalLabel: refunded ? "Original paid amount" : "Total payable",
    total: money(receipt.totalMinor ?? receipt.subtotalMinor, receipt.currency),
    closingStatus: refunded
      ? "ORIGINAL STAFF PAYMENT REFUNDED"
      : staffPaid
        ? "STAFF-RECORDED PAYMENT"
        : paid
          ? "PAYMENT COMPLETE"
          : "PAYMENT PENDING",
    taxDisclaimer:
      "Operational receipt only. Not a statutory tax invoice or gateway-confirmed payment.",
  };
}
