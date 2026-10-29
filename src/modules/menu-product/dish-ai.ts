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

/** This is a provider wire schema, not a substitute for the Zod/merchant-review boundary. */
const stringProperty = (maxLength: number) => ({ type: "string", maxLength });
const numericProperty = (maximum: number, integer = false) => ({
  type: [integer ? "integer" : "number", "null"],
  minimum: 0,
  maximum,
});
const objectSchema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const dishAutofillJsonSchema = objectSchema({
  description: stringProperty(1000),
  dietary: { type: "array", items: { type: "string", enum: ["vegetarian", "vegan"] }, maxItems: 2 },
  culinary: objectSchema({
    spiceLevel: { type: "integer", minimum: 0, maximum: 4 },
    flavorNotes: { type: "array", items: stringProperty(30), maxItems: 6 },
    chefNote: stringProperty(300),
    servingTemp: { type: "string", enum: ["hot", "chilled", "ambient"] },
  }),
  nutrition: objectSchema({
    calories: numericProperty(10000, true),
    proteinGrams: numericProperty(1000),
    carbsGrams: numericProperty(1000),
    fatGrams: numericProperty(1000),
    fiberGrams: numericProperty(500),
    servingSize: { type: ["string", "null"], maxLength: 60 },
  }),
  safety: objectSchema({
    ingredients: { type: "array", items: stringProperty(60), maxItems: 30 },
    allergens: { type: "array", items: { type: "string", enum: allergenEnum.options }, maxItems: 11 },
    crossContact: stringProperty(250),
  }),
  pairingNames: { type: "array", items: stringProperty(100), maxItems: 4 },
});

/** Only the Cloudflare models documented for JSON mode receive its raw JSON schema.
 * NVIDIA's reviewed text NIM gets the OpenAI-compatible json_object mode; an unsupported
 * model must fail visibly rather than silently retry without constraints. */
export function dishAutofillResponseFormat(provider: "cloudflare" | "nvidia", model: string) {
  if (provider === "cloudflare") {
    const supported = new Set([
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3-8b-instruct",
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    ]);
    return supported.has(model)
      ? ({ type: "json_schema" as const, json_schema: dishAutofillJsonSchema })
      : ({ type: "json_object" as const });
  }
  return { type: "json_object" as const };
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}
function stringOr(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") throw new Error("Expected text");
  return value.trim();
}
function list(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Expected array");
  return value;
}
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+(?:\.\d+)?(?:\s*(?:kcal|g))?$/i.test(value.trim()))
    return Number.parseFloat(value);
  throw new Error("Invalid numerical estimate");
}
const allergenAliases: Record<string, string> = {
  milk: "dairy", "milk products": "dairy", "tree nuts": "nuts",
  groundnuts: "peanuts", "ground nuts": "peanuts",
};
function scanForbidden(value: unknown, depth = 0): void {
  if (depth > 8) throw new Error("Response nested too deeply");
  if (Array.isArray(value)) { value.forEach((item) => scanForbidden(item, depth + 1)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:verified|verifiedFreeFrom|certified|allergenFree|glutenFree|freeFrom)$/i.test(key))
      throw new Error("AI may not assert verification or free-from status");
    scanForbidden(item, depth + 1);
  }
}
export type ParsedDishAutofill = { suggestion: DishAutofillSuggestion; recovered: boolean };
/** Recover only deterministic formatting problems. Unknown allergen identities, dietary
 * categories and verification claims still fail closed. No second billable model call. */
export function parseDishAutofillWithDiagnostics(raw: string): ParsedDishAutofill {
  if (raw.length > 12_000) throw new Error("Output exceeds size limit");
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const original: unknown = JSON.parse(text);
  scanForbidden(original);
  const obj = record(original);
  const direct = dishAutofillSuggestionSchema.safeParse(obj);
  if (direct.success) return { suggestion: direct.data, recovered: false };
  const culinary = record(obj.culinary);
  const nutrition = record(obj.nutrition);
  const safety = record(obj.safety);
  const numbers = ["calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams"] as const;
  const normalizedNumbers = Object.fromEntries(numbers.map((key) => [key, numberOrNull(nutrition[key])]));
  const result = {
    description: stringOr(obj.description),
    dietary: list(obj.dietary).map((value) => stringOr(value).toLowerCase()),
    culinary: {
      spiceLevel: numberOrNull(culinary.spiceLevel) ?? 0,
      flavorNotes: list(culinary.flavorNotes).map((value) => stringOr(value)),
      chefNote: stringOr(culinary.chefNote),
      servingTemp: stringOr(culinary.servingTemp, "hot").toLowerCase(),
    },
    nutrition: { ...normalizedNumbers, servingSize: nutrition.servingSize == null
      ? null : stringOr(nutrition.servingSize) },
    safety: {
      ingredients: list(safety.ingredients).map((value) => stringOr(value)),
      allergens: list(safety.allergens).map((value) => {
        const label = stringOr(value).toLowerCase();
        return allergenAliases[label] ?? label;
      }),
      // A model cannot know the outlet's actual cross-contact procedures.
      crossContact: "",
    },
    pairingNames: list(obj.pairingNames).map((value) => stringOr(value)),
  };
  return { suggestion: dishAutofillSuggestionSchema.parse(result), recovered: true };
}
export function parseDishAutofillResponse(raw: string): DishAutofillSuggestion {
  return parseDishAutofillWithDiagnostics(raw).suggestion;
}
