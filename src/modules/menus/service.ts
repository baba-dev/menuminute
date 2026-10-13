/**
 * Menu data access module.
 * All queries are tenant-scoped (always filter by restaurantId).
 */
import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/db";
import { menuCategories, menuItems } from "@/db/schema";
import type { MenuCategory, MenuItem, NewMenuItem } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";

// ─── Validation Schemas ──────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createMenuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  // Price in rupees (display units) — converted to paise internally
  priceRupees: z.number().min(0),
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

// ─── Category Queries ─────────────────────────────────────────────────────────

export function getCategoriesByRestaurant(restaurantId: string): MenuCategory[] {
  const db = getDb();
  return db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.restaurantId, restaurantId))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name))
    .all();
}

export function getCategoryById(id: string, restaurantId: string): MenuCategory | undefined {
  const db = getDb();
  return db
    .select()
    .from(menuCategories)
    .where(and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, restaurantId)))
    .get();
}

// ─── Category Mutations ───────────────────────────────────────────────────────

export function createCategory(restaurantId: string, rawInput: CreateCategoryInput): MenuCategory {
  const db = getDb();
  const input = createCategorySchema.parse(rawInput);
  return db
    .insert(menuCategories)
    .values({
      id: nanoid(),
      restaurantId,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning()
    .get();
}

export function updateCategory(
  id: string,
  restaurantId: string,
  input: UpdateCategoryInput
): MenuCategory {
  const db = getDb();
  const existing = getCategoryById(id, restaurantId);
  if (!existing) throw new NotFoundError("Category");

  return db
    .update(menuCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, restaurantId)))
    .returning()
    .get();
}

export function deleteCategory(id: string, restaurantId: string): void {
  const db = getDb();
  const existing = getCategoryById(id, restaurantId);
  if (!existing) throw new NotFoundError("Category");

  // Soft-delete by deactivating
  db.update(menuCategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, restaurantId)))
    .run();
}

// ─── Menu Item Queries ────────────────────────────────────────────────────────

export function getMenuItemsByCategory(categoryId: string, restaurantId: string): MenuItem[] {
  const db = getDb();
  return db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.restaurantId, restaurantId)))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name))
    .all();
}

export function getMenuItemById(id: string, restaurantId: string): MenuItem | undefined {
  const db = getDb();
  return db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .get();
}

export function getFullMenu(restaurantId: string): Array<{
  category: MenuCategory;
  items: MenuItem[];
}> {
  const categories = getCategoriesByRestaurant(restaurantId).filter((c) => c.isActive);

  return categories.map((category) => ({
    category,
    items: getMenuItemsByCategory(category.id, restaurantId).filter((i) => i.isAvailable),
  }));
}

// ─── Menu Item Mutations ──────────────────────────────────────────────────────

export function createMenuItem(restaurantId: string, rawInput: CreateMenuItemInput): MenuItem {
  const db = getDb();
  const input = createMenuItemSchema.parse(rawInput);

  // Verify category belongs to this restaurant
  const category = getCategoryById(input.categoryId, restaurantId);
  if (!category) throw new NotFoundError("Category");

  return db
    .insert(menuItems)
    .values({
      id: nanoid(),
      restaurantId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      pricePaise: Math.round(input.priceRupees * 100),
      isVeg: input.isVeg,
      isVegan: input.isVegan,
      isGlutenFree: input.isGlutenFree,
      spiceLevel: input.spiceLevel ?? 0,
      isFeatured: input.isFeatured ?? false,
      isAvailable: input.isAvailable ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .get();
}

export function updateMenuItem(
  id: string,
  restaurantId: string,
  input: UpdateMenuItemInput
): MenuItem {
  const db = getDb();
  const existing = getMenuItemById(id, restaurantId);
  if (!existing) throw new NotFoundError("Menu item");

  const updateData: Partial<NewMenuItem> = {
    ...input,
    updatedAt: new Date(),
  };

  if (input.priceRupees !== undefined) {
    updateData.pricePaise = Math.round(input.priceRupees * 100);
    delete (updateData as { priceRupees?: number }).priceRupees;
  }

  return db
    .update(menuItems)
    .set(updateData)
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .returning()
    .get();
}

export function deleteMenuItem(id: string, restaurantId: string): void {
  const db = getDb();
  const existing = getMenuItemById(id, restaurantId);
  if (!existing) throw new NotFoundError("Menu item");

  db.update(menuItems)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, restaurantId)))
    .run();
}
