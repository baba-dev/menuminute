import { z } from "zod";

/**
 * Editorial content is intentionally separate from merchant dish/menu data.
 * Existing catalogue names and artworks are not proof of recipe, safety or review.
 */
export const foodKinds = ["dishes", "ingredients", "cuisines", "terms", "compare"] as const;
export const foodStatuses = ["draft", "in_review", "preview", "published", "archived"] as const;
export const FoodEntrySchema = z
  .object({
    id: z.string().min(3).max(80),
    kind: z.enum(foodKinds),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(2).max(100),
    eyebrow: z.string().min(3).max(120),
    description: z.string().min(35).max(320),
    imagePath: z.string().startsWith("/assets/food/dishes/").optional(),
    imageAlt: z.string().max(200).optional(),
    tint: z.enum(["cream", "sage", "blue", "peach", "lavender"]),
    status: z.enum(foodStatuses),
    aliases: z.array(z.string().max(90)).max(20).default([]),
    facts: z.array(z.object({ label: z.string().max(40), value: z.string().max(140) })).max(8),
    sections: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          eyebrow: z.string().max(80),
          title: z.string().max(150),
          body: z.array(z.string().min(25).max(1800)).min(1).max(6),
        })
      )
      .min(1)
      .max(12),
    relatedSlugs: z.array(z.string()).max(20).default([]),
    caution: z.string().min(20).max(650).optional(),
    sourceUrls: z.array(z.string().url()).max(20).default([]),
    reviewedBy: z.string().min(2).max(100).optional(),
    reviewedAt: z.string().datetime().optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();
export type FoodEntry = z.infer<typeof FoodEntrySchema>;
export type FoodKind = FoodEntry["kind"];

export function foodPath(entry: Pick<FoodEntry, "kind" | "slug">): string {
  return "/explore/" + entry.kind + "/" + encodeURIComponent(entry.slug);
}

/**
 * Do not infer publication from a present record or a menu catalogue alias.
 * A page is indexable only after a named review, published revision and sources.
 */
export function isEditoriallyIndexable(entry: FoodEntry): boolean {
  return (
    entry.status === "published" &&
    Boolean(entry.reviewedBy && entry.reviewedAt && entry.publishedAt) &&
    entry.sourceUrls.length > 0
  );
}

/** Search input cannot influence SQL or arbitrary external network calls. */
export function cleanFoodQuery(value: unknown): string {
  return (typeof value === "string" ? value : "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}
