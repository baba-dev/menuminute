import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../src/db";
import { restaurants } from "../src/db/schema";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesByRestaurant,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemById,
  getFullMenu,
} from "../src/modules/menus/service";
import { nanoid } from "nanoid";

describe("Menu CRUD Operations", () => {
  const restaurantId = `crud-rest-${nanoid(6)}`;

  beforeAll(() => {
    const db = getDb();
    db.insert(restaurants)
      .values({
        id: restaurantId,
        publicId: `pub-crud-${nanoid(6)}`,
        name: "CRUD Test Bistro",
        slug: `crud-test-bistro-${nanoid(4)}`,
        currency: "INR",
      })
      .run();
  });

  it("should create, read, update, and soft-delete a category", () => {
    // 1. Create
    const category = createCategory(restaurantId, {
      name: "Desserts & Sweets",
      description: "Post-meal indulgences",
      sortOrder: 3,
    });
    expect(category.id).toBeDefined();
    expect(category.name).toBe("Desserts & Sweets");

    // 2. Read
    const list = getCategoriesByRestaurant(restaurantId);
    expect(list.some((c) => c.id === category.id)).toBe(true);

    // 3. Update
    const updated = updateCategory(category.id, restaurantId, {
      name: "Artisan Desserts",
    });
    expect(updated.name).toBe("Artisan Desserts");

    // 4. Soft-delete
    deleteCategory(category.id, restaurantId);
    const afterDelete = getCategoriesByRestaurant(restaurantId).find((c) => c.id === category.id);
    expect(afterDelete?.isActive).toBe(false);
  });

  it("should create item, convert rupees to paise, update price, and soft-delete", () => {
    const cat = createCategory(restaurantId, { name: "Main Course", sortOrder: 1 });

    // 1. Create dish with ₹249.50
    const item = createMenuItem(restaurantId, {
      categoryId: cat.id,
      name: "Paneer Lababdar",
      description: "Cottage cheese cubes in rich onion-tomato gravy",
      priceRupees: 249.5,
      isVeg: true,
      spiceLevel: 1,
      isFeatured: true,
    });

    expect(item.id).toBeDefined();
    // 249.50 * 100 = 24950 paise
    expect(item.pricePaise).toBe(24950);
    expect(item.isAvailable).toBe(true);

    // 2. Update price to ₹279
    const updated = updateMenuItem(item.id, restaurantId, {
      priceRupees: 279,
      spiceLevel: 2,
    });
    expect(updated.pricePaise).toBe(27900);
    expect(updated.spiceLevel).toBe(2);

    // 3. Soft-delete (mark unavailable)
    deleteMenuItem(item.id, restaurantId);
    const itemAfter = getMenuItemById(item.id, restaurantId);
    expect(itemAfter?.isAvailable).toBe(false);
  });

  it("should construct full structured menu hierarchy", () => {
    const fullMenu = getFullMenu(restaurantId);
    expect(Array.isArray(fullMenu)).toBe(true);
  });
});
