import { describe, expect, it } from "vitest";
import type { KitchenWorkView } from "../src/modules/kitchen/service";
import { kitchenPulse, stationGroups, outstandingDishes } from "../src/modules/kitchen/presentation";
const base: KitchenWorkView = {
  id: "one", stationId: "grill", orderId: "order-a", orderNumber: 17,
  fulfillmentMode: "dine_in", tableLabel: "7", brandLabel: "Kitchen",
  dishName: "Paneer Tikka", quantity: 2, variantName: null, selectedOptions: [],
  notes: null, orderNotes: null, status: "queued", version: 0,
  createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z",
};
const make = (changes: Partial<KitchenWorkView>) => ({ ...base, ...changes });
describe("The Chef's Pass read-only presentation", () => {
  it("counts only authorized snapshot rows and deduplicates active orders", () => {
    const visible = [base, make({ id: "two", stationId: "tandoor", orderId: "order-a", status: "preparing" }),
      make({ id: "three", orderId: "order-b", status: "complete" }),
      make({ id: "four", orderId: "order-c", status: "cancelled" })];
    expect(kitchenPulse(visible)).toEqual({ queued: 1, preparing: 1, completed: 1, activeOrders: 1 });
    expect(kitchenPulse([base]).activeOrders).toBe(1);
  });
  it("preserves oldest-first lanes without showing other stations' tickets", () => {
    const work = [
      make({ id: "new", createdAt: "2026-10-22T11:00:00Z" }),
      make({ id: "other", stationId: "tandoor" }),
      make({ id: "old", createdAt: "2026-10-22T09:00:00Z" }),
      make({ id: "done", status: "complete" }),
      make({ id: "cancel", status: "cancelled" }),
    ];
    const groups = stationGroups(work, "grill");
    expect(groups.queued.map((item) => item.id)).toEqual(["old", "new"]);
    expect(groups.complete.map((item) => item.id)).toEqual(["done"]);
    expect(groups.preparing).toEqual([]);
  });
  it("counts active quantities rather than completed or cancelled work", () => {
    expect(outstandingDishes([base, make({ id:"two", quantity:3, status:"preparing" }),
      make({ id:"three", quantity:50, status:"complete" }),
      make({ id:"four", quantity:60, status:"cancelled" })])).toEqual([["Paneer Tikka",5]]);
  });
});
