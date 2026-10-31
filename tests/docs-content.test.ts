import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { GROUP_ORDER, GUIDES, guideBySlug } from "../src/content/docs/guides";

const mediaDir = "public/docs-media";
const manifest = JSON.parse(readFileSync(`${mediaDir}/manifest.json`, "utf8")) as {
  shots: Record<string, unknown>;
};

describe("documentation content", () => {
  it("has unique slugs, known groups and non-empty sections", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(GROUP_ORDER, g.slug).toContain(g.group);
      expect(g.slug).toMatch(/^[a-z0-9-]+$/);
      expect(g.whatItDoes.length, g.slug).toBeGreaterThan(0);
      expect(g.steps.length, g.slug).toBeGreaterThan(0);
      expect(g.summary.length, g.slug).toBeGreaterThan(20);
    }
  });
  it("only links to guides that exist", () => {
    for (const g of GUIDES)
      for (const r of g.related) expect(guideBySlug(r), `${g.slug}->${r}`).toBeTruthy();
  });
  it("references screenshots that exist in every captured variant", () => {
    for (const g of GUIDES) {
      for (const id of g.moreShots ?? [])
        expect(manifest.shots[`${id}-desktop-light.webp`], `${g.slug} extra ${id}`).toBeTruthy();
      if (!g.shot) {
        expect(g.inDemo, `${g.slug} has no screenshot so it should not be live in the demo`).toBe(
          false
        );
        continue;
      }
      for (const variant of ["desktop-light", "desktop-dark", "mobile-light"]) {
        const file = `${g.shot}-${variant}.webp`;
        expect(manifest.shots[file], file).toBeTruthy();
        expect(existsSync(`${mediaDir}/${file}`), file).toBe(true);
      }
    }
  });
  it("never claims verified allergen or medical facts and flags demo limits", () => {
    const text = JSON.stringify(GUIDES).toLowerCase();
    expect(text).not.toMatch(/guaranteed|100% safe|allergen[- ]free/);
    expect(guideBySlug("point-of-sale")?.inDemo).toBe(false);
    expect(guideBySlug("menu-import")?.inDemo).toBe(false);
  });
});
