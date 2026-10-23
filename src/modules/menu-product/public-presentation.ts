import type { PublicProduct } from "./service";
import { categoryIllustration, resolveDishVisual, type DishVisual } from "./dish-artwork";

/** V2 is additive to the existing immutable public menu/QR/ordering contract.
 * No marketing flags, popularity, discounts, nutrition or allergen data are inferred.
 * Keys are scoped to both menu and dish/category IDs, since shared menus can reuse IDs.
 */
export type PublicMenuPresentation = {
  version: 2;
  mode: "browse" | "ordering";
  identity: {
    name: string;
    outletType: string;
    currency: string;
    point: string | null;
  };
  categoryImages: Record<string, string>;
  dishImages: Record<string, DishVisual>;
};

type PublishedMenuInput = Pick<PublicProduct, "outlet" | "point" | "menus">;

export function buildPublicPresentation(data: PublishedMenuInput): PublicMenuPresentation {
  const categoryImages: Record<string, string> = {};
  const dishImages: Record<string, DishVisual> = {};
  for (const menu of data.menus) {
    for (const category of menu.document.categories) {
      if (category.archived) continue;
      categoryImages[`${menu.id}:${category.id}`] = categoryIllustration(category.name);
      for (const dish of category.items) {
        if (dish.archived) continue;
        dishImages[`${menu.id}:${dish.id}`] = resolveDishVisual({
          name: dish.name,
          mediaId: dish.mediaId,
          categoryName: category.name,
        });
      }
    }
  }
  return {
    version: 2,
    mode: data.outlet.orderingEnabled ? "ordering" : "browse",
    identity: {
      name: data.outlet.name,
      outletType: data.outlet.outletType,
      currency: data.outlet.currency,
      point: data.point,
    },
    categoryImages,
    dishImages,
  };
}
