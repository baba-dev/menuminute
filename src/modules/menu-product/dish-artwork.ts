import approvedRuntimeArt from "@/data/approved-dish-artwork.json";
import { normalizeDishText } from "./normalize-dish-text";

export type ArtworkAsset = {
  label: string;
  path: string;
  state: string;
  slug: string;
  category: string;
};

export type DishVisual = {
  source: "restaurant" | "catalogue" | "category";
  src: string;
  fallbackSrc: string;
  categorySrc: string;
  alt: string;
};

const canonical = /^\/assets\/food\/dishes\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;
const mediaIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const defaultIllustration = "/icons/category-default.svg";

/** Imported files are NOT approved merely because they are checked into public/.
 * Runtime selection uses only explicitly approved canonical manifest entries.
 * An illustration is display-only; it never becomes a dish_media upload or implies diet/allergens.
 */
export function approvedArtworkForDish(
  name: string,
  assets: readonly ArtworkAsset[] = approvedRuntimeArt
): { path: string; label: string } | null {
  const wanted = normalizeDishText(name);
  if (!wanted) return null;
  const exact = assets.find(
    (asset) =>
      asset.state === "approved" &&
      canonical.test(asset.path) &&
      asset.path === `/assets/food/dishes/${asset.category}/${asset.slug}.png` &&
      normalizeDishText(asset.label) === wanted
  );
  return exact ? { path: exact.path, label: exact.label } : null;
}

/** Intentional broad category matches only: never guess a specific dish's picture. */
export function categoryIllustration(categoryName: string): string {
  const category = normalizeDishText(categoryName);
  if (/dessert|sweet|cake|pastr|bakery|mithai|ice cream/.test(category))
    return "/icons/category-desserts.svg";
  if (/beverage|drink|coffee|tea|juice|shake|lassi/.test(category))
    return "/icons/category-beverages.svg";
  if (/bread|naan|roti|paratha|kulcha/.test(category)) return "/icons/category-breads.svg";
  if (/rice|biryani|pulao/.test(category)) return "/icons/category-rice.svg";
  if (/starter|snack|appetizer|small bite/.test(category)) return "/icons/category-starters.svg";
  return defaultIllustration;
}

/** Resolves presentation only. The server's approved-public-media endpoint still gates photos
 * by outlet, published release and media approval; failures fall back to approved local art.
 */
export function resolveDishVisual(
  dish: { name: string; mediaId: string | null; categoryName: string },
  assets: readonly ArtworkAsset[] = approvedRuntimeArt
): DishVisual {
  const artwork = approvedArtworkForDish(dish.name, assets);
  const category = categoryIllustration(dish.categoryName);
  const fallbackSrc = artwork?.path ?? category;
  if (dish.mediaId && mediaIdPattern.test(dish.mediaId)) {
    return {
      source: "restaurant",
      src: `/api/public-media/${encodeURIComponent(dish.mediaId)}?size=thumb`,
      fallbackSrc,
      categorySrc: category,
      alt: `Photo of ${dish.name}`,
    };
  }
  if (artwork) {
    return {
      source: "catalogue",
      src: artwork.path,
      fallbackSrc: category,
      categorySrc: category,
      alt: `Illustration of ${dish.name}`,
    };
  }
  return {
    source: "category",
    src: category,
    fallbackSrc: defaultIllustration,
    categorySrc: category,
    alt: "",
  };
}

/** A bounded, local-only retry order, deduplicated so missing assets cannot loop. */
export function nextDishImageSource(visual: DishVisual, current: string): string | null {
  const sources = [...new Set([visual.src, visual.fallbackSrc, visual.categorySrc, defaultIllustration])];
  const at = sources.indexOf(current);
  return at < 0 ? null : (sources[at + 1] ?? null);
}
