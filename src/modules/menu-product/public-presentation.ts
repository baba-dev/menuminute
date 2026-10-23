import type { MenuDocument } from "./contracts";
import approvedArt from "@/data/approved-dish-artwork.json";
import { normalizeDishText } from "./normalize-dish-text";

/** Decorative assets only. Merchants' real, authorized photos always take priority.
 * This module stays client-safe: it does not import the 224-entry review manifest,
 * dish suggestion catalogue, database modules, or arbitrary user-supplied URLs.
 */
export const covers = {
  "artisan-bakery": "/assets/public-menu/covers/artisan-bakery.webp",
  "cafe-coffee": "/assets/public-menu/covers/cafe-coffee.webp",
  "indian-restaurant": "/assets/public-menu/covers/indian-restaurant.webp",
  "street-food-cloud-kitchen": "/assets/public-menu/covers/street-food-cloud-kitchen.webp",
} as const;

export type CoverPreset = keyof typeof covers;
export const defaultCover: CoverPreset = "indian-restaurant";
export const genericFoodIcon = "/icons/category-default.svg";

const categoryArt = {
  starters: "/assets/public-menu/categories/starters-snacks.webp",
  mains: "/assets/public-menu/categories/main-courses.webp",
  rice: "/assets/public-menu/categories/rice-biryani.webp",
  breads: "/assets/public-menu/categories/breads.webp",
  desserts: "/assets/public-menu/categories/desserts.webp",
  beverages: "/assets/public-menu/categories/beverages.webp",
} as const;

export function categoryImage(name: string): string {
  const s = normalizeDishText(name);
  if (/dessert|sweet|cake|pastr|bakery|mithai|ice cream|pudding/.test(s))
    return categoryArt.desserts;
  if (/beverage|drink|coffee|tea|juice|shake|lassi|smoothie/.test(s)) return categoryArt.beverages;
  if (/bread|naan|roti|paratha|kulcha|bun|flatbread/.test(s)) return categoryArt.breads;
  if (/rice|biryani|pulao|fried rice/.test(s)) return categoryArt.rice;
  if (/starter|snack|appetizer|small bite|chaat|samosa/.test(s)) return categoryArt.starters;
  return categoryArt.mains;
}

export function coverFor(document: Pick<MenuDocument, "presentation"> | null | undefined): string {
  const preset = document?.presentation?.cover ?? defaultCover;
  return covers[preset] ?? covers[defaultCover];
}

type VisualDish = {
  name: string;
  mediaId?: string | null;
  artworkId?: string | null;
  imageMode?: "auto" | "artwork" | "photo" | "none";
};
export type DiningVisual = {
  src: string;
  alternatives: string[];
  alt: string;
  fit: "cover" | "contain";
};
const safeMedia = /^[A-Za-z0-9_-]{1,128}$/;
const approved = approvedArt as readonly {
  label: string;
  path: string;
  state: string;
  slug: string;
  category: string;
}[];
const canonicalArt = /^\/assets\/food\/dishes\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;
function artworkFor(dish: VisualDish): string | null {
  const chosen = approved.filter(
    (a) =>
      a.state === "approved" &&
      canonicalArt.test(a.path) &&
      a.path === `/assets/food/dishes/${a.category}/${a.slug}.png` &&
      (dish.artworkId
        ? dish.artworkId === `${a.category}__${a.slug}`
        : normalizeDishText(a.label) === normalizeDishText(dish.name))
  );
  return chosen.length === 1 ? chosen[0]!.path : null;
}
export function dishVisual(dish: VisualDish, category: string, preview = false): DiningVisual {
  const fallback = categoryImage(category);
  if (dish.imageMode === "none") {
    return { src: genericFoodIcon, alternatives: [], alt: "", fit: "contain" };
  }
  const photo =
    dish.mediaId && safeMedia.test(dish.mediaId)
      ? (preview ? "/api/media/" : "/api/public-media/") +
        encodeURIComponent(dish.mediaId) +
        (preview ? "" : "?size=thumb")
      : null;
  const artwork = artworkFor(dish);
  const first =
    dish.imageMode === "artwork"
      ? artwork
      : dish.imageMode === "photo"
        ? photo
        : (photo ?? artwork);
  const alternatives = [
    ...new Set([first, artwork, fallback, genericFoodIcon].filter((s): s is string => Boolean(s))),
  ];
  const src = alternatives.shift() ?? genericFoodIcon;
  return {
    src,
    alternatives,
    alt:
      src === genericFoodIcon
        ? ""
        : `${first === photo ? "Photo" : "Illustration"} of ${dish.name}`,
    fit: src === photo ? "cover" : "contain",
  };
}
/** Never retry a failed image; each subsequent URL is a local, known asset. */
export function nextVisualSource(visual: DiningVisual, current: string): string | null {
  const ordered = [visual.src, ...visual.alternatives];
  const index = ordered.indexOf(current);
  return index < 0 ? null : (ordered[index + 1] ?? null);
}

export type FeaturedDish = {
  menuId: string;
  categoryName: string;
  dish: MenuDocument["categories"][number]["items"][number] & { open: boolean };
  currency: string;
};
export function featuredForMenu(
  menuId: string,
  view: Pick<MenuDocument, "presentation" | "currency"> & {
    categories: { name: string; items: FeaturedDish["dish"][] }[];
  }
): FeaturedDish[] {
  const ids = view.presentation?.featuredDishIds ?? [];
  return ids.flatMap((id) => {
    for (const category of view.categories) {
      const dish = category.items.find(
        (item) => item.id === id && !item.archived && !item.soldOut && item.open
      );
      if (dish) return [{ menuId, categoryName: category.name, dish, currency: view.currency }];
    }
    return [];
  });
}
