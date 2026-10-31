import { describe, expect, it } from "vitest";
import demoMenu from "../src/data/demo/demo-menu.json";
import catalogue from "../src/data/dish-catalogue.json";
import approvedArt from "../src/data/approved-dish-artwork.json";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import { artworkById } from "../src/modules/menu-product/dish-artwork";

const doc = menuDocumentSchema.parse(demoMenu);
const dishes = doc.categories.flatMap((c) => c.items);

describe("public demo menu dataset", () => {
  it("contains every catalogue dish exactly once and fits the document budget", () => {
    expect(dishes.map((d) => d.id).sort()).toEqual(catalogue.map((d) => d.id).sort());
    expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(500 * 1024);
  });
  it("leaves no dish field empty", () => {
    for (const d of dishes) {
      expect(d.description.length, d.name).toBeGreaterThan(20);
      expect(d.priceMinor, d.name).toBeGreaterThan(0);
      expect(d.nutrition?.calories, d.name).toBeGreaterThan(0);
      expect(d.nutrition?.servingSize, d.name).toBeTruthy();
      expect(d.culinary?.flavorNotes.length, d.name).toBeGreaterThanOrEqual(3);
      expect(d.culinary?.chefNote, d.name).toBeTruthy();
      expect(d.culinary?.servingTemp, d.name).toBeTruthy();
      expect(d.culinary?.pairingDishIds.length, d.name).toBeGreaterThanOrEqual(1);
      expect(d.safety?.ingredients.length, d.name).toBeGreaterThanOrEqual(4);
      expect(d.safety?.crossContact, d.name).toBeTruthy();
      expect(d.addOnGroups.length, d.name).toBeGreaterThanOrEqual(0);
    }
  });
  it("resolves pairings and artwork identities", () => {
    const ids = new Set(dishes.map((d) => d.id));
    for (const d of dishes) {
      for (const p of d.culinary?.pairingDishIds ?? [])
        expect(ids.has(p), `${d.name}->${p}`).toBe(true);
      if (d.artworkId) expect(artworkById(d.artworkId), d.name).not.toBeNull();
    }
    expect(doc.presentation?.featuredDishIds.every((id) => ids.has(id))).toBe(true);
  });
  it("never makes verified, free-from, or vegan/vegetarian claims that contradict allergens or proteins", () => {
    for (const d of dishes) {
      expect(d.safety?.verified, d.name).toBe(false);
      expect(d.nutrition?.verified, d.name).toBe(false);
      expect(d.safety?.verifiedFreeFrom, d.name).toBeUndefined();
      if (d.dietary.includes("vegan")) {
        expect(d.safety?.allergens, d.name).not.toContain("dairy");
        expect(d.safety?.allergens, d.name).not.toContain("eggs");
      }
      if (d.dietary.includes("gluten_free"))
        expect(d.safety?.allergens, d.name).not.toContain("gluten");
      if (d.dietary.includes("vegetarian"))
        expect(d.safety?.ingredients.join(" "), d.name).not.toMatch(
          /chicken|mutton|beef|pork|duck|fish|prawn|\beggs?\b/i
        );
    }
  });
  it("shows the generic placeholder only for dishes that lack an illustration", () => {
    for (const d of dishes) expect(d.imageMode, d.name).toBe(d.artworkId ? "artwork" : "none");
  });
  it("ships all 224 illustrations as approved runtime artwork", () => {
    expect(approvedArt).toHaveLength(224);
    expect(approvedArt.every((a) => a.state === "approved")).toBe(true);
    const used = new Set(dishes.map((d) => d.artworkId).filter(Boolean));
    expect(used.size).toBeGreaterThan(150);
  });
});
