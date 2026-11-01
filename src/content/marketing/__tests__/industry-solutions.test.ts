import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { industrySolutions, industrySolutionBySlug } from "@/content/marketing/solutions";
import { marketingMetadata } from "@/lib/marketing/seo";

const existsPublicAsset = (path: string) =>
  path.startsWith("/") && existsSync(join(process.cwd(), "public", path.slice(1)));

describe("industry solutions", () => {
  it("covers four unique search targets with genuinely distinct examples", () => {
    expect(industrySolutions.map((solution) => solution.slug)).toEqual([
      "restaurants",
      "cafes",
      "bakeries",
      "cloud-kitchens",
    ]);
    expect(new Set(industrySolutions.map((solution) => solution.seoTitle)).size).toBe(4);
    expect(new Set(industrySolutions.map((solution) => solution.headline)).size).toBe(4);
    expect(new Set(industrySolutions.map((solution) => solution.cover)).size).toBe(4);
    expect(new Set(industrySolutions.map((solution) => solution.scenario.title)).size).toBe(4);
    expect(industrySolutionBySlug("unknown")).toBeUndefined();
    for (const solution of industrySolutions) {
      expect(industrySolutionBySlug(solution.slug)).toBe(solution);
      expect(solution.seoDescription.length).toBeGreaterThan(95);
      expect(solution.intro.length).toBeGreaterThan(90);
      expect(solution.scenario.intro).toMatch(/illustrative example/i);
      expect(solution.scenario.stages).toHaveLength(3);
      expect(solution.needs).toHaveLength(3);
      expect(solution.steps).toHaveLength(3);
      expect(solution.facts).toHaveLength(3);
      expect(solution.faqs).toHaveLength(3);
      expect(solution.premiumNote).toMatch(
        /(separately|not automatic|does not|activation|require)/i
      );
      for (const feature of solution.needs) expect(feature.featurePath).toMatch(/^\//);
      for (const faq of solution.faqs) {
        expect(faq.question.length).toBeGreaterThan(15);
        expect(faq.answer.length).toBeGreaterThan(50);
      }
    }
  });

  it("uses committed artwork and two verified app captures for each industry", () => {
    for (const solution of industrySolutions) {
      const assets = [
        solution.cover,
        ...["desktop-light", "desktop-dark", "mobile-light", "mobile-dark"].map(
          (variant) => solution.artBase + "/hero-" + variant + ".webp"
        ),
        ...[solution.primaryShot, solution.secondaryShot].flatMap((shot) =>
          ["light", "dark"].map((theme) => "/docs-media/" + shot + "-desktop-" + theme + ".webp")
        ),
      ];
      for (const asset of assets) {
        expect(existsPublicAsset(asset), asset).toBe(true);
      }
      expect(solution.primaryShot).not.toBe(solution.secondaryShot);
    }
  });

  it("has canonical URLs and single sitemap entries without duplicates", () => {
    const urls = sitemap().map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const path of [
      "/solutions",
      ...industrySolutions.map((solution) => "/solutions/" + solution.slug),
    ]) {
      const url = "https://food.bababuilds.com" + path;
      expect(urls.filter((entry) => entry === url)).toHaveLength(1);
    }
    for (const solution of industrySolutions) {
      const metadata = marketingMetadata({
        pathname: "/solutions/" + solution.slug,
        title: solution.seoTitle,
        description: solution.seoDescription,
        image: solution.cover,
        imageAlt: solution.coverAlt,
      });
      expect(metadata.alternates).toEqual({ canonical: "/solutions/" + solution.slug });
      expect(metadata.openGraph).toMatchObject({
        url: "/solutions/" + solution.slug,
        images: [{ url: solution.cover, alt: solution.coverAlt }],
      });
    }
  });

  it("does not advertise premium ordering or kitchen as automatically active", () => {
    const copy = industrySolutions
      .map((solution) =>
        [
          solution.intro,
          solution.premiumNote,
          ...solution.needs.map((feature) => feature.detail),
          ...solution.scenario.stages.map((stage) => stage.detail),
        ].join(" ")
      )
      .join(" ");
    expect(copy).toMatch(/approved|activation|activated|eligible|separate/i);
    expect(industrySolutionBySlug("cloud-kitchens")?.premiumNote).toMatch(
      /not an automatic integration/i
    );
    expect(industrySolutionBySlug("restaurants")?.premiumNote).toMatch(
      /do not automatically include/i
    );
  });
});
