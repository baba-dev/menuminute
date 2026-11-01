import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { marketingMetadata } from "@/lib/marketing/seo";
import { marketingFeatures, marketingFeatureBySlug } from "@/content/marketing/features";
import { GUIDES } from "@/content/docs/guides";

describe("marketing feature coverage", () => {
  it("defines six unique searchable destinations with honest availability", () => {
    expect(marketingFeatures).toHaveLength(6);
    expect(new Set(marketingFeatures.map((feature) => feature.path)).size).toBe(6);
    expect(new Set(marketingFeatures.map((feature) => feature.slug)).size).toBe(6);
    for (const feature of marketingFeatures) {
      expect(feature.seoDescription.length).toBeGreaterThan(50);
      expect(feature.benefits.length).toBeGreaterThanOrEqual(3);
      expect(feature.steps.length).toBeGreaterThanOrEqual(3);
      expect(feature.faqs.length).toBeGreaterThanOrEqual(3);
      expect(feature.availabilityText.length).toBeGreaterThan(30);
      expect(feature.ctaHref).toMatch(/^\//);
      expect(feature.secondaryHref).toMatch(/^\//);
      expect(GUIDES.some((guide) => "/docs/" + guide.slug === feature.guideHref)).toBe(true);
      expect(marketingFeatureBySlug(feature.slug)).toBe(feature);
    }
  });
  it("never claims gated functionality is available automatically", () => {
    for (const feature of marketingFeatures.filter((item) => item.availability !== "free")) {
      expect(feature.availabilityText).toMatch(/approval|approved|activation|provider/i);
      expect(feature.ctaHref).toBe("/contact");
    }
  });
  it("includes every indexable marketing and documentation page exactly once", () => {
    const urls = sitemap().map((entry) => entry.url);
    const expected = ["/", "/about", "/contact", "/docs", "/features", "/free-qr-menu", "/ordering", "/pricing", "/demo", ...marketingFeatures.map((feature) => feature.path), ...GUIDES.map((guide) => "/docs/" + guide.slug)];
    for (const path of expected) {
      const url = "https://food.bababuilds.com" + (path === "/" ? "" : path);
      expect(urls.filter((value) => value === url)).toHaveLength(1);
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((url) => url.includes("/home-v2"))).toBe(false);
  });
  it("sets a canonical and OG path for marketing pages", () => {
    const metadata = marketingMetadata({ pathname: "/features/restaurant-pos", title: "Restaurant POS", description: "Restaurant POS overview" });
    expect(metadata.alternates).toEqual({ canonical: "/features/restaurant-pos" });
    expect(metadata.openGraph).toMatchObject({ url: "/features/restaurant-pos" });
  });
});
