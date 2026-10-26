import { describe, it, expect } from "vitest";
import {
  isVerifiedFreeFrom,
  hasVerifiedNutrition,
  canQuickAddCompanion,
} from "../src/modules/menu-product/culinary-safety";
import {
  dishSchema,
  nutritionSchema,
  culinaryProfileSchema,
  safetyProfileSchema,
  type Allergen,
} from "../src/modules/menu-product/contracts";

describe("Top-Tier Dish Culinary Profile Contracts", () => {
  it("validates nutrition values within sane physiological boundaries", () => {
    const valid = {
      calories: 520,
      proteinGrams: 28.5,
      carbsGrams: 42,
      fatGrams: 22,
      fiberGrams: 7,
      servingSize: "Approx. 350g (Serves 1-2)",
    };
    expect(nutritionSchema.parse(valid)).toEqual(valid);

    // Negative values rejected
    expect(() => nutritionSchema.parse({ calories: -10 })).toThrow();
    // Excessive calorie limits rejected
    expect(() => nutritionSchema.parse({ calories: 50000 })).toThrow();
  });

  it("validates culinary profile with spice level 0 to 4 and flavor notes", () => {
    const valid = {
      spiceLevel: 3,
      flavorNotes: ["Creamy", "Smoky", "Tangy"],
      chefNote: "Slow cooked over charcoal with freshly ground whole spices.",
      servingTemp: "hot" as const,
      pairingDishIds: ["naan-1", "lassi-1"],
    };
    const parsed = culinaryProfileSchema.parse(valid);
    expect(parsed.spiceLevel).toBe(3);
    expect(parsed.flavorNotes).toHaveLength(3);
    expect(parsed.servingTemp).toBe("hot");

    // Spice level out of bounds (> 4) rejected
    expect(() => culinaryProfileSchema.parse({ spiceLevel: 5 })).toThrow();
    // Too many flavor notes (> 6) rejected
    expect(() =>
      culinaryProfileSchema.parse({
        flavorNotes: ["1", "2", "3", "4", "5", "6", "7"],
      })
    ).toThrow();
  });

  it("validates safety profile with standard allergens and ingredients", () => {
    const valid = {
      ingredients: ["Paneer", "Tomato", "Butter", "Cream", "Cashews"],
      allergens: ["dairy", "nuts"] as Allergen[],
      crossContact: "Made in a kitchen that also processes wheat and peanuts.",
    };
    const parsed = safetyProfileSchema.parse(valid);
    expect(parsed.allergens).toContain("dairy");
    expect(parsed.allergens).toContain("nuts");
    expect(parsed.ingredients).toHaveLength(5);

    // Invalid allergen enum value rejected
    expect(() =>
      safetyProfileSchema.parse({
        allergens: ["invalid_allergen"],
      })
    ).toThrow();
  });

  it("preserves backward compatibility: dishes without new fields parse cleanly", () => {
    const legacyDish = {
      id: "dish-legacy-1",
      name: "Classic Butter Chicken",
      description: "Authentic tandoori chicken simmered in tomato gravy.",
      priceMinor: 38000,
      soldOut: false,
      archived: false,
      mediaId: null,
      artworkId: null,
      imageMode: "auto" as const,
      dietary: [],
      variants: [],
      addOnGroups: [],
      schedule: null,
    };
    const parsed = dishSchema.parse(legacyDish);
    expect(parsed.id).toBe("dish-legacy-1");
    expect(parsed.nutrition).toBeUndefined();
    expect(parsed.culinary).toBeUndefined();
    expect(parsed.safety).toBeUndefined();
  });

  it("allows complete top-tier dish with all culinary, nutrition, and safety profiles", () => {
    const fullDish = {
      id: "dish-top-tier",
      name: "Paneer Butter Masala",
      description: "Rich and creamy tomato gravy with cottage cheese cubes.",
      priceMinor: 32000,
      soldOut: false,
      archived: false,
      mediaId: null,
      artworkId: null,
      imageMode: "auto" as const,
      dietary: ["vegetarian" as const],
      nutrition: {
        calories: 460,
        proteinGrams: 18.5,
        carbsGrams: 24,
        fatGrams: 32,
        fiberGrams: 5,
        servingSize: "Serves 1-2 (approx. 320g)",
      },
      culinary: {
        spiceLevel: 2,
        flavorNotes: ["Rich & Creamy", "Mildly Sweet", "Aromatic"],
        chefNote: "Prepared with hand-churned white butter and dried fenugreek leaves.",
        servingTemp: "hot" as const,
        pairingDishIds: ["garlic-naan", "jeera-rice"],
      },
      safety: {
        ingredients: [
          "Cottage Cheese",
          "Roma Tomatoes",
          "Butter",
          "Cream",
          "Cashew Paste",
          "Kasuri Methi",
        ],
        allergens: ["dairy" as const, "nuts" as const],
        crossContact: "Cooked in a facility that also handles gluten and sesame.",
      },
      variants: [],
      addOnGroups: [],
      schedule: null,
    };
    const parsed = dishSchema.parse(fullDish);
    expect(parsed.nutrition?.calories).toBe(460);
    expect(parsed.culinary?.spiceLevel).toBe(2);
    expect(parsed.culinary?.flavorNotes).toContain("Rich & Creamy");
    expect(parsed.safety?.allergens).toEqual(["dairy", "nuts"]);
  });

  it("finds culinary profiles from the authentic dataset by name or alias", async () => {
    const { findCulinaryProfile } = await import("../src/modules/menu-product/dish-intelligence");

    // Exact match
    const paneer = findCulinaryProfile("Paneer Butter Masala");
    expect(paneer).not.toBeNull();
    expect(paneer?.culinary.spiceLevel).toBe(2);
    expect(paneer?.safety.allergens).toContain("dairy");
    expect(paneer?.nutrition.calories).toBeGreaterThan(400);

    // Alias match
    const murgh = findCulinaryProfile("Murgh Makhani");
    expect(murgh).not.toBeNull();
    expect(murgh?.name).toBe("Butter Chicken");

    // Substrings must never authorize a recipe or allergen claim.
    expect(findCulinaryProfile("Crispy Masala Dosa")).toBeNull();
    expect(findCulinaryProfile("Dal")).toBeNull();
    expect(findCulinaryProfile("Chicken")).toBeNull();
    const dosa = findCulinaryProfile("Masala Dosa");
    expect(dosa?.safety.allergens).toContain("mustard");

    // Unknown dish
    expect(findCulinaryProfile("completely unknown fantasy dish 999")).toBeNull();
  });

  it("indexes ingredients, flavor notes, and chef notes for search discovery", () => {
    const dish = {
      name: "Murgh Makhani",
      description: "Tandoori chicken in makhani gravy",
      dietary: [] as string[],
      safety: {
        ingredients: ["Boneless Chicken", "Tomatoes", "Cashew Paste", "Butter"],
        allergens: ["dairy", "nuts"],
      },
      culinary: {
        spiceLevel: 2,
        flavorNotes: ["Rich & Creamy", "Smoky"],
        chefNote: "Charred in the tandoor and slow cooked.",
      },
    };

    const searchPool = [
      dish.name,
      dish.description,
      "Main Course",
      ...(dish.safety.ingredients ?? []),
      ...(dish.culinary.flavorNotes ?? []),
      dish.culinary.chefNote ?? "",
    ]
      .join(" ")
      .toLowerCase();

    // Matches dish name
    expect(searchPool.includes("murgh")).toBe(true);
    // Matches ingredient not present in name or description
    expect(searchPool.includes("cashew")).toBe(true);
    // Matches flavor sensation
    expect(searchPool.includes("smoky")).toBe(true);
    // Excludes unrelated search
    expect(searchPool.includes("avocado")).toBe(false);
  });

  it("requires positive restaurant verification before exposing free-from filters", () => {
    const unknown = { safety: undefined, variants: [], addOnGroups: [] };
    expect(isVerifiedFreeFrom(unknown, "nuts")).toBe(false);
    expect(
      isVerifiedFreeFrom({ safety: { allergens: [] }, variants: [], addOnGroups: [] }, "dairy")
    ).toBe(false);

    const safe = {
      safety: {
        ingredients: ["Potatoes", "Olive oil"],
        allergens: [] as string[],
        verified: true,
        verifiedFreeFrom: ["nuts", "dairy"] as ("nuts" | "dairy")[],
      },
      variants: [] as unknown[],
      addOnGroups: [] as unknown[],
    };
    expect(isVerifiedFreeFrom(safe, "nuts")).toBe(true);
    expect(isVerifiedFreeFrom(safe, "dairy")).toBe(true);
    expect(isVerifiedFreeFrom({ ...safe, variants: [{}] }, "nuts")).toBe(false);
    expect(isVerifiedFreeFrom({ ...safe, addOnGroups: [{}] }, "dairy")).toBe(false);
    expect(
      isVerifiedFreeFrom(
        { ...safe, safety: { ...safe.safety, crossContact: "Shared kitchen" } },
        "nuts"
      )
    ).toBe(false);
    expect(
      isVerifiedFreeFrom({ ...safe, safety: { ...safe.safety, allergens: ["peanuts"] } }, "nuts")
    ).toBe(false);
    expect(
      isVerifiedFreeFrom({ ...safe, safety: { ...safe.safety, verified: false } }, "nuts")
    ).toBe(false);
  });

  it("rejects contradictory claims in canonical menu contracts", () => {
    expect(() =>
      safetyProfileSchema.parse({
        ingredients: ["peanuts"],
        allergens: ["peanuts"],
        verified: true,
        verifiedFreeFrom: ["nuts"],
      })
    ).toThrow();
    expect(() =>
      safetyProfileSchema.parse({
        ingredients: ["rice"],
        allergens: [],
        verified: false,
        verifiedFreeFrom: ["dairy"],
      })
    ).toThrow();
    expect(() =>
      safetyProfileSchema.parse({
        ingredients: ["rice"],
        allergens: [],
        verified: true,
        verifiedFreeFrom: ["dairy"],
        crossContact: "Shared fryer",
      })
    ).toThrow();
    expect(
      safetyProfileSchema.parse({
        ingredients: ["rice"],
        allergens: [],
        verified: true,
        verifiedFreeFrom: ["dairy"],
      }).verifiedFreeFrom
    ).toEqual(["dairy"]);
  });

  it("only displays confirmed nutrition and only quick-adds available, simple pairings", () => {
    expect(hasVerifiedNutrition({ calories: 0, verified: true })).toBe(true);
    expect(hasVerifiedNutrition({ proteinGrams: 12 })).toBe(false);
    expect(hasVerifiedNutrition({ verified: true })).toBe(false);
    const dish = { soldOut: false, open: true, variants: [], addOnGroups: [] };
    expect(canQuickAddCompanion(dish)).toBe(true);
    expect(canQuickAddCompanion({ ...dish, soldOut: true })).toBe(false);
    expect(canQuickAddCompanion({ ...dish, open: false })).toBe(false);
    expect(canQuickAddCompanion({ ...dish, variants: [{}] })).toBe(false);
    expect(canQuickAddCompanion({ ...dish, addOnGroups: [{ min: 1 }] })).toBe(false);
  });

  it("never accepts template-only suggested pairings as canonical document fields", async () => {
    const { findCulinaryProfile } = await import("../src/modules/menu-product/dish-intelligence");
    const profile = findCulinaryProfile("Paneer Butter Masala");
    expect(profile).toBeTruthy();
    expect(() => culinaryProfileSchema.parse(profile?.culinary)).toThrow();
    const { suggestedPairings: _suggestedPairings, ...canonical } = profile!.culinary;
    expect(
      culinaryProfileSchema.parse({ ...canonical, pairingDishIds: [] }).pairingDishIds
    ).toEqual([]);
  });
});
