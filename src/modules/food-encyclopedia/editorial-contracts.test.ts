import { describe, expect, it } from "vitest";
import { FoodDraftSchema, editorialQualityIssues, transitionAllowed } from "./editorial-contracts";
import { getFoodEntry } from "./pilot";

describe("Food Encyclopedia editorial gates", () => {
  const fixture = getFoodEntry("dishes", "paneer-tikka")!;
  const draft = {
    kind: fixture.kind, slug: fixture.slug, title: fixture.title,
    eyebrow: fixture.eyebrow, description: fixture.description, tint: fixture.tint,
    imagePath: fixture.imagePath, imageAlt: fixture.imageAlt, aliases: fixture.aliases,
    facts: fixture.facts, sections: fixture.sections, sourceUrls: fixture.sourceUrls,
    relatedSlugs: fixture.relatedSlugs, caution: fixture.caution,
  };
  it("accepts a bounded draft, not a published record or executable markup", () => {
    expect(FoodDraftSchema.parse(draft).slug).toBe("paneer-tikka");
    expect(FoodDraftSchema.safeParse({ ...draft, status: "published" }).success).toBe(false);
    expect(FoodDraftSchema.safeParse({ ...draft, slug: "../admin" }).success).toBe(false);
    expect(FoodDraftSchema.safeParse({ ...draft, sourceUrls: ["http://example.com"] }).success).toBe(false);
  });
  it("never qualifies a content fixture as human-reviewed by default", () => {
    expect(editorialQualityIssues(FoodDraftSchema.parse(draft)).length).toBeGreaterThan(0);
  });
  it("rejects bypasses of submit/approve/publish transition order", () => {
    expect(transitionAllowed("draft", "approve")).toBe(false);
    expect(transitionAllowed("draft", "publish")).toBe(false);
    expect(transitionAllowed("in_review", "publish")).toBe(false);
    expect(transitionAllowed("approved", "publish")).toBe(true);
    expect(transitionAllowed("published", "save")).toBe(true); // published revision remains immutable
  });
});
