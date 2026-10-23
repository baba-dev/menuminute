import { describe, expect, it } from "vitest";
import manifest from "../docs/food-artwork/manifest.json";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import {
  approvedArtworkForDish,
  categoryIllustration,
  resolveDishVisual,
} from "../src/modules/menu-product/dish-artwork";
import { buildPublicPresentation } from "../src/modules/menu-product/public-presentation";
import type { PublicProduct } from "../src/modules/menu-product/service";

const input: Pick<PublicProduct, "outlet" | "point" | "menus"> = {
  outlet: {
    id: "o1",
    name: "Sample Bakery",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
    fulfillmentModes: ["dine_in"],
    orderingEnabled: false,
    isDemoData: false,
    versioned: true,
  },
  point: "Table 2",
  menus: [
    {
      id: "published",
      revision: 3,
      brand: null,
      overrides: [],
      document: menuDocumentSchema.parse({
        name: "Lunch",
        currency: "INR",
        categories: [
          {
            id: "mains",
            name: "Main Dish",
            items: [
              { id: "paneer", name: "Paneer Tikka", priceMinor: 3100 },
              { id: "uploaded", name: "Paneer Tikka", mediaId: "photo-1", priceMinor: 3100 },
              { id: "pending", name: "Dal Dhokli", priceMinor: 7000 },
              { id: "private", name: "Hidden", archived: true, priceMinor: 1 },
            ],
          },
          { id: "old", name: "Archived", archived: true, items: [] },
        ],
      }),
    },
  ],
};

describe("Public Menu 2.0 presentation and artwork contract", () => {
  it("reconciles the original approved artwork while withholding the remaining review batches", () => {
    expect(manifest.assets.filter((a) => a.state === "approved")).toHaveLength(36);
    expect(manifest.assets.filter((a) => a.state !== "approved")).toHaveLength(188);
    expect(approvedArtworkForDish("Paneer Tikka")?.path).toBe(
      "/assets/food/dishes/indian/paneer-tikka.png"
    );
    expect(approvedArtworkForDish("Dal Dhokli")).toBeNull();
  });

  it("never trusts imported-only, noncanonical, malicious or approximate artwork", () => {
    const sample = {
      label: "Paneer Tikka",
      path: "/assets/food/dishes/indian/paneer-tikka.png",
      state: "assets-imported",
      category: "indian",
      slug: "paneer-tikka",
    };
    expect(approvedArtworkForDish("Paneer Tikka", [sample])).toBeNull();
    expect(
      approvedArtworkForDish("Paneer Tikka", [
        { ...sample, state: "approved", path: "//evil.invalid/p.png" },
      ])
    ).toBeNull();
    expect(
      approvedArtworkForDish("Paneer Tikka", [{ ...sample, state: "approved", slug: "other" }])
    ).toBeNull();
    expect(approvedArtworkForDish("Paneer Tikka with Chilli")).toBeNull();
  });

  it("prioritizes restaurant media and uses an approved local fallback", () => {
    expect(
      resolveDishVisual({ name: "Paneer Tikka", mediaId: "photo-1", categoryName: "Mains" })
    ).toMatchObject({
      source: "restaurant",
      src: "/api/public-media/photo-1?size=thumb",
      fallbackSrc: "/assets/food/dishes/indian/paneer-tikka.png",
    });
    expect(
      resolveDishVisual({ name: "Paneer Tikka", mediaId: null, categoryName: "Mains" }).source
    ).toBe("catalogue");
    expect(
      resolveDishVisual({ name: "Dal Dhokli", mediaId: null, categoryName: "Rice" })
    ).toMatchObject({
      source: "category",
      src: "/icons/category-rice.svg",
    });
    expect(
      resolveDishVisual({ name: "Paneer Tikka", mediaId: "not/a/media", categoryName: "Mains" })
        .source
    ).toBe("catalogue");
    expect(categoryIllustration("Desserts & Sweets")).toBe("/icons/category-desserts.svg");
  });

  it("builds an additive scoped release projection without archived content or inferred claims", () => {
    const result = buildPublicPresentation(input);
    expect(result).toMatchObject({
      version: 2,
      mode: "browse",
      identity: { name: "Sample Bakery", currency: "INR", point: "Table 2" },
    });
    expect(result.dishImages["published:paneer"]?.source).toBe("catalogue");
    expect(result.dishImages["published:uploaded"]?.source).toBe("restaurant");
    expect(result.dishImages["published:pending"]?.source).toBe("category");
    expect(result.dishImages).not.toHaveProperty("published:private");
    expect(result.categoryImages).not.toHaveProperty("published:old");
    expect(JSON.stringify(result)).not.toMatch(/priceMinor|allergen|nutrition|discount|popularity/);
    expect(
      buildPublicPresentation({ ...input, outlet: { ...input.outlet, orderingEnabled: true } }).mode
    ).toBe("ordering");
  });
});
