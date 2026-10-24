import { z } from "zod";
import { entityId, type MenuDocument } from "./contracts";

export const menuLocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Use a BCP 47 language tag")
  .transform((value) => {
    try {
      return Intl.getCanonicalLocales(value)[0]!;
    } catch {
      return value;
    }
  });

const translatedOption = z
  .object({ id: entityId, name: z.string().trim().min(1).max(100) })
  .strict();
const translatedGroup = z
  .object({
    id: entityId,
    name: z.string().trim().min(1).max(100),
    options: z.array(translatedOption).max(100),
  })
  .strict();
const translatedDish = z
  .object({
    id: entityId,
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000),
    variants: z.array(translatedOption).max(100),
    addOnGroups: z.array(translatedGroup).max(30),
  })
  .strict();
const translatedCategory = z
  .object({
    id: entityId,
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500),
    items: z.array(translatedDish).max(1000),
  })
  .strict();
export const menuTranslationDocumentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    headline: z.string().trim().max(110),
    categories: z.array(translatedCategory).max(100),
  })
  .strict()
  .superRefine((document, context) => {
    if (JSON.stringify(document).length > 300_000)
      context.addIssue({ code: "custom", message: "Translation exceeds the request limit" });
  });
export type MenuTranslationDocument = z.infer<typeof menuTranslationDocumentSchema>;
export type MenuTranslation = {
  locale: string;
  revision: number;
  sourceRevision: number;
  reviewedAt: string;
  reviewedBy?: string;
  stale: boolean;
  document: MenuTranslationDocument;
};

export function translationTemplate(document: MenuDocument): MenuTranslationDocument {
  return {
    name: document.name,
    headline: document.presentation?.headline ?? "",
    categories: document.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      items: category.items.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        variants: dish.variants.map(({ id, name }) => ({ id, name })),
        addOnGroups: dish.addOnGroups.map((group) => ({
          id: group.id,
          name: group.name,
          options: group.options.map(({ id, name }) => ({ id, name })),
        })),
      })),
    })),
  };
}

/**
 * A translation can replace display strings only. Canonical IDs, prices, availability,
 * dietary claims, schedules and media always come from the reviewed published release.
 */
export function applyMenuTranslation(
  canonical: MenuDocument,
  translated: MenuTranslationDocument
): MenuDocument {
  const categories = new Map(translated.categories.map((category) => [category.id, category]));
  return {
    ...canonical,
    name: translated.name,
    presentation: canonical.presentation
      ? { ...canonical.presentation, headline: translated.headline }
      : canonical.presentation,
    categories: canonical.categories.map((category) => {
      const translatedCategory = categories.get(category.id);
      const dishes = new Map(translatedCategory?.items.map((dish) => [dish.id, dish]) ?? []);
      return {
        ...category,
        name: translatedCategory?.name ?? category.name,
        description: translatedCategory?.description ?? category.description,
        items: category.items.map((dish) => {
          const translatedDish = dishes.get(dish.id);
          const variants = new Map(
            translatedDish?.variants.map((variant) => [variant.id, variant]) ?? []
          );
          const groups = new Map(
            translatedDish?.addOnGroups.map((group) => [group.id, group]) ?? []
          );
          return {
            ...dish,
            name: translatedDish?.name ?? dish.name,
            description: translatedDish?.description ?? dish.description,
            variants: dish.variants.map((variant) => ({
              ...variant,
              name: variants.get(variant.id)?.name ?? variant.name,
            })),
            addOnGroups: dish.addOnGroups.map((group) => {
              const translatedGroup = groups.get(group.id);
              const options = new Map(
                translatedGroup?.options.map((option) => [option.id, option]) ?? []
              );
              return {
                ...group,
                name: translatedGroup?.name ?? group.name,
                options: group.options.map((option) => ({
                  ...option,
                  name: options.get(option.id)?.name ?? option.name,
                })),
              };
            }),
          };
        }),
      };
    }),
  };
}

export function sameTranslationShape(
  canonical: MenuDocument,
  translated: MenuTranslationDocument
): boolean {
  const expected = translationTemplate(canonical);
  const ids = (document: MenuTranslationDocument) =>
    document.categories.map((category) => ({
      id: category.id,
      items: category.items.map((dish) => ({
        id: dish.id,
        variants: dish.variants.map((variant) => variant.id),
        groups: dish.addOnGroups.map((group) => ({
          id: group.id,
          options: group.options.map((option) => option.id),
        })),
      })),
    }));
  return JSON.stringify(ids(expected)) === JSON.stringify(ids(translated));
}
