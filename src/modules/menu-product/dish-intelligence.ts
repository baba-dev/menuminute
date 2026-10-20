import { z } from "zod";
import rawCatalogue from "@/data/dish-catalogue.json";
import type { MenuDocument } from "./contracts";

// Editorial name suggestions only. Never infer menu prices, dietary claims, approval or ownership.
const entry = z
  .object({
    id: z.string().regex(/^MM-[A-Za-z0-9-]{1,90}$/),
    name: z.string().trim().min(1).max(100),
    categoryHint: z.string().trim().min(1).max(100),
    aliases: z.array(z.string().trim().min(2).max(100)).max(12),
  })
  .strict();
export const catalogueSchema = z.array(entry).min(1).max(2500);
export type CatalogueDish = z.infer<typeof entry>;
export type ExistingDish = {
  outletId: string;
  menuId: string;
  categoryId: string;
  categoryName: string;
  dishId: string;
  name: string;
  mediaId: string | null;
  archived: boolean;
};
export type Suggestion = {
  key: string;
  source: "existing" | "catalogue" | "organization";
  name: string;
  categoryHint: string;
  dishId: string | null;
  categoryId: string | null;
  mediaId: string | null;
  sourceMenu?: string;
};
// Explicit, editorially checked common Hindi/Arabic terms. Preserve unrecognized Unicode
// tokens verbatim; never approximate translations or derive nutritional information.
const translations: Record<string, string> = {
  "पनीर": "paneer", "मसाला": "masala", "टिक्का": "tikka", "बिरयानी": "biryani",
  "बिरयानीं": "biryani", "दाल": "dal", "चावल": "chawal", "समोसा": "samosa",
  "चाय": "chai", "छोले": "chole", "भटूरे": "bhature", "आलू": "aloo",
  "डोसा": "dosa", "मक्खनी": "makhani", "नान": "naan", "पिज़्ज़ा": "pizza",
  "शाही": "shahi", "कड़ाही": "kadai",
  "بانير": "paneer", "بانيير": "paneer", "برياني": "biryani",
  "بريانـي": "biryani", "ماسالا": "masala", "تيكا": "tikka",
  "سمبوسة": "samosa", "شاي": "chai", "بيتزا": "pizza",
  "شاورما": "shawarma", "دال": "dal", "نان": "naan",
};
export function normalizeDishText(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u200c\u200d]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
    .split(" ").map(token => translations[token] ?? token).join(" ");
}
export type OrganizationDish = {
  key: string;
  name: string;
  categoryHint: string;
  sourceMenu: string;
};
export function recentFromDocument(doc: MenuDocument, limit = 6): OrganizationDish[] {
  const seen = new Set<string>();
  const rows: OrganizationDish[] = [];
  for (const cat of [...doc.categories].reverse()) {
    if (cat.archived) continue;
    for (const dish of [...cat.items].reverse()) {
      const name = normalizeDishText(dish.name);
      if (dish.archived || seen.has(name)) continue;
      seen.add(name);
      rows.push({ key: "recent:" + dish.id, name: dish.name, categoryHint: cat.name, sourceMenu: doc.name });
      if (rows.length >= Math.max(1, Math.min(12, limit))) return rows;
    }
  }
  return rows;
}
export function batchCandidates(value: string) {
  const rows = value.split(/[\n,;]+/u).map(s => s.trim()).filter(Boolean);
  if (rows.some(name => name.length > 100)) throw new Error("Dish names must be 100 characters or fewer.");
  if (rows.length > 50) throw new Error("Add up to 50 dishes per batch.");
  const seen = new Set<string>();
  return rows.filter(name => {
    const normalized = normalizeDishText(name);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
export function validateCatalogue(value: unknown): CatalogueDish[] {
  const parsed = catalogueSchema.parse(value);
  const names = new Set<string>(),
    ids = new Set<string>();
  for (const dish of parsed) {
    const name = normalizeDishText(dish.name);
    if (!name || names.has(name) || ids.has(dish.id))
      throw new Error("Dish catalogue contains duplicate IDs or normalized names");
    names.add(name);
    ids.add(dish.id);
    if (dish.aliases.some((a) => !normalizeDishText(a)))
      throw new Error("Dish catalogue contains an empty normalized alias");
  }
  return parsed;
}
export const dishCatalogue = validateCatalogue(rawCatalogue);

/** Only project an already authorized menu document; no cross-outlet catalogue query. */
export function existingFromDocument(
  doc: MenuDocument,
  outletId: string,
  menuId: string
): ExistingDish[] {
  return doc.categories.flatMap((category) =>
    category.items.map((dish) => ({
      outletId,
      menuId,
      categoryId: category.id,
      categoryName: category.name,
      dishId: dish.id,
      name: dish.name,
      mediaId: dish.mediaId,
      archived: dish.archived || category.archived,
    }))
  );
}
export function findDishDuplicate(doc: MenuDocument, categoryId: string, name: string) {
  const normalized = normalizeDishText(name);
  return (
    doc.categories
      .find((c) => c.id === categoryId)
      ?.items.find((d) => !d.archived && normalizeDishText(d.name) === normalized) ?? null
  );
}
export function rankDishSuggestions(args: {
  query: string;
  outletId: string;
  menuId: string;
  existing: readonly ExistingDish[];
  catalogue?: readonly CatalogueDish[];
  organization?: readonly OrganizationDish[];
  limit?: number;
}): Suggestion[] {
  const q = normalizeDishText(args.query).slice(0, 100);
  if (q.length < 2) return [];
  const limit = Math.min(20, Math.max(1, Math.trunc(args.limit ?? 7)));
  const score = (name: string, aliases: readonly string[] = []) => {
    const tokens = [name, ...aliases].map(normalizeDishText);
    if (tokens.some((t) => t === q)) return 0;
    if (tokens.some((t) => t.startsWith(q))) return 1;
    if (tokens.some((t) => t.split(" ").some((w) => w.startsWith(q)))) return 2;
    if (tokens.some((t) => t.includes(q))) return 3;
    return Infinity;
  };
  const safeExisting = args.existing.filter(
    (d) => d.outletId === args.outletId && d.menuId === args.menuId && !d.archived
  );
  const matches: { item: Suggestion; rank: number }[] = [];
  for (const d of safeExisting) {
    const rank = score(d.name);
    if (rank !== Infinity)
      matches.push({
        rank: rank - 0.25,
        item: {
          key: "existing:" + d.dishId,
          source: "existing",
          name: d.name,
          categoryHint: d.categoryName,
          dishId: d.dishId,
          categoryId: d.categoryId,
          mediaId: d.mediaId,
        },
      });
  }
  const existingNames = new Set(safeExisting.map((d) => normalizeDishText(d.name)));
  // Only use organization suggestions already filtered by the authenticated server.
  // Reuse names/category hints only: never copy another outlet's price or media identity.
  const orgSeen = new Set<string>();
  for (const d of (args.organization ?? []).slice(0, 100)) {
    const name = normalizeDishText(d.name);
    if (!name || orgSeen.has(name) || existingNames.has(name)) continue;
    orgSeen.add(name);
    const rank = score(d.name);
    if (rank !== Infinity) matches.push({
      rank: rank + 0.05,
      item: {
        key: d.key, source: "organization", name: d.name,
        categoryHint: d.categoryHint, sourceMenu: d.sourceMenu,
        dishId: null, categoryId: null, mediaId: null,
      },
    });
  }
  for (const d of args.catalogue ?? dishCatalogue) {
    if (existingNames.has(normalizeDishText(d.name))) continue;
    const rank = score(d.name, d.aliases);
    if (rank !== Infinity)
      matches.push({
        rank,
        item: {
          key: "catalogue:" + d.id,
          source: "catalogue",
          name: d.name,
          categoryHint: d.categoryHint,
          dishId: null,
          categoryId: null,
          mediaId: null,
        },
      });
  }
  return matches
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.item.name.localeCompare(b.item.name) ||
        a.item.key.localeCompare(b.item.key)
    )
    .slice(0, limit)
    .map((m) => m.item);
}
