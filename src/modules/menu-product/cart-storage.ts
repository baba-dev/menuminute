import { z } from "zod";
import type { CartItem, CustomizerDish } from "@/components/menu-product/item-customizer";
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "@/modules/orders/guest-checkout";

/** Storage is untrusted; the server independently validates the menu and requotes all prices. */
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const option = z
  .object({
    groupId: identifier,
    groupName: z.string().max(100),
    optionId: identifier,
    optionName: z.string().max(100),
    priceMinor: z.number().int().min(0).max(2147483647),
  })
  .strict();
const item = z
  .object({
    dishId: identifier,
    dishName: z.string().min(1).max(100),
    variantId: identifier.nullable(),
    variantName: z.string().max(100).nullable(),
    selectedAddOns: z.array(option).max(100),
    unitPriceMinor: z.number().int().min(0).max(2147483647),
    quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
    itemNotes: z.string().max(200),
  })
  .strict();
export function restoreGuestCart(raw: unknown, publishedDishIds: ReadonlySet<string>): CartItem[] {
  if (!Array.isArray(raw) || raw.length > MAX_CART_LINES) return [];
  const valid: CartItem[] = [];
  for (const candidate of raw) {
    const parsed = item.safeParse(candidate);
    if (parsed.success && publishedDishIds.has(parsed.data.dishId)) valid.push(parsed.data);
  }
  return valid;
}

export function reconcileGuestCart(raw: unknown, dishes: readonly CustomizerDish[]) {
  const lookup = new Map(dishes.map((dish) => [dish.id, dish]));
  const restored = restoreGuestCart(raw, new Set(lookup.keys()));
  const items: CartItem[] = [];
  let changed = Array.isArray(raw) ? Math.max(0, raw.length - restored.length) : 0;
  for (const saved of restored) {
    const dish = lookup.get(saved.dishId);
    if (!dish || dish.soldOut || dish.open === false) {
      changed++;
      continue;
    }
    const variant = saved.variantId
      ? dish.variants.find((candidate) => candidate.id === saved.variantId && candidate.isAvailable)
      : null;
    if ((saved.variantId && !variant) || (!saved.variantId && dish.variants.length)) {
      changed++;
      continue;
    }
    const selections: CartItem["selectedAddOns"] = [];
    let valid = true;
    for (const group of dish.addOnGroups) {
      const chosen = saved.selectedAddOns.filter((option) => option.groupId === group.id);
      if (chosen.length < group.min || chosen.length > group.max) valid = false;
      for (const prior of chosen) {
        const option = group.options.find(
          (candidate) => candidate.id === prior.optionId && candidate.isAvailable
        );
        if (!option) valid = false;
        else
          selections.push({
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceMinor: option.priceMinor,
          });
      }
    }
    if (!valid) {
      changed++;
      continue;
    }
    const unitPriceMinor =
      (variant?.priceMinor ?? dish.priceMinor) +
      selections.reduce((total, option) => total + option.priceMinor, 0);
    const next = {
      ...saved,
      dishName: dish.name,
      variantName: variant?.name ?? null,
      selectedAddOns: selections,
      unitPriceMinor,
    };
    if (JSON.stringify(next) !== JSON.stringify(saved)) changed++;
    items.push(next);
  }
  return { items, changed };
}
