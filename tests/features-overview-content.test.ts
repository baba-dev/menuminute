import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { GUIDES } from "../src/content/docs/guides";
import { featureFaqs, featureSpotlights } from "../src/content/marketing/features-overview";

const mediaDir = "public/docs-media";
const manifest = JSON.parse(readFileSync(`${mediaDir}/manifest.json`, "utf8")) as {
  shots: Record<string, { id: string; width: number; height: number }>;
};
const guidePaths = new Set(GUIDES.map((guide) => `/docs/${guide.slug}`));

describe("features overview marketing content", () => {
  it("uses unique, valid section anchors and useful marketing descriptions", () => {
    expect(featureSpotlights.length).toBeGreaterThanOrEqual(8);
    expect(new Set(featureSpotlights.map((feature) => feature.id)).size).toBe(
      featureSpotlights.length
    );
    for (const feature of featureSpotlights) {
      expect(feature.id).toMatch(/^[a-z0-9-]+$/);
      expect(feature.title.length, feature.id).toBeGreaterThan(24);
      expect(feature.paragraphs).toHaveLength(2);
      expect(feature.points.length, feature.id).toBeGreaterThanOrEqual(3);
      expect(feature.alt.length, feature.id).toBeGreaterThan(30);
      expect(feature.availabilityNote.length, feature.id).toBeGreaterThan(20);
    }
  });

  it("uses only actual light and dark application screenshots", () => {
    for (const feature of featureSpotlights) {
      for (const variant of ["desktop-light", "desktop-dark"]) {
        const name = `${feature.shot}-${variant}.webp`;
        expect(manifest.shots[name], name).toBeTruthy();
        expect(manifest.shots[name]?.id, name).toBe(feature.shot);
        expect(manifest.shots[name]?.width, name).toBe(1200);
        expect(existsSync(`${mediaDir}/${name}`), name).toBe(true);
      }
    }
  });

  it("links to existing public documentation walkthroughs", () => {
    for (const feature of featureSpotlights) {
      expect(guidePaths.has(feature.guideHref), feature.guideHref).toBe(true);
      expect(feature.guideLabel.length).toBeGreaterThan(10);
    }
  });

  it("answers common questions without implying automatic payment capture or AI publishing", () => {
    expect(featureFaqs.length).toBeGreaterThanOrEqual(6);
    expect(new Set(featureFaqs.map((faq) => faq.question)).size).toBe(featureFaqs.length);
    const combined = featureFaqs.map((faq) => faq.answer).join(" ").toLowerCase();
    expect(combined).toContain("not by default");
    expect(combined).toContain("not acceptance");
    expect(combined).toContain("merchant");
  });
});
