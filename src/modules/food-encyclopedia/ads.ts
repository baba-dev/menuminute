import type { FoodEntry } from "./contracts";
import { isEditoriallyIndexable } from "./contracts";

/**
 * P1 has NO ad provider, ad client ID, or consent management implementation.
 * The hard off switch is deliberate: it is not safe to turn on via env alone.
 */
export const FOOD_ADS_OPERATIONALLY_ENABLED = false as const;
export type FoodAdPlacement =
  "article-inline-1" | "article-inline-2" | "article-aside" | "browse-bottom";

export function mayRequestFoodAd(
  route: "article" | "browse" | "search" | "home" | "merchant",
  entry?: FoodEntry
): boolean {
  if (!FOOD_ADS_OPERATIONALLY_ENABLED) return false;
  if (route === "article") return Boolean(entry && isEditoriallyIndexable(entry));
  return false;
}
/** Only for reviewing reserved ad geometry in local design builds. */
export function showFoodAdDesignReservation(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.ENCYCLOPEDIA_AD_LAYOUT_PREVIEW === "1"
  );
}
