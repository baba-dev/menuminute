import { menuDocumentSchema } from "./contracts";
import { normalizeDishText, type OrganizationDish } from "./dish-intelligence";

/** Input is exclusively menu rows returned under per-actor menu.read RLS. */
export function organizationFromAuthorizedMenus(
  rows: readonly { id: string; document: unknown; updatedAt: Date | string }[],
): OrganizationDish[] {
  const result: OrganizationDish[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 40)) {
    const parsed = menuDocumentSchema.safeParse(row.document);
    if (!parsed.success) continue;
    const doc = parsed.data;
    for (const section of doc.categories) {
      if (section.archived) continue;
      for (const dish of section.items) {
        if (dish.archived) continue;
        const normalized = normalizeDishText(dish.name);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push({
          key: "organization:" + row.id + ":" + dish.id,
          name: dish.name, categoryHint: section.name, sourceMenu: doc.name,
        });
        if (result.length >= 100) return result;
      }
    }
  }
  // The endpoint deliberately sends no price, personal data or media references.
  return result;
}
