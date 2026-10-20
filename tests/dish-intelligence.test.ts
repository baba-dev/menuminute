import { describe, it, expect } from "vitest";
import {
  dishCatalogue,
  validateCatalogue,
  normalizeDishText,
  rankDishSuggestions,
  existingFromDocument,
  findDishDuplicate,
} from "../src/modules/menu-product/dish-intelligence";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
const document = () =>
  menuDocumentSchema.parse({
    name: "Test",
    currency: "INR",
    categories: [
      {
        id: "mains",
        name: "Main Course",
        items: [
          {
            id: "one",
            name: "Kadai Paneer",
            priceMinor: 20000,
            mediaId: "photo-1",
          },
          { id: "old", name: "Old Paneer", priceMinor: 100, archived: true },
        ],
      },
      { id: "starters", name: "Starters", items: [] },
    ],
  });
describe("dish intelligence foundation", () => {
  it("validates unique catalogue entries without prices or unverified dietary claims", () => {
    expect(dishCatalogue.length).toBeGreaterThan(200);
    expect(
      dishCatalogue.every((d) => !("priceMinor" in d) && !("dietary" in d) && !("mediaId" in d))
    ).toBe(true);
    expect(() => validateCatalogue([...dishCatalogue, dishCatalogue[0]])).toThrow(/duplicate/i);
    expect(() =>
      validateCatalogue([
        { id: "MM-X", name: "Name", aliases: [], categoryHint: "Main", priceMinor: 0 },
      ])
    ).toThrow();
  });
  it("normalizes punctuation, accents and spelling aliases", () => {
    expect(normalizeDishText("  PANÉER---Tikka ")).toBe("paneer tikka");
    expect(
      rankDishSuggestions({ query: "karahi", outletId: "a", menuId: "m", existing: [] }).some(
        (x) => x.name === "Kadai Paneer"
      )
    ).toBe(true);
  });
  it("requires at least two characters and bounds results", () => {
    expect(rankDishSuggestions({ query: "a", outletId: "a", menuId: "m", existing: [] })).toEqual(
      []
    );
    expect(
      rankDishSuggestions({ query: "paneer", outletId: "a", menuId: "m", existing: [], limit: 2 })
    ).toHaveLength(2);
  });
  it("ranks current-menu matches first, never leaks a different outlet or menu", () => {
    const doc = document();
    const existing = [
      ...existingFromDocument(doc, "outlet-1", "menu-1"),
      {
        ...existingFromDocument(doc, "outlet-1", "menu-1")[0]!,
        outletId: "outlet-2",
        dishId: "foreign",
        name: "Paneer Secret",
      },
      {
        ...existingFromDocument(doc, "outlet-1", "menu-1")[0]!,
        menuId: "other",
        dishId: "different",
        name: "Paneer Hidden",
      },
    ];
    const result = rankDishSuggestions({
      query: "kadai",
      outletId: "outlet-1",
      menuId: "menu-1",
      existing,
    });
    expect(result[0]).toMatchObject({ source: "existing", dishId: "one", mediaId: "photo-1" });
    expect(
      rankDishSuggestions({
        query: "paneer",
        outletId: "outlet-1",
        menuId: "menu-1",
        existing,
      }).every((x) => !["foreign", "different", "old"].includes(x.dishId ?? ""))
    ).toBe(true);
  });
  it("detects duplicates only in the destination category, ignoring archived entries", () => {
    const doc = document();
    expect(findDishDuplicate(doc, "mains", " kadai---PANEER ")?.id).toBe("one");
    expect(findDishDuplicate(doc, "starters", "Kadai Paneer")).toBeNull();
    expect(findDishDuplicate(doc, "mains", "Old Paneer")).toBeNull();
  });
});
