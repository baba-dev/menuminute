import { describe, expect, it } from "vitest";
import type { MerchantOrder } from "../src/components/orders/types";
import { actionFor, filterRail, laneFor, statusLabels } from "../src/modules/orders/presentation";
import { historyQuerySchema } from "../src/modules/orders/workspace";

function order(partial: Partial<MerchantOrder> = {}): MerchantOrder {
  return {
    id: "ord-one",
    restaurantId: "outlet-a",
    orderNumber: 42,
    tableId: null,
    servicePoint: "Table 4",
    customerName: "Asha",
    customerPhone: null,
    fulfillmentMode: "dine_in",
    status: "pending",
    paymentStatus: "unpaid",
    currency: "INR",
    subtotalMinor: 10000,
    taxMinor: 0,
    totalMinor: 10000,
    notes: null,
    rejectionReason: null,
    version: 1,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    expiresAt: null,
    kitchenManaged: false,
    canAccept: true,
    canPrepare: true,
    canComplete: true,
    canCancel: true,
    canManagePayment: false,
    items: [],
    ...partial,
  };
}
describe("Service Counter presentation invariants", () => {
  it("keeps the correct canonical lane classifications", () => {
    expect(laneFor("pending")).toBe("incoming");
    expect(laneFor("accepted")).toBe("preparing");
    expect(laneFor("preparing")).toBe("preparing");
    expect(laneFor("ready")).toBe("ready");
    expect(laneFor("served")).toBeNull();
    expect(statusLabels.expired).toBe("Acceptance expired");
  });
  it("does not bypass Kitchen Pro expeditor or disabled permissions", () => {
    expect(actionFor(order({ status: "preparing", kitchenManaged: true }))).toBeNull();
    expect(actionFor(order({ status: "pending", canAccept: false }))).toBeNull();
    expect(actionFor(order({ status: "ready", fulfillmentMode: "pickup" }))).toEqual({
      label: "Mark Collected",
      status: "collected",
    });
    expect(actionFor(order({ status: "ready", fulfillmentMode: "dine_in" }))).toEqual({
      label: "Mark Served",
      status: "served",
    });
  });
  it("searches and filters only the supplied outlet-scoped rows", () => {
    const source = [
      order(),
      order({ id: "ord-two", orderNumber: 50, customerName: "Kiran", fulfillmentMode: "pickup" }),
    ];
    expect(filterRail(source, "#42", "all").map((item) => item.id)).toEqual(["ord-one"]);
    expect(filterRail(source, "kiran", "pickup").map((item) => item.id)).toEqual(["ord-two"]);
    expect(filterRail(source, "table 4", "pickup")).toEqual([]);
  });
  it("bounds server history searches, pages and dates", () => {
    expect(historyQuerySchema.parse({}).page).toBe(0);
    expect(historyQuerySchema.safeParse({ page: "101" }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ from: "2026-10-22", to: "2026-10-21" }).success).toBe(
      false
    );
    expect(historyQuerySchema.safeParse({ search: "x".repeat(81) }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ status: "pending" }).success).toBe(false);
  });
});
