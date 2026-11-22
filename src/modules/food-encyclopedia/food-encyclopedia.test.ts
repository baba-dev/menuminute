import { describe, it, expect } from "vitest";
import { cleanFoodQuery, foodPath, isEditoriallyIndexable, FoodEntrySchema } from "./contracts";
import { allFoodPreviews, getFoodEntry, getRelatedFood } from "./pilot";
import { browseFood, searchFood } from "./search";

describe("Food Encyclopedia editorial safety", () => {
  it("never treats preview entries or generic catalogue entries as indexable", () => {
    expect(allFoodPreviews().length).toBeGreaterThan(0);
    for (const entry of allFoodPreviews()) {
      expect(FoodEntrySchema.parse(entry)).toEqual(entry);
      expect(entry.status).toBe("preview");
      expect(isEditoriallyIndexable(entry)).toBe(false);
    }
  });

  it("requires a named review, sources and publication timestamps", () => {
    const draft = allFoodPreviews()[0]!;
    expect(isEditoriallyIndexable({ ...draft, status: "published" })).toBe(false);
    expect(
      isEditoriallyIndexable({
        ...draft,
        status: "published",
        reviewedBy: "Editorial Review",
        reviewedAt: "2026-11-22T00:00:00.000Z",
        publishedAt: "2026-11-22T01:00:00.000Z",
        sourceUrls: ["https://example.org/reference"],
      })
    ).toBe(true);
  });

  it("normalizes and bounds untrusted search input", () => {
    expect(cleanFoodQuery("  paneer   tikka  ")).toBe("paneer tikka");
    expect(cleanFoodQuery("x".repeat(300)).length).toBe(100);
    expect(cleanFoodQuery(["paneer", "tikka"])).toBe("");
    expect(searchFood("<script>alert(1)</script>")).toEqual([]);
    expect(searchFood(undefined)).toEqual([]);
  });

  it("locates names and Hindi aliases deterministically", () => {
    expect(searchFood("paneer tikka")[0]?.entry.slug).toBe("paneer-tikka");
    expect(searchFood("पनीर टिक्का")[0]?.entry.slug).toBe("paneer-tikka");
    expect(searchFood("biryani")[0]?.entry.slug).toBe("biryani");
    expect(searchFood("biryani", "ingredients")).toEqual([]);
  });

  it("limits results and never leaks unrelated merchant records", () => {
    expect(searchFood("a", undefined, 1000).length).toBeLessThanOrEqual(24);
    expect(browseFood().length).toBe(allFoodPreviews().length);
    expect(browseFood("ingredients").every((entry) => entry.kind === "ingredients")).toBe(true);
  });

  it("builds scoped canonical paths and finds only known relations", () => {
    const entry = getFoodEntry("dishes", "paneer-tikka");
    expect(entry).toBeDefined();
    expect(foodPath(entry!)).toBe("/explore/dishes/paneer-tikka");
    expect(getFoodEntry("dishes", "unknown")).toBeUndefined();
    expect(getRelatedFood(entry!, 100).length).toBeLessThanOrEqual(8);
  });
});
