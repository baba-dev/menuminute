import { z } from "zod";
import type { MenuDocument } from "./contracts";
import { allergenEnum } from "./contracts";
import { normalizeDishText } from "./dish-intelligence";

export const dishAutofillSuggestionSchema = z
  .object({
    description: z.string().trim().max(1000),
    dietary: z.array(z.enum(["vegetarian", "vegan"])).max(2),
    culinary: z
      .object({
        spiceLevel: z.number().int().min(0).max(4),
        flavorNotes: z.array(z.string().trim().min(1).max(30)).max(6),
        chefNote: z.string().trim().max(300),
        servingTemp: z.enum(["hot", "chilled", "ambient"]),
      })
      .strict(),
    nutrition: z
      .object({
        calories: z.number().int().min(0).max(10000).nullable(),
        proteinGrams: z.number().min(0).max(1000).nullable(),
        carbsGrams: z.number().min(0).max(1000).nullable(),
        fatGrams: z.number().min(0).max(1000).nullable(),
        fiberGrams: z.number().min(0).max(500).nullable(),
        servingSize: z.string().trim().max(60).nullable(),
      })
      .strict(),
    safety: z
      .object({
        ingredients: z.array(z.string().trim().min(1).max(60)).max(30),
        allergens: z.array(allergenEnum).max(11),
        crossContact: z.string().trim().max(250),
      })
      .strict(),
    pairingNames: z.array(z.string().trim().min(1).max(100)).max(4),
  })
  .strict();

export type DishAutofillSuggestion = z.infer<typeof dishAutofillSuggestionSchema>;
export type AutofillMode = "missing" | "replace";
type Dish = MenuDocument["categories"][number]["items"][number];

/** The model never receives or returns protected merchant-controlled fields (price, image, status).
 * Every generated value remains unverified even after the merchant accepts the proposal. */
export function applyDishAutofill(
  dish: Dish,
  suggestion: DishAutofillSuggestion,
  mode: AutofillMode,
  companions: ReadonlyArray<{ id: string; name: string }>
): Partial<Dish> {
  const replace = mode === "replace";
  const chooseText = (old: string | undefined, next: string) =>
    replace || !old?.trim() ? next : old;
  const chooseArray = <T>(old: T[], next: T[]) => (replace || !old.length ? next : old);
  const pairingIds = suggestion.pairingNames
    .map(
      (name) =>
        companions.find(
          (other) =>
            other.id !== dish.id && normalizeDishText(other.name) === normalizeDishText(name)
        )?.id
    )
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);
  const culinary = dish.culinary;
  const nutrition = dish.nutrition;
  const safety = dish.safety;
  const generatedNutrition = Object.fromEntries(
    Object.entries(suggestion.nutrition).filter(([, value]) => value !== null)
  ) as NonNullable<Dish["nutrition"]>;
  const nextNutrition = replace
    ? generatedNutrition
    : Object.fromEntries(
        Object.entries(generatedNutrition).filter(
          ([key]) =>
            nutrition?.[key as keyof NonNullable<Dish["nutrition"]>] == null ||
            nutrition?.[key as keyof NonNullable<Dish["nutrition"]>] === ""
        )
      );

  const suggestedDietary = suggestion.dietary.includes("vegan")
    ? (["vegetarian", "vegan"] as const)
    : suggestion.dietary;
  // Gluten-free is a safety claim and may only be changed manually.
  const retainedGlutenFree: Dish["dietary"] = dish.dietary.includes("gluten_free")
    ? ["gluten_free"]
    : [];
  const dietary = (
    replace || dish.dietary.filter((value) => value !== "gluten_free").length === 0
      ? [...suggestedDietary, ...retainedGlutenFree]
      : dish.dietary
  ) as Dish["dietary"];

  return {
    description: chooseText(dish.description, suggestion.description),
    dietary: [...new Set(dietary)],
    culinary: {
      spiceLevel: replace || !culinary ? suggestion.culinary.spiceLevel : culinary.spiceLevel,
      flavorNotes: chooseArray(culinary?.flavorNotes ?? [], suggestion.culinary.flavorNotes),
      chefNote: chooseText(culinary?.chefNote, suggestion.culinary.chefNote),
      servingTemp:
        replace || !culinary?.servingTemp ? suggestion.culinary.servingTemp : culinary.servingTemp,
      pairingDishIds: chooseArray(culinary?.pairingDishIds ?? [], pairingIds),
    },
    nutrition: { ...(replace ? {} : nutrition), ...nextNutrition, verified: false },
    safety: {
      ingredients: chooseArray(safety?.ingredients ?? [], suggestion.safety.ingredients),
      allergens: chooseArray(safety?.allergens ?? [], suggestion.safety.allergens),
      crossContact: chooseText(safety?.crossContact, suggestion.safety.crossContact),
      verified: false,
      verifiedFreeFrom: [],
    },
  };
}

/** Fail closed rather than silently accepting prose or partially structured model output. */
export function parseDishAutofillResponse(raw: string): DishAutofillSuggestion {
  const text = raw
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "");
  return dishAutofillSuggestionSchema.parse(JSON.parse(text));
}
