import { describe, expect, it } from "vitest";
import { FOOD_ADS_OPERATIONALLY_ENABLED, mayRequestFoodAd } from "./ads";
import { allFoodPreviews } from "./pilot";

describe("Food Encyclopedia advertising fail-closed policy", () => {
  it("never serves AdSense or placeholder ads on public preview pages", () => {
    expect(FOOD_ADS_OPERATIONALLY_ENABLED).toBe(false);
    expect(mayRequestFoodAd("article", allFoodPreviews()[0])).toBe(false);
    expect(mayRequestFoodAd("browse")).toBe(false);
    expect(mayRequestFoodAd("home")).toBe(false);
  });
  it("always excludes search and merchant transactions", () => {
    expect(mayRequestFoodAd("search")).toBe(false);
    expect(mayRequestFoodAd("merchant")).toBe(false);
  });
});
