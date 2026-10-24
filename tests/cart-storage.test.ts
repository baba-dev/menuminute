import { describe, expect, it } from "vitest";
import { restoreGuestCart } from "../src/modules/menu-product/cart-storage";

const example = {
  dishId: "paneer",
  dishName: "Paneer Tikka",
  variantId: null,
  variantName: null,
  selectedAddOns: [],
  unitPriceMinor: 3100,
  quantity: 1,
  itemNotes: "",
};
describe("guest cart restoration", () => {
  const published = new Set(["paneer"]);
  it("retains valid published items only", () => {
    expect(restoreGuestCart([example, { ...example, dishId: "unpublished" }], published)).toEqual([
      example,
    ]);
  });
  it("rejects tampered prices, quantities, URLs and large payloads", () => {
    expect(restoreGuestCart([{ ...example, unitPriceMinor: -1 }], published)).toEqual([]);
    expect(restoreGuestCart([{ ...example, quantity: 1000 }], published)).toEqual([]);
    expect(
      restoreGuestCart([{ ...example, imageSrc: "https://evil.invalid/" }], published)
    ).toEqual([]);
    expect(
      restoreGuestCart(
        Array.from({ length: 51 }, () => example),
        published
      )
    ).toEqual([]);
    expect(restoreGuestCart({ items: [example] }, published)).toEqual([]);
  });
  it("supports the shared 50-line checkout boundary", () => {
    expect(
      restoreGuestCart(
        Array.from({ length: 50 }, () => example),
        published
      )
    ).toHaveLength(50);
  });
});
