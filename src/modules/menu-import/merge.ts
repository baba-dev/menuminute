import type { ImportCandidate } from "./contracts";

type Category = ImportCandidate["categories"][number];
type Dish = Category["items"][number];
type Recognition = Dish["name"];

const MAX_EVIDENCE = 12;
/** Case, accent, punctuation and spacing-insensitive key for heading/dish comparison. */
export function normalizeLabel(value: string | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function mergeEvidence<T extends { evidence: Recognition["evidence"] }>(keep: T, extra: T) {
  const seen = new Set(keep.evidence.map((e) => e.sourceId + "|" + (e.excerpt ?? "")));
  for (const e of extra.evidence) {
    const key = e.sourceId + "|" + (e.excerpt ?? "");
    if (seen.has(key) || keep.evidence.length >= MAX_EVIDENCE) continue;
    seen.add(key);
    keep.evidence.push(e);
  }
}
/** Two transcriptions of one dish: same name and no price disagreement. */
function sameDish(a: Dish, b: Dish) {
  const name = normalizeLabel(a.name.value);
  if (!name || name !== normalizeLabel(b.name.value)) return false;
  const pa = a.priceMinor.value,
    pb = b.priceMinor.value;
  if (pa !== null && pb !== null && pa !== pb) return false;
  // Variant lists must also agree where both pages printed them.
  if (a.variants.length && b.variants.length) {
    const va = a.variants.map((v) => normalizeLabel(v.name.value) + ":" + v.priceMinor.value);
    const vb = b.variants.map((v) => normalizeLabel(v.name.value) + ":" + v.priceMinor.value);
    if (va.join("|") !== vb.join("|")) return false;
  }
  return true;
}
/**
 * Pages of one menu are transcribed independently, so a heading continued on the next page, or a dish
 * visible in two overlapping photographs, appears twice. Merge by normalized heading and drop only
 * dishes with the same name that do not conflict on price; conflicting prices stay as separate
 * entries for the human reviewer. First appearance wins, so identities and order are stable.
 */
export function mergeCandidateCategories(categories: Category[]): Category[] {
  const merged: Category[] = [];
  const byHeading = new Map<string, Category>();
  for (const category of categories) {
    const key = normalizeLabel(category.name.value);
    const existing = key ? byHeading.get(key) : undefined;
    if (!existing) {
      const copy: Category = { ...category, items: [] };
      merged.push(copy);
      if (key) byHeading.set(key, copy);
      addItems(copy, category.items);
      continue;
    }
    mergeEvidence(existing.name, category.name);
    addItems(existing, category.items);
  }
  return merged;
}
function addItems(target: Category, items: Dish[]) {
  for (const dish of items) {
    const duplicate = target.items.find((kept) => sameDish(kept, dish));
    if (!duplicate) {
      target.items.push(dish);
      continue;
    }
    mergeEvidence(duplicate.name, dish.name);
    if (duplicate.priceMinor.value === null && dish.priceMinor.value !== null)
      duplicate.priceMinor = dish.priceMinor;
    else mergeEvidence(duplicate.priceMinor, dish.priceMinor);
    if (!duplicate.description && dish.description) duplicate.description = dish.description;
    if (!duplicate.variants.length && dish.variants.length) duplicate.variants = dish.variants;
  }
}
