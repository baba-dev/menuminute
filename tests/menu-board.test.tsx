import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import {
  catalogueSchema,
  culinaryProfiles,
  dishCatalogue,
  findCulinaryProfile,
  findPublicDishDescription,
} from "@/modules/menu-product/dish-intelligence";
import { draftCulinaryDefaults } from "@/modules/menu-product/draft-culinary";
import { StudioMenuBoard } from "@/components/menu-product/studio-menu-board";

describe("Menu Board and curated editorial references", () => {
  it("covers every catalogue dish with a nonempty bounded public description", () => {
    expect(dishCatalogue).toHaveLength(236);
    expect(catalogueSchema.parse(dishCatalogue)).toHaveLength(236);
    for (const dish of dishCatalogue) {
      expect(dish.publicDescription.length, dish.name).toBeGreaterThanOrEqual(12);
      expect(dish.publicDescription.length, dish.name).toBeLessThanOrEqual(240);
      expect(findPublicDishDescription(dish.name)).toBeTruthy();
    }
  });

  it("matches curated aliases exactly and never guesses food-safety data from a substring", () => {
    expect(culinaryProfiles).toHaveLength(17);
    expect(findCulinaryProfile("paneer makhani")?.name).toBe("Paneer Butter Masala");
    expect(findPublicDishDescription("paneer makhani")).toContain("Paneer");
    expect(findCulinaryProfile("paneer")).toBeNull();
    expect(findPublicDishDescription("completely unknown dish")).toBe("");
  });

  it("prepopulates editable unverified culinary details without inventing pairing IDs", () => {
    const profile = draftCulinaryDefaults("Paneer Tikka", [
      { id: "pair-one", name: "Masala Chai" },
      { id: "pair-two", name: "Another dish" },
    ]);
    expect(profile.culinary?.spiceLevel).toBeGreaterThanOrEqual(0);
    expect(profile.nutrition?.verified).toBe(false);
    expect(profile.safety?.verified).toBe(false);
    expect(profile.safety?.verifiedFreeFrom).toEqual([]);
    expect(profile).not.toHaveProperty("dietary");
    expect(profile).not.toHaveProperty("priceMinor");
    expect(profile).not.toHaveProperty("mediaId");
    expect(profile.culinary?.pairingDishIds.every((id) => ["pair-one", "pair-two"].includes(id))).toBe(true);
    expect(draftCulinaryDefaults("Unlisted dish", [])).toEqual({});
  });

  it("renders the private menu board as filtered visual dish cards, not expanded forms", () => {
    const doc = menuDocumentSchema.parse({
      name: "Chef's menu",
      currency: "INR",
      categories: [
        {
          id: "mains",
          name: "Main Course",
          items: [{ id: "paneer", name: "Paneer Tikka", priceMinor: 24500,
            description: findPublicDishDescription("Paneer Tikka") }],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <StudioMenuBoard
        doc={doc}
        currency="INR"
        media={[]}
        canWrite
        onAddDish={() => {}}
        onAddMultiple={() => {}}
        onCreateSection={() => {}}
        onUpdateCategory={() => {}}
        onUpdateDish={() => {}}
        onMoveDish={() => {}}
      />
    );
    expect(html).toContain("Visual menu board");
    expect(html).toContain("Main Course");
    expect(html).toContain("Paneer Tikka");
    expect(html).toContain("₹245");
    expect(html).toContain("Edit Paneer Tikka");
    expect(html).not.toContain("Nutrition verification");
  });
});
