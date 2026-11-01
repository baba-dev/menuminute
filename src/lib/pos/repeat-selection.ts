import type { QuoteInput } from "@/modules/orders/quote";
import type { PosRepeatSelection, PosWorkspace } from "@/modules/pos/service";

type RepeatLine = {
  line: QuoteInput["lines"][number];
  name: string;
  variantName: string | null;
  unitMinor: number;
};

/**
 * A historical order is only a selection suggestion. Resolve every item against
 * one CURRENT published and open menu; never reuse recorded prices or accept
 * partial, substituted, or unavailable repeats.
 */
export function prepareRepeatCart(
  snapshot: PosRepeatSelection,
  menus: PosWorkspace["menus"],
  preferredMenuId: string
): { menuId: string; items: RepeatLine[] } {
  const eligible = menus
    .filter((menu) => menu.open)
    .sort((a, b) => Number(b.id === preferredMenuId) - Number(a.id === preferredMenuId));
  for (const menu of eligible) {
    const dishes = menu.categories.flatMap((category) => category.items);
    const prepared: RepeatLine[] = [];
    let valid = true;
    for (const selection of snapshot.items) {
      const dish = dishes.find((item) => item.id === selection.dishId);
      if (!dish || !dish.open || dish.soldOut) {
        valid = false;
        break;
      }
      const variant = dish.variants.find((option) => option.id === selection.variantId);
      if (
        (dish.variants.length > 0 && (!variant || !variant.isAvailable)) ||
        (dish.variants.length === 0 && selection.variantId !== null)
      ) {
        valid = false;
        break;
      }
      const byGroup = new Map<string, string[]>();
      for (const option of selection.selectedOptions) {
        const ids = byGroup.get(option.groupId) ?? [];
        ids.push(option.optionId);
        byGroup.set(option.groupId, ids);
      }
      if ([...byGroup.keys()].some((id) => !dish.addOnGroups.some((group) => group.id === id))) {
        valid = false;
        break;
      }
      let unitMinor = variant?.priceMinor ?? dish.priceMinor;
      const groups: QuoteInput["lines"][number]["groups"] = [];
      for (const group of dish.addOnGroups) {
        const optionIds = byGroup.get(group.id) ?? [];
        if (
          optionIds.length < group.min ||
          optionIds.length > group.max ||
          new Set(optionIds).size !== optionIds.length
        ) {
          valid = false;
          break;
        }
        for (const optionId of optionIds) {
          const option = group.options.find((candidate) => candidate.id === optionId);
          if (!option || !option.isAvailable) {
            valid = false;
            break;
          }
          unitMinor += option.priceMinor;
        }
        if (!valid) break;
        groups.push({ groupId: group.id, optionIds });
      }
      if (!valid || !Number.isSafeInteger(unitMinor) || unitMinor < 0) {
        valid = false;
        break;
      }
      prepared.push({
        line: {
          dishId: dish.id,
          variantId: variant?.id ?? null,
          groups,
          quantity: selection.quantity,
        },
        name: dish.name,
        variantName: variant?.name ?? null,
        unitMinor,
      });
    }
    if (valid && prepared.length === snapshot.items.length) {
      return { menuId: menu.id, items: prepared };
    }
  }
  throw new Error(
    "This order cannot be repeated exactly with the currently available menu. Review the dishes and add them manually."
  );
}
