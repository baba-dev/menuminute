import { z } from "zod";
import { ConflictError, ValidationError } from "@/lib/errors";
import type { PublicProduct } from "@/modules/menu-product/service";
import { projectMenu } from "@/modules/menu-product/projector";
import { currencyExponent } from "@/lib/money";

/**
 * P5 canonical **pre-tax selection/quote producer**. No order or price authority is granted
 * to the browser. The future command handler must re-read a released menu and re-quote in
 * its own transaction before committing. Never treat this response as tax-complete checkout.
 * Pricing jurisdictions and commercial entitlements remain separate release gates.
 */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const selectedGroup = z
  .object({ groupId: id, optionIds: z.array(id).max(100) })
  .strict();
export const quoteInputSchema = z
  .object({
    menuId: id,
    expectedRevision: z.number().int().nonnegative(),
    lines: z
      .array(
        z
          .object({
            dishId: id,
            variantId: id.nullable(),
            groups: z.array(selectedGroup).max(30),
            quantity: z.number().int().positive().safe(),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();
export type QuoteInput = z.infer<typeof quoteInputSchema>;

const MAX_SIGNED_BIGINT = (1n << 63n) - 1n;
function validMinor(amount: number): bigint {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new ValidationError("An item has an invalid price");
  return BigInt(amount);
}
function unique(values: readonly string[], message: string) {
  if (new Set(values).size !== values.length) throw new ValidationError(message);
}
export type QuotedLine = {
  dishId: string;
  name: string;
  variant: { id: string; name: string } | null;
  options: { groupId: string; id: string; name: string; priceMinor: string }[];
  quantity: number;
  unitMinor: string;
  lineSubtotalMinor: string;
};
/** Monetary values are decimal integer STRINGS; no float arithmetic or 2-decimal assumption. */
export type SelectionQuote = {
  menuId: string;
  revision: number;
  currency: string;
  exponent: number;
  lines: QuotedLine[];
  subtotalMinor: string;
  taxAndFeesCalculated: false;
};
export function quotePublishedSelection(
  publicMenu: PublicProduct,
  raw: unknown,
  instant: Date
): SelectionQuote {
  const input = quoteInputSchema.parse(raw);
  if (!Number.isFinite(instant.valueOf())) throw new ValidationError("Invalid quote instant");
  if (!publicMenu.outlet.versioned || publicMenu.outlet.isDemoData)
    throw new ValidationError("Only a released real menu can be quoted");
  const m = publicMenu.menus.find((menu) => menu.id === input.menuId);
  if (!m) throw new ValidationError("The selected menu is unavailable");
  if (m.revision !== input.expectedRevision)
    throw new ConflictError("The published menu changed. Review its current prices and availability.");
  const doc = projectMenu(m.document, publicMenu.outlet.timezone, instant, m.overrides);
  if (!doc.open) throw new ConflictError("This menu is outside its scheduled service");
  if (doc.currency !== publicMenu.outlet.currency)
    throw new ValidationError("The outlet currency does not match the published menu");
  const exponent = currencyExponent(doc.currency);
  if (exponent === null) throw new ValidationError("Unsupported outlet currency");
  const dishes = doc.categories.flatMap((c) => c.items);
  const lines: QuotedLine[] = [];
  let total = 0n;
  for (const selection of input.lines) {
    const dish = dishes.find((d) => d.id === selection.dishId);
    if (!dish || dish.soldOut || !dish.open)
      throw new ConflictError("A selected dish is unavailable. Review your selection.");
    if (dish.variants.length === 0 && selection.variantId !== null)
      throw new ValidationError("This dish does not have variants");
    if (dish.variants.length > 0 && selection.variantId === null)
      throw new ValidationError("Choose a variant for this dish");
    const variant = dish.variants.find((v) => v.id === selection.variantId);
    if (selection.variantId !== null && (!variant || !variant.isAvailable))
      throw new ConflictError("The selected variant is unavailable");
    unique(selection.groups.map((g) => g.groupId), "Duplicate add-on group");
    for (const selected of selection.groups) {
      if (!dish.addOnGroups.some((g) => g.id === selected.groupId))
        throw new ValidationError("Unknown add-on group");
    }
    let unit = validMinor(variant ? variant.priceMinor : dish.priceMinor);
    const options: QuotedLine["options"] = [];
    for (const group of dish.addOnGroups) {
      const ids = selection.groups.find((g) => g.groupId === group.id)?.optionIds ?? [];
      unique(ids, "Duplicate add-on option");
      if (ids.length < group.min || ids.length > group.max)
        throw new ValidationError(`Select ${group.min}–${group.max} options in ${group.name}`);
      for (const optionId of ids) {
        const option = group.options.find((o) => o.id === optionId);
        if (!option || !option.isAvailable)
          throw new ConflictError("An add-on is unavailable. Review your selection.");
        const price = validMinor(option.priceMinor);
        unit += price;
        options.push({ groupId: group.id, id: option.id, name: option.name, priceMinor: String(price) });
      }
    }
    const lineTotal = unit * BigInt(selection.quantity);
    if (lineTotal > MAX_SIGNED_BIGINT || total + lineTotal > MAX_SIGNED_BIGINT)
      throw new ValidationError("The selection exceeds supported monetary representation");
    total += lineTotal;
    lines.push({
      dishId: dish.id,
      name: dish.name,
      variant: variant ? { id: variant.id, name: variant.name } : null,
      options,
      quantity: selection.quantity,
      unitMinor: String(unit),
      lineSubtotalMinor: String(lineTotal),
    });
  }
  return {
    menuId: m.id,
    revision: m.revision,
    currency: doc.currency,
    exponent,
    lines,
    subtotalMinor: String(total),
    taxAndFeesCalculated: false,
  };
}
