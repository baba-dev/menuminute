import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../src/db";
import { restaurants, menuCategories, menuItems } from "../src/db/schema";
import {
  getCategoriesByRestaurant,
  getMenuItemsByCategory,
  createCategory,
  createMenuItem,
} from "../src/modules/menus/service";
import { nanoid } from "nanoid";

describe("Restaurant Tenant Isolation", () => {
  const restAId = `test-rest-A-${nanoid(6)}`;
  const restBId = `test-rest-B-${nanoid(6)}`;

  beforeAll(() => {
    const db = getDb();

    // Create Restaurant A
    db.insert(restaurants)
      .values({
        id: restAId,
        publicId: `pub-a-${nanoid(6)}`,
        name: "Restaurant Alpha",
        slug: `restaurant-alpha-${nanoid(4)}`,
        currency: "INR",
      })
      .run();

    // Create Restaurant B
    db.insert(restaurants)
      .values({
        id: restBId,
        publicId: `pub-b-${nanoid(6)}`,
        name: "Restaurant Beta",
        slug: `restaurant-beta-${nanoid(4)}`,
        currency: "INR",
      })
      .run();
  });

  it("should never leak categories between tenants", () => {
    // Add category to Restaurant A
    const catA = createCategory(restAId, {
      name: "Alpha Starters",
      description: "Exclusive to Alpha",
      sortOrder: 1,
    });

    // Add category to Restaurant B
    const catB = createCategory(restBId, {
      name: "Beta Mains",
      description: "Exclusive to Beta",
      sortOrder: 1,
    });

    const alphaCategories = getCategoriesByRestaurant(restAId);
    const betaCategories = getCategoriesByRestaurant(restBId);

    const alphaCatIds = alphaCategories.map((c) => c.id);
    const betaCatIds = betaCategories.map((c) => c.id);

    expect(alphaCatIds).toContain(catA.id);
    expect(alphaCatIds).not.toContain(catB.id);

    expect(betaCatIds).toContain(catB.id);
    expect(betaCatIds).not.toContain(catA.id);
  });

  it("should never leak menu items between tenants", () => {
    const catA = createCategory(restAId, { name: "Drinks Alpha", sortOrder: 1 });
    const catB = createCategory(restBId, { name: "Drinks Beta", sortOrder: 1 });

    const itemA = createMenuItem(restAId, {
      categoryId: catA.id,
      name: "Secret Alpha Cocktail",
      priceRupees: 450,
    });

    const itemB = createMenuItem(restBId, {
      categoryId: catB.id,
      name: "Secret Beta Brew",
      priceRupees: 250,
    });

    const alphaItems = getMenuItemsByCategory(catA.id, restAId);
    const betaItems = getMenuItemsByCategory(catB.id, restBId);

    expect(alphaItems.map((i) => i.id)).toContain(itemA.id);
    expect(alphaItems.map((i) => i.id)).not.toContain(itemB.id);

    expect(betaItems.map((i) => i.id)).toContain(itemB.id);
    expect(betaItems.map((i) => i.id)).not.toContain(itemA.id);
  });
});
