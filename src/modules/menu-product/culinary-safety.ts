import type { DishSafetyProfile, DishNutrition } from "./contracts";

type SafetyDish = {
  safety?: Partial<Pick<DishSafetyProfile, "allergens" | "ingredients" | "crossContact" | "verified" | "verifiedFreeFrom">>;
  variants?: readonly unknown[];
  addOnGroups?: readonly unknown[];
};

/** Missing declarations are unknown, never a negative allergen test. */
export function isVerifiedFreeFrom(dish: SafetyDish, allergen: "nuts" | "dairy"): boolean {
  const safety = dish.safety;
  if (!safety?.verified || !safety.verifiedFreeFrom?.includes(allergen)) return false;
  if (!safety.ingredients?.length || safety.crossContact?.trim()) return false;
  if (allergen === "nuts" && safety.allergens?.some((a) => a === "nuts" || a === "peanuts"))
    return false;
  if (allergen === "dairy" && safety.allergens?.includes("dairy")) return false;
  // Variant and add-on safety isn't represented at option level. Fail closed until it is.
  return !dish.variants?.length && !dish.addOnGroups?.length;
}

export function hasVerifiedNutrition(nutrition?: DishNutrition): boolean {
  return nutrition?.verified === true &&
    [nutrition.calories, nutrition.proteinGrams, nutrition.carbsGrams, nutrition.fatGrams, nutrition.fiberGrams]
      .some((value) => value !== undefined);
}

type Companion = {
  soldOut?: boolean;
  archived?: boolean;
  open?: boolean;
  variants: readonly unknown[];
  addOnGroups: readonly { min: number }[];
};

/** Public suggestions follow the same availability requirements as ordinary cart entry. */
export function canQuickAddCompanion(dish: Companion): boolean {
  return !dish.soldOut && !dish.archived && dish.open !== false &&
    dish.variants.length === 0 && dish.addOnGroups.every((group) => group.min === 0);
}
