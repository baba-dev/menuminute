import { describe, it, expect } from "vitest";
import {
  categoryImage,
  coverFor,
  dishVisual,
  nextVisualSource,
  startingPriceMinor,
} from "../src/modules/menu-product/public-presentation";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";

describe("Dining Canvas asset and configuration boundaries", () => {
  it("parses legacy menu documents without changing their publication schema", () => {
    const legacy = menuDocumentSchema.parse({ name: "Lunch", currency: "INR", categories: [] });
    expect(legacy.presentation).toBeUndefined();
    expect(coverFor(legacy)).toContain("indian-restaurant.webp");
    const customized = menuDocumentSchema.parse({
      name: "Lunch",
      currency: "INR",
      presentation: { cover: "artisan-bakery", headline: "Fresh daily", featuredDishIds: [] },
      categories: [],
    });
    expect(coverFor(customized)).toContain("artisan-bakery.webp");
  });
  it("rejects injected cover paths and excessive featured items", () => {
    expect(
      menuDocumentSchema.safeParse({
        name: "Lunch",
        currency: "INR",
        presentation: { cover: "//evil.example", headline: "", featuredDishIds: [] },
        categories: [],
      }).success
    ).toBe(false);
    expect(
      menuDocumentSchema.safeParse({
        name: "Lunch",
        currency: "INR",
        presentation: {
          cover: "indian-restaurant",
          headline: "",
          featuredDishIds: Array.from({ length: 9 }, (_, i) => "id" + i),
        },
        categories: [],
      }).success
    ).toBe(false);
  });
  it("resolves real photo, approved exact art, local category and generic fallback only", () => {
    const photo = dishVisual({ name: "Paneer Tikka", mediaId: "safe-id" }, "Starters");
    expect(photo.src).toBe("/api/public-media/safe-id?size=thumb");
    expect(photo.alternatives).toContain("/assets/public-menu/categories/starters-snacks.webp");
    expect(nextVisualSource(photo, photo.src)).toBe(photo.alternatives[0]);
    expect(nextVisualSource(photo, photo.alternatives.at(-1)!)).toBeNull();
    expect(dishVisual({ name: "Paneer Tikka", mediaId: "//bad" }, "Starters").src).not.toContain(
      "//bad"
    );
    expect(dishVisual({ name: "Paneer Tikka", imageMode: "none" }, "Starters").src).toBe(
      "/icons/category-default.svg"
    );
    expect(categoryImage("Desserts")).toContain("desserts.webp");
  });
  it("shows the lowest available variant as the genuine starting price", () => {
    expect(startingPriceMinor({ priceMinor: 1000, variants: [{ priceMinor: 1500, isAvailable: false }, { priceMinor: 1700, isAvailable: true }] })).toBe(1700);
    expect(startingPriceMinor({ priceMinor: 1000, variants: [] })).toBe(1000);
  });
});
