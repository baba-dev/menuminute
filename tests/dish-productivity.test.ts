import { describe, expect, it } from "vitest";
import {
  batchCandidates,
  normalizeDishText,
  rankDishSuggestions,
  recentFromDocument,
} from "../src/modules/menu-product/dish-intelligence";
import { organizationFromAuthorizedMenus } from "../src/modules/menu-product/dish-reuse";
import { approvedArtworkForDish } from "../src/modules/menu-product/dish-artwork";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";

const doc = menuDocumentSchema.parse({
  name: "Lunch",
  currency: "INR",
  categories: [
    {
      id: "main",
      name: "Mains",
      items: [
        { id: "a", name: "Paneer Tikka", priceMinor: 8000, mediaId: "private-other-media" },
        { id: "b", name: "Biryani", priceMinor: 12000 },
        { id: "c", name: "Archived dish", priceMinor: 10, archived: true },
      ],
    },
  ],
});
describe("PR C productivity contracts", () => {
  it("normalizes curated Indic and Arabic terms without losing vowel marks", () => {
    expect(normalizeDishText("पनीर टिक्का")).toBe("paneer tikka");
    expect(normalizeDishText("برياني")).toBe("biryani");
    expect(normalizeDishText("بانير ماسالا")).toBe("paneer masala");
    expect(normalizeDishText("Crème brûlée")).toBe("creme brulee");
    expect(
      rankDishSuggestions({ query: "पनीर", outletId: "outlet", menuId: "menu", existing: [] }).some(
        (x) => x.name.toLowerCase().includes("paneer")
      )
    ).toBe(true);
  });
  it("deduplicates and bounds bulk input without silent truncation", () => {
    expect(batchCandidates("Paneer Tikka, paneer-tikka; Biryani\nبرياني")).toEqual([
      "Paneer Tikka",
      "Biryani",
    ]);
    expect(() =>
      batchCandidates(Array.from({ length: 51 }, (_, i) => "Dish " + i).join("\n"))
    ).toThrow(/50/);
    expect(() => batchCandidates("A".repeat(101))).toThrow(/100/);
  });
  it("derives recently saved dish names, excluding archived entries", () => {
    expect(recentFromDocument(doc).map((x) => x.name)).toEqual(["Biryani", "Paneer Tikka"]);
  });
  it("projects authorized organization menus without price/media/descriptions", () => {
    const reusable = organizationFromAuthorizedMenus([
      { id: "source", updatedAt: new Date(), document: doc },
    ]);
    expect(reusable.map((x) => x.name)).toEqual(["Paneer Tikka", "Biryani"]);
    expect(JSON.stringify(reusable)).not.toMatch(/private-other-media|8000|12000/);
    const suggestions = rankDishSuggestions({
      query: "paneer",
      outletId: "target",
      menuId: "target-menu",
      existing: [],
      organization: reusable,
    });
    expect(suggestions[0]).toMatchObject({
      source: "organization",
      name: "Paneer Tikka",
      mediaId: null,
      dishId: null,
    });
    expect(suggestions[0]).not.toHaveProperty("priceMinor");
  });
  it("only recommends explicitly approved, canonical artwork (never imported-only)", () => {
    const items = [
      {
        label: "Paneer Tikka",
        path: "/assets/food/dishes/indian/paneer-tikka.png",
        state: "assets-imported",
        slug: "paneer-tikka",
        category: "indian",
      },
      {
        label: "Paneer Tikka",
        path: "/assets/food/dishes/indian/paneer-tikka.png",
        state: "approved",
        slug: "paneer-tikka",
        category: "indian",
      },
    ];
    expect(approvedArtworkForDish("Paneer Tikka", items.slice(0, 1))).toBeNull();
    expect(approvedArtworkForDish("Paneer Tikka", items)).toEqual({
      path: items[1]!.path,
      label: "Paneer Tikka",
    });
    expect(
      approvedArtworkForDish("Paneer Tikka", [
        { ...items[1]!, path: "https://external.invalid/image.png" },
      ])
    ).toBeNull();
    expect(approvedArtworkForDish("Paneer Tikka")).toBeNull();
  });
});
