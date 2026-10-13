import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from "../src/modules/menus/service";

describe("Menu Item & Category Validation (Zod)", () => {
  describe("createCategorySchema", () => {
    it("should accept valid category input", () => {
      const valid = {
        name: "Appetizers",
        description: "Small plates and finger food",
        sortOrder: 1,
      };
      const result = createCategorySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject empty category name", () => {
      const invalid = {
        name: "",
        description: "Invalid empty name",
      };
      const result = createCategorySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("createMenuItemSchema", () => {
    it("should validate and accept dish input with price in Rupees", () => {
      const valid = {
        categoryId: "cat-123",
        name: "Butter Chicken",
        description: "Creamy tomato curry with tender chicken",
        priceRupees: 349,
        isVeg: false,
        spiceLevel: 2,
        isFeatured: true,
      };
      const result = createMenuItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceRupees).toBe(349);
      }
    });

    it("should reject negative prices", () => {
      const invalid = {
        categoryId: "cat-123",
        name: "Discounted Dish",
        priceRupees: -50,
      };
      const result = createMenuItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should enforce spiceLevel bounds (0 to 3)", () => {
      const invalidSpice = {
        categoryId: "cat-123",
        name: "Ultra Spicy Dish",
        priceRupees: 199,
        spiceLevel: 5, // Max is 3
      };
      const result = createMenuItemSchema.safeParse(invalidSpice);
      expect(result.success).toBe(false);
    });

    it("should reject excessively long names", () => {
      const invalidName = {
        categoryId: "cat-123",
        name: "A".repeat(250), // Max is 200
        priceRupees: 199,
      };
      const result = createMenuItemSchema.safeParse(invalidName);
      expect(result.success).toBe(false);
    });
  });
});
