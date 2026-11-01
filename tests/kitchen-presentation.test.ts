import { describe, expect, it } from "vitest";
import type { KitchenWorkView } from "../src/modules/kitchen/service";
import {
  kitchenPulse,
  stationGroups,
  outstandingDishes,
  stationOverview,
  describeDishSafety,
  needsAttention,
  intakeSourceLabel,
} from "../src/modules/kitchen/presentation";
const base: KitchenWorkView = {
  id: "one",
  stationId: "grill",
  orderId: "order-a",
  orderNumber: 17,
  fulfillmentMode: "dine_in",
  tableLabel: "7",
  brandLabel: "Kitchen",
  dishName: "Paneer Tikka",
  quantity: 2,
  variantName: null,
  selectedOptions: [],
  notes: null,
  orderNotes: null,
  status: "queued",
  version: 0,
  createdAt: "2026-10-22T10:00:00Z",
  updatedAt: "2026-10-22T10:00:00Z",
};
const make = (changes: Partial<KitchenWorkView>) => ({ ...base, ...changes });
describe("The Chef's Pass read-only presentation", () => {
  it("counts only authorized snapshot rows and deduplicates active orders", () => {
    const visible = [
      base,
      make({ id: "two", stationId: "tandoor", orderId: "order-a", status: "preparing" }),
      make({ id: "three", orderId: "order-b", status: "complete" }),
      make({ id: "four", orderId: "order-c", status: "cancelled" }),
    ];
    expect(kitchenPulse(visible)).toEqual({
      queued: 1,
      preparing: 1,
      completed: 1,
      activeOrders: 2,
    });
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
  it("summarizes all authorized stations without leaking missing station details", () => {
    const visible = [
      make({ id: "one", stationId: "grill", status: "queued" }),
      make({ id: "two", stationId: "grill", status: "preparing" }),
      make({ id: "three", stationId: "stove", status: "complete" }),
    ];
    const stations = [
      { id: "grill", name: "Grill" },
      { id: "stove", name: "Main Stove" },
    ];
    expect(stationOverview(stations, visible, Date.parse("2026-10-22T10:22:00Z"))).toMatchObject([
      { name: "Grill", queued: 1, preparing: 1, completed: 0, oldestMinutes: 22 },
      { name: "Main Stove", queued: 0, preparing: 0, completed: 1, oldestMinutes: null },
    ]);
    expect(stationOverview(stations.slice(0, 1), visible, null)).toHaveLength(1);
    expect(stationGroups(visible, undefined).queued.map((item) => item.id)).toEqual(["one"]);
  });

  it("counts active quantities rather than completed or cancelled work", () => {
    expect(
      outstandingDishes([
        base,
        make({ id: "two", quantity: 3, status: "preparing" }),
        make({ id: "three", quantity: 50, status: "complete" }),
        make({ id: "four", quantity: 60, status: "cancelled" }),
      ])
    ).toEqual([["Paneer Tikka", 5]]);
  });
});

describe("dish safety presentation", () => {
  it("shows only what the restaurant declared and never claims allergen-free", () => {
    expect(describeDishSafety(null)).toMatchObject({ allergens: [], hasAny: false });
    // A dish with no declared allergens is unknown, not safe: no chip, no claim.
    expect(describeDishSafety({ declared: false, allergens: [] }).hasAny).toBe(false);
    expect(describeDishSafety({ declared: true, allergens: [], verified: true }).allergens).toEqual(
      []
    );
    const declared = describeDishSafety({
      declared: true,
      allergens: ["dairy", "nuts", "dairy", "not-a-real-code"],
      crossContact: " Shared tandoor ",
      verified: false,
      dietary: ["vegetarian"],
    });
    expect(declared.allergens).toEqual(["Dairy", "Tree nuts"]);
    expect(declared.crossContact).toBe("Shared tandoor");
    expect(declared.dietary).toEqual(["Veg"]);
    expect(declared.unverified).toBe(true);
    expect(describeDishSafety({ allergens: ["soy"], verified: true }).unverified).toBe(false);
  });
  it("flags tickets with customisations, notes or allergens for attention", () => {
    expect(needsAttention(base)).toBe(false);
    expect(needsAttention({ ...base, notes: "less spicy" })).toBe(true);
    expect(needsAttention({ ...base, orderNotes: "birthday" })).toBe(true);
    expect(
      needsAttention({ ...base, selectedOptions: [{ groupName: "Spice", optionName: "Mild" }] })
    ).toBe(true);
    expect(needsAttention({ ...base, dishSafety: { allergens: ["peanuts"] } })).toBe(true);
    expect(needsAttention({ ...base, dishSafety: { dietary: ["vegan"] } })).toBe(false);
  });
  it("labels the intake source and hides unknown ones", () => {
    expect(intakeSourceLabel("staff_pos")).toBe("POS");
    expect(intakeSourceLabel("guest_menu")).toBe("QR menu");
    expect(intakeSourceLabel("unknown")).toBeNull();
    expect(intakeSourceLabel(undefined)).toBeNull();
  });
});
