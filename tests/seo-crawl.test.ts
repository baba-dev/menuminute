import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("crawl policy", () => {
  it("points crawlers at the sitemap and blocks private and tokenised routes", () => {
    const r = robots();
    expect(r.sitemap).toBe("https://food.bababuilds.com/sitemap.xml");
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    const disallow = rule.disallow as string[];
    for (const p of ["/api/", "/dashboard/", "/admin/", "/m/*/orders/", "/login"]) {
      expect(disallow).toContain(p);
    }
  });

  it("lists only absolute, unique, indexable public URLs", () => {
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u.startsWith("https://food.bababuilds.com")).toBe(true);
      const path = new URL(u).pathname;
      expect(path).not.toMatch(/^\/(api|admin|dashboard|kitchen|login|register|account)(\/|$)/);
      expect(path).not.toMatch(/^\/m\/[^/]+\/orders(\/|$)/);
    }
    expect(urls).toContain("https://food.bababuilds.com/free-qr-menu");
    expect(urls).toContain("https://food.bababuilds.com/pricing");
  });
});
