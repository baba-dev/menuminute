import type { MenuDocument } from "./contracts";
import { findCulinaryProfile, normalizeDishText } from "./dish-intelligence";

type Dish = MenuDocument["categories"][number]["items"][number];

/**
 * Apply only when constructing a new private dish.
 * The source is an editorial recipe example, not the outlet's verified recipe.
 * No cross-tenant media, prices, dietary assertions or unverified free-from claims escape.
 */
export function draftCulinaryDefaults(
  name: string,
  availableDishes: readonly Pick<Dish, "id" | "name">[]
): Partial<Dish> {
  const profile = findCulinaryProfile(name);
  if (!profile) return {};
  const companionIds = profile.culinary.suggestedPairings
    .map(
      (suggested) =>
        availableDishes.find(
          (dish) => normalizeDishText(dish.name) === normalizeDishText(suggested)
        )?.id
    )
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 4);
  return {
    nutrition: { ...profile.nutrition, verified: false },
    culinary: {
      spiceLevel: profile.culinary.spiceLevel,
      flavorNotes: [...profile.culinary.flavorNotes],
      chefNote: profile.culinary.chefNote,
      servingTemp: profile.culinary.servingTemp,
      pairingDishIds: companionIds,
    },
    safety: {
      ...profile.safety,
      ingredients: [...profile.safety.ingredients],
      allergens: [...profile.safety.allergens],
      verified: false,
      verifiedFreeFrom: [],
    },
  };
}
