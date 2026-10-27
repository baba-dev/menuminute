import { describe, expect, it } from "vitest";
import { resolveCurrentStock, type AvailabilityMenuDetail } from "../src/app/(dashboard)/dashboard/availability-contract";

const detail: AvailabilityMenuDetail = {
  revision: 5,
  canWrite: true,
  publishedDocument: {
    categories: [{ items: [
      { id: "salad", soldOut: false },
      { id: "soup", soldOut: true },
    ] }],
  },
  overrides: [
    { dishId: "salad", outletId: "outlet-a", soldOut: true, priceMinor: 123 },
    { dishId: "salad", outletId: "outlet-b", soldOut: false, priceMinor: null },
  ],
};

describe("dashboard live availability contract", () => {
  it("uses the exact outlet's override and preserves its price", () => {
    expect(resolveCurrentStock(detail, { id: "salad" }, "outlet-a")).toEqual({
      soldOut: true, priceMinor: 123,
    });
    expect(resolveCurrentStock(detail, { id: "salad" }, "outlet-b")).toEqual({
      soldOut: false, priceMinor: null,
    });
  });
  it("falls back to the published release, not mutable draft inventory", () => {
    expect(resolveCurrentStock(detail, { id: "soup" }, "outlet-a")).toEqual({
      soldOut: true, priceMinor: null,
    });
  });
  it("rejects disappeared or unpublished dish identifiers", () => {
    expect(() => resolveCurrentStock(detail, { id: "private-draft" }, "outlet-a"))
      .toThrow("no longer in the published menu");
    expect(() => resolveCurrentStock({ ...detail, publishedDocument: null },
      { id: "salad" }, "outlet-a")).toThrow();
  });
  it("does not mutate caller-owned published data", () => {
    const snapshot = structuredClone(detail);
    resolveCurrentStock(detail, { id: "salad" }, "outlet-a");
    expect(detail).toEqual(snapshot);
  });
});
