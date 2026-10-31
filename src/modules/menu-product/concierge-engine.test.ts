import { describe, expect, it } from "vitest";
import type { PublicProduct } from "./service";
import {
  candidatesForMenu,
  curatedMeals,
  estimateSubtotal,
  mealRole,
  minimumDishPrice,
  validMeal,
  verifyRecommendations,
} from "./concierge-engine";
import { conciergePreferencesSchema } from "./concierge-contracts";

const preferences = conciergePreferencesSchema.parse({
  mode: "feast",
  mood: "comfort",
  guests: 2,
  budgetMinor: 2000,
  diet: "vegetarian",
  spice: "any",
  avoid: "",
  craving: "",
  refinement: "",
});
function dish(id: string, name: string, priceMinor: number) {
  return {
    id,
    name,
    priceMinor,
    description: "",
    soldOut: false,
    archived: false,
    mediaId: null,
    variants: [],
    addOnGroups: [],
    dietary: ["vegetarian"],
    schedule: null,
  };
}
function product() {
  return {
    outlet: {
      id: "test-outlet",
      name: "Sample",
      currency: "INR",
      timezone: "Asia/Kolkata",
      outletType: "restaurant",
      fulfillmentModes: [],
      isDemoData: true,
      versioned: true,
    },
    point: null,
    catalogFingerprint: "test-fingerprint",
    now: "2026-11-01T08:00:00Z",
    menus: [
      {
        id: "menu1",
        revision: 1,
        brand: null,
        overrides: [],
        document: {
          name: "Sample menu",
          currency: "INR",
          schedule: null,
          categories: [
            {
              id: "cat-starter",
              name: "Starters",
              description: "",
              archived: false,
              items: [dish("paneer-tikka", "Paneer Tikka", 250)],
            },
            {
              id: "cat-main",
              name: "Main courses",
              description: "",
              archived: false,
              items: [dish("paneer-curry", "Paneer Curry", 400)],
            },
            {
              id: "cat-breads",
              name: "Breads",
              description: "",
              archived: false,
              items: [dish("butter-naan", "Butter Naan", 100)],
            },
          ],
        },
      },
    ],
  } as unknown as PublicProduct;
}
describe("dining concierge — authoritative menu constraints", () => {
  it("classifies courses without altering the published menu", () => {
    expect(mealRole("Breads", "Butter Naan")).toBe("side");
    expect(mealRole("Starters", "Paneer Tikka")).toBe("starter");
    expect(mealRole("Curries", "Paneer Curry")).toBe("main");
  });
  it("includes required extras in the minimum possible price", () => {
    expect(
      minimumDishPrice({
        priceMinor: 100,
        variants: [
          { priceMinor: 160, isAvailable: true },
          { priceMinor: 40, isAvailable: false },
        ],
        addOnGroups: [
          {
            min: 2,
            options: [
              { priceMinor: 40, isAvailable: true },
              { priceMinor: 80, isAvailable: true },
              { priceMinor: 1, isAvailable: false },
            ],
          },
        ],
      })
    ).toBe(280);
    expect(
      minimumDishPrice({
        priceMinor: 100,
        variants: [],
        addOnGroups: [{ min: 1, options: [{ priceMinor: 0, isAvailable: false }] }],
      })
    ).toBeNull();
  });
  it("respects published availability and price overrides", () => {
    const data = product();
    data.menus[0]!.overrides = [
      { dishId: "paneer-curry", priceMinor: 600, soldOut: false },
      { dishId: "paneer-tikka", priceMinor: null, soldOut: true },
    ];
    const candidates = candidatesForMenu(data, preferences);
    expect(candidates.map((d) => d.dishId)).not.toContain("paneer-tikka");
    expect(candidates.find((d) => d.dishId === "paneer-curry")?.priceMinor).toBe(600);
  });
  it("never treats unknown ingredients as verified allergy safety", () => {
    expect(candidatesForMenu(product(), { ...preferences, diet: "nut_free" })).toHaveLength(0);
    expect(candidatesForMenu(product(), { ...preferences, avoid: "peanut" })).toHaveLength(0);
  });
  it("rejects suggestions outside candidates or exceeding the actual budget", () => {
    const candidates = candidatesForMenu(product(), preferences);
    expect(estimateSubtotal([{ dishId: "paneer-curry", quantity: 2 }], candidates)).toBe(800);
    expect(
      validMeal([{ dishId: "paneer-curry", quantity: 2 }], candidates, {
        ...preferences,
        budgetMinor: 700,
      })
    ).toBe(false);
    expect(
      verifyRecommendations(
        [
          {
            title: "Invented meal",
            introduction: "",
            items: [{ dishId: "not-on-menu", quantity: 1 }],
          },
        ],
        candidates,
        preferences
      )
    ).toHaveLength(0);
  });
  it("produces real courses with checked minor-unit subtotals", () => {
    const candidates = candidatesForMenu(product(), preferences);
    const meals = curatedMeals(candidates, preferences);
    expect(meals.length).toBeGreaterThan(0);
    expect(meals.every((meal) => validMeal(meal.items, candidates, preferences))).toBe(true);
    expect(meals[0]!.items.some((item) => item.dishId === "paneer-curry")).toBe(true);
  });
});
