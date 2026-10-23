import { describe, expect, it } from "vitest";
import { artworkAssets, artworkById, artworkForDish, dishImageSrc } from "../src/modules/menu-product/dish-artwork";
import { dishSchema, menuDocumentSchema } from "../src/modules/menu-product/contracts";

describe("trusted dish artwork and persistent image selection", () => {
  it("exposes only canonical, stable, verified manifest identities", () => {
    expect(artworkAssets).toHaveLength(224);
    expect(new Set(artworkAssets.map((item) => item.id)).size).toBe(224);
    for (const item of artworkAssets) {
      expect(item.path).toBe("/assets/food/dishes/" + item.category + "/" + item.slug + ".png");
      expect(artworkById(item.id)?.path).toBe(item.path);
    }
    expect(artworkById("../../secret")).toBeNull();
    expect(artworkById("invalid")).toBeNull();
  });
  it("selects a matching illustration but does not leak restaurant photographs", () => {
    const art = artworkForDish("Butter Chicken");
    expect(art?.path).toBe("/assets/food/dishes/indian/butter-chicken.png");
    expect(dishImageSrc({ name: "Butter Chicken", artworkId: art?.id, imageMode: "artwork", mediaId: null })).toBe(art?.path);
    expect(dishImageSrc({ name: "Butter Chicken", artworkId: art?.id, imageMode: "photo", mediaId: "private-id" })).toBe("/api/public-media/private-id?size=thumb");
    expect(dishImageSrc({ name: "Butter Chicken", artworkId: art?.id, imageMode: "photo", mediaId: "private-id" }, "private")).toBe("/api/media/private-id");
    expect(dishImageSrc({ name: "Butter Chicken", artworkId: art?.id, imageMode: "none", mediaId: null })).toBe("/icons/category-default.svg");
  });
  it("preserves legacy documents with explicit auto defaults and refuses incomplete photo choices", () => {
    const legacy = dishSchema.parse({ id: "legacy", name: "Samosa", priceMinor: 500 });
    expect(legacy.imageMode).toBe("auto");
    expect(legacy.artworkId).toBeNull();
    expect(dishImageSrc(legacy)).toContain("samosa.png");
    expect(dishSchema.safeParse({ ...legacy, imageMode: "photo" }).success).toBe(false);
    expect(dishSchema.safeParse({ ...legacy, imageMode: "artwork" }).success).toBe(false);
    expect(menuDocumentSchema.safeParse({ name: "Menu", currency: "INR", categories: [{ id: "a", name: "A", items: [legacy] }] }).success).toBe(true);
  });
});
