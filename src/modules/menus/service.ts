/**
 * Menu data access module.
 * All queries are tenant-scoped (always filter by restaurantId).
 */
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { displayToMinor } from "@/lib/money";
import { menuCategories, menuItems, restaurants } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

// ─── Validation Schemas ──────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const createMenuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  // Price in rupees (display units) — converted to paise internally
  priceRupees: z.number().finite().min(0),
  isVeg: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  spiceLevel: z.number().int().min(0).max(3).optional().default(0),
  isFeatured: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .omit({ categoryId: true })
  .extend({
    categoryId: z.string().min(1).optional(),
  });

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.input<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.input<typeof updateMenuItemSchema>;

// Every private query resolves current scoped membership inside its transaction.
export async function getCategoriesByRestaurant(actor: Actor, restaurantId: string) {
  return withOutlet(actor, restaurantId, "menu.read", (tx) =>
    tx
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurantId))
      .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name))
  );
}
export async function getCategoryById(actor: Actor, id: string, restaurantId: string) {
  return withOutlet(
    actor,
    restaurantId,
    "menu.read",
    async (tx) =>
      (
        await tx
          .select()
          .from(menuCategories)
          .where(and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, restaurantId)))
      )[0]
  );
}
export async function createCategory(actor: Actor, restaurantId: string, raw: CreateCategoryInput) {
  const input = createCategorySchema.parse(raw);
  return withOutlet(
    actor,
    restaurantId,
    "menu.write",
    async (tx) =>
      (
        await tx
          .insert(menuCategories)
          .values({ id: nanoid(), restaurantId, ...input })
          .returning()
      )[0]!
  );
}
export async function updateCategory(
  actor: Actor,
  id: string,
  restaurantId: string,
  raw: UpdateCategoryInput
) {
  const input = updateCategorySchema.parse(raw);
  return withOutlet(actor, restaurantId, "menu.write", async (tx) => {
    const [row] = await tx
      .update(menuCategories)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, restaurantId)))
      .returning();
    if (!row) throw new NotFoundError("Category");
    return row;
  });
}
export async function deleteCategory(actor: Actor, id: string, restaurantId: string) {
  await updateCategory(actor, id, restaurantId, { isActive: false } as UpdateCategoryInput);
}
export async function getMenuItemsByCategory(
  actor: Actor,
  categoryId: string,
  restaurantId: string
) {
  return withOutlet(actor, restaurantId, "menu.read", (tx) =>
    tx
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.restaurantId, restaurantId)))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.name))
  );
}
export async function getMenuItemById(actor: Actor, id: string, restaurantId: string) {
  return withOutlet(
    actor,
    restaurantId,
    "menu.read",
    async (tx) =>
      (
        await tx
          .select()
          .from(menuItems)
          .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
      )[0]
  );
}
export async function getFullMenu(actor: Actor, restaurantId: string) {
  return withOutlet(actor, restaurantId, "menu.read", async (tx) => {
    const categories = await tx
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.restaurantId, restaurantId), eq(menuCategories.isActive, true)))
      .orderBy(asc(menuCategories.sortOrder));
    const items = await tx
      .select()
      .from(menuItems)
      .where(eq(menuItems.restaurantId, restaurantId))
      .orderBy(asc(menuItems.sortOrder));
    return categories.map((category) => ({
      category,
      items: items.filter((i) => i.categoryId === category.id),
    }));
  });
}
export async function createMenuItem(actor: Actor, restaurantId: string, raw: CreateMenuItemInput) {
  const input = createMenuItemSchema.parse(raw);
  return withOutlet(actor, restaurantId, "menu.write", async (tx) => {
    const [outlet] = await tx
      .select({ currency: restaurants.currency })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId));
    if (!outlet) throw new NotFoundError("Outlet");
    const { priceRupees, ...data } = input;
    return (
      await tx
        .insert(menuItems)
        .values({
          id: nanoid(),
          restaurantId,
          ...data,
          pricePaise: displayToMinor(priceRupees, outlet.currency),
        })
        .returning()
    )[0]!;
  });
}
export async function updateMenuItem(
  actor: Actor,
  id: string,
  restaurantId: string,
  raw: UpdateMenuItemInput
) {
  const { priceRupees, ...input } = updateMenuItemSchema.parse(raw);
  return withOutlet(actor, restaurantId, "menu.write", async (tx) => {
    const [outlet] = await tx
      .select({ currency: restaurants.currency })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId));
    if (!outlet) throw new NotFoundError("Outlet");
    const [row] = await tx
      .update(menuItems)
      .set({
        ...input,
        ...(priceRupees === undefined
          ? {}
          : { pricePaise: displayToMinor(priceRupees, outlet.currency) }),
        updatedAt: new Date(),
      })
      .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
      .returning();
    if (!row) throw new NotFoundError("Menu item");
    return row;
  });
}
export async function deleteMenuItem(actor: Actor, id: string, restaurantId: string) {
  await updateMenuItem(actor, id, restaurantId, { isAvailable: false });
}
