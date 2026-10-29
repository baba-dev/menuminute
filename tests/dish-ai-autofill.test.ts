import { describe, expect, it } from "vitest";
import { dishSchema, menuDocumentSchema } from "../src/modules/menu-product/contracts";
import {
  applyDishAutofill,
  dishAutofillSuggestionSchema,
  parseDishAutofillResponse,
  parseDishAutofillWithDiagnostics,
  dishAutofillResponseFormat,
  dishAutofillJsonSchema,
} from "../src/modules/menu-product/dish-ai";

const candidate = dishAutofillSuggestionSchema.parse({
  description: "A tomato, onion and spice gravy with tender paneer.",
  dietary: ["vegetarian"],
  culinary: {
    spiceLevel: 2,
    flavorNotes: ["Aromatic", "Rich & Creamy"],
    chefNote: "Served with warm flatbread.",
    servingTemp: "hot",
  },
  nutrition: {
    calories: 420,
    proteinGrams: 17,
    carbsGrams: 24,
    fatGrams: 29,
    fiberGrams: 3,
    servingSize: "Estimated standard 300 g portion",
  },
  safety: {
    ingredients: ["Paneer", "Tomatoes", "Dairy cream"],
    allergens: ["dairy"],
    crossContact: "",
  },
  pairingNames: ["Naan", "DISH NOT IN MENU"],
});
const dish = dishSchema.parse({
  id: "dish-1",
  name: "Kadai Paneer",
  description: "My own recipe",
  priceMinor: 5000,
  imageMode: "none",
  dietary: ["gluten_free"],
  soldOut: true,
  archived: false,
  nutrition: { calories: 500, verified: true },
  safety: {
    ingredients: ["Homemade paneer"],
    allergens: [],
    verified: true,
    verifiedFreeFrom: ["nuts"],
  },
});
const companions = [
  { id: "naan-1", name: "Naan" },
  { id: "dish-1", name: "Kadai Paneer" },
];
describe("AI dish autofill is always a merchant-reviewed, unverified draft suggestion", () => {
  it("rejects fabricated verification flags, unknown allergens and out-of-range nutrition", () => {
    expect(() =>
      dishAutofillSuggestionSchema.parse({
        ...candidate,
        safety: { ...candidate.safety, verified: true },
      })
    ).toThrow();
    expect(() =>
      dishAutofillSuggestionSchema.parse({
        ...candidate,
        safety: { ...candidate.safety, allergens: ["unknown"] },
      })
    ).toThrow();
    expect(() =>
      dishAutofillSuggestionSchema.parse({
        ...candidate,
        nutrition: { ...candidate.nutrition, calories: 20000 },
      })
    ).toThrow();
    expect(() => parseDishAutofillResponse("plain language rather than JSON")).toThrow();
    expect(parseDishAutofillResponse("```json\n" + JSON.stringify(candidate) + "\n```")).toEqual(
      candidate
    );
  });
  it("fills missing fields without replacing existing merchant descriptions or nutrition", () => {
    const unverifiedDish = dishSchema.parse({
      ...dish, nutrition: { calories: 500, verified: false },
      safety: { ingredients: ["Homemade paneer"], allergens: [], verified: false },
    });
    const patch = applyDishAutofill(unverifiedDish, candidate, "missing", companions);
    expect(patch.description).toBe("My own recipe");
    expect(patch.nutrition).toMatchObject({ calories: 500, proteinGrams: 17, verified: false });
    expect(patch.safety).toMatchObject({
      ingredients: ["Homemade paneer"],
      allergens: ["dairy"],
      verified: false,
      verifiedFreeFrom: [],
    });
    expect(patch.culinary?.pairingDishIds).toEqual(["naan-1"]);
    expect(patch.dietary).toEqual(["vegetarian", "gluten_free"]);
    expect(patch).not.toHaveProperty("priceMinor");
    expect(patch).not.toHaveProperty("mediaId");
    expect(patch).not.toHaveProperty("soldOut");
    expect(patch).not.toHaveProperty("archived");
  });
  it("requests the verified Cloudflare JSON schema and a provider-neutral JSON fallback", () => {
    expect(dishAutofillResponseFormat("cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"))
      .toMatchObject({ type: "json_schema", json_schema: dishAutofillJsonSchema });
    expect(dishAutofillResponseFormat("nvidia", "meta/llama-3.3-70b-instruct"))
      .toEqual({ type: "json_object" });
    expect(dishAutofillResponseFormat("cloudflare", "@cf/unknown/model"))
      .toEqual({ type: "json_object" });
  });
  it("repairs harmless model formatting with no second provider request", () => {
    const malformed = {
      ...candidate,
      dietary: ["Vegetarian"],
      culinary: { ...candidate.culinary, spiceLevel: "2", servingTemp: "HOT" },
      nutrition: { ...candidate.nutrition, calories: "420 kcal", proteinGrams: "17 g" },
      safety: { ...candidate.safety, allergens: ["milk"], crossContact: "No cross-contact" },
    };
    const result = parseDishAutofillWithDiagnostics(JSON.stringify(malformed));
    expect(result.recovered).toBe(true);
    expect(result.suggestion.nutrition.calories).toBe(420);
    expect(result.suggestion.nutrition.proteinGrams).toBe(17);
    expect(result.suggestion.culinary.servingTemp).toBe("hot");
    expect(result.suggestion.safety.allergens).toEqual(["dairy"]);
    expect(result.suggestion.safety.crossContact).toBe("");
  });
  it("recovers missing harmless optional sections without claiming verified facts", () => {
    const result = parseDishAutofillWithDiagnostics(JSON.stringify({
      description: "A warm chickpea dish",
      dietary: ["vegan"],
      culinary: { spiceLevel: 2, flavorNotes: ["Herbal"], servingTemp: "hot" },
    }));
    expect(result.suggestion.nutrition.calories).toBeNull();
    expect(result.suggestion.safety.allergens).toEqual([]);
  });
  it("rejects unknown allergens, unsafe dietary values and invented verification status", () => {
    for (const changed of [
      { ...candidate, safety: { ...candidate.safety, allergens: ["unknown-allergen"] } },
      { ...candidate, dietary: ["gluten_free"] },
      { ...candidate, safety: { ...candidate.safety, verifiedFreeFrom: ["dairy"] } },
      { ...candidate, nutrition: { ...candidate.nutrition, calories: "4000kg" } },
    ]) {
      expect(() => parseDishAutofillWithDiagnostics(JSON.stringify(changed))).toThrow();
    }
  });
  it("does not overwrite merchant-verified safety or nutrition when filling gaps", () => {
    const patch = applyDishAutofill(dish, candidate, "missing", companions);
    expect(patch.nutrition).toEqual(dish.nutrition);
    expect(patch.safety).toEqual(dish.safety);
    expect(patch.safety?.verifiedFreeFrom).toEqual(["nuts"]);
  });
  it("replacement never generates gluten-free verification and preserves all commerce fields", () => {
    const patch = applyDishAutofill(dish, candidate, "replace", companions);
    const edited = dishSchema.parse({ ...dish, ...patch });
    expect(edited.description).toContain("tomato");
    expect(edited.priceMinor).toBe(5000);
    expect(edited.soldOut).toBe(true);
    expect(edited.imageMode).toBe("none");
    expect(edited.nutrition?.verified).toBe(false);
    expect(edited.safety?.verified).toBe(false);
    expect(edited.safety?.verifiedFreeFrom).toEqual([]);
    expect(edited.dietary).toEqual(["vegetarian", "gluten_free"]);
    expect(
      menuDocumentSchema.safeParse({
        name: "Dinner",
        currency: "INR",
        categories: [{ id: "main", name: "Main", items: [edited] }],
      }).success
    ).toBe(true);
  });
});
