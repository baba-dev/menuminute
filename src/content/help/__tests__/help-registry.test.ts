import { describe, it, expect } from "vitest";
import {
  allArticles,
  ownerArticles,
  customerArticles,
  getArticleBySlug,
  getArticlesByAudience,
  getCategories,
  searchHelpArticles,
  searchFaqs,
} from "../index";

describe("Help Content Registry", () => {
  it("contains 16 comprehensive articles (10 owner, 6 customer)", () => {
    expect(allArticles.length).toBe(16);
    expect(ownerArticles.length).toBe(10);
    expect(customerArticles.length).toBe(6);
  });

  it("all articles have unique slugs and required fields", () => {
    const slugs = new Set<string>();
    for (const article of allArticles) {
      expect(slugs.has(article.slug)).toBe(false);
      slugs.add(article.slug);

      expect(article.title.length).toBeGreaterThan(5);
      expect(article.summary.length).toBeGreaterThan(20);
      expect(article.quickSteps.length).toBeGreaterThanOrEqual(3);
      expect(article.keywords.length).toBeGreaterThanOrEqual(3);
      expect(article.sections.length).toBeGreaterThanOrEqual(1);
      expect(article.readTimeMinutes).toBeGreaterThan(0);
      expect(article.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("all related article slugs refer to existing articles", () => {
    for (const article of allArticles) {
      for (const related of article.relatedArticleSlugs) {
        const found = getArticleBySlug(related);
        expect(found, `Related slug "${related}" in "${article.slug}" must exist`).toBeDefined();
      }
    }
  });

  it("getArticlesByAudience filters correctly", () => {
    const ownerOnly = getArticlesByAudience("owner");
    expect(ownerOnly.every((a) => a.audience === "owner" || a.audience === "both")).toBe(true);

    const customerOnly = getArticlesByAudience("customer");
    expect(customerOnly.every((a) => a.audience === "customer" || a.audience === "both")).toBe(
      true
    );
  });

  it("getCategories returns non-empty list of categories", () => {
    const ownerCats = getCategories("owner");
    expect(ownerCats.length).toBeGreaterThanOrEqual(3);
    expect(ownerCats).toContain("Menu Creation");
    expect(ownerCats).toContain("Table Setup");
  });

  it("searchHelpArticles returns relevant results for common queries", () => {
    const qrResults = searchHelpArticles("qr code");
    expect(qrResults.length).toBeGreaterThan(0);
    expect(qrResults.some((r) => r.article.slug.includes("qr"))).toBe(true);

    const kdsResults = searchHelpArticles("kitchen");
    expect(kdsResults.length).toBeGreaterThan(0);
    expect(kdsResults.some((r) => r.article.slug === "kitchen-display-system")).toBe(true);

    const veganResults = searchHelpArticles("vegan");
    expect(veganResults.length).toBeGreaterThan(0);
  });

  it("searchFaqs finds matching FAQ items", () => {
    const freeFaqs = searchFaqs("free");
    expect(freeFaqs.length).toBeGreaterThan(0);

    const tableFaqs = searchFaqs("table");
    expect(tableFaqs.length).toBeGreaterThan(0);
  });
});
