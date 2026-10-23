import { z } from "zod";
import type { CartItem } from "@/components/menu-product/item-customizer";

/** Storage is untrusted; the server independently validates the menu and requotes all prices. */
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const option = z.object({
  groupId: identifier,
  groupName: z.string().max(100),
  optionId: identifier,
  optionName: z.string().max(100),
  priceMinor: z.number().int().min(0).max(2147483647),
}).strict();
const item = z.object({
  dishId: identifier,
  dishName: z.string().min(1).max(100),
  variantId: identifier.nullable(),
  variantName: z.string().max(100).nullable(),
  selectedAddOns: z.array(option).max(100),
  unitPriceMinor: z.number().int().min(0).max(2147483647),
  quantity: z.number().int().min(1).max(99),
  itemNotes: z.string().max(200),
}).strict();
export function restoreGuestCart(raw: unknown, publishedDishIds: ReadonlySet<string>): CartItem[] {
  if (!Array.isArray(raw) || raw.length > 40) return [];
  const valid: CartItem[] = [];
  for (const candidate of raw) {
    const parsed = item.safeParse(candidate);
    if (parsed.success && publishedDishIds.has(parsed.data.dishId)) valid.push(parsed.data);
  }
  return valid;
}
