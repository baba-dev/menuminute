import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

vi.mock("@/db", () => ({
  getPool: () => ({
    query: async () => ({
      rows: [
        { token: "menu-a", updated_at: new Date("2026-11-01T00:00:00Z"), is_demo: false },
        { token: "demo-menu", updated_at: new Date("2026-11-01T00:00:00Z"), is_demo: true },
      ],
    }),
  }),
}));

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

  it("lists only absolute, unique, indexable public URLs", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(new URL(u).origin).toBe("https://food.bababuilds.com");
      const path = new URL(u).pathname;
      expect(path).not.toMatch(/^\/(api|admin|dashboard|kitchen|login|register|account)(\/|$)/);
      expect(path).not.toMatch(/^\/m\/[^/]+\/orders(\/|$)/);
    }
    expect(urls).toContain("https://food.bababuilds.com/free-qr-menu");
    expect(urls).toContain("https://food.bababuilds.com/pricing");
    // Every published store menu is listed; the demo menu follows its kill switch (off in tests).
    expect(urls).toContain("https://food.bababuilds.com/m/menu-a");
    expect(urls).not.toContain("https://food.bababuilds.com/m/demo-menu");
  });
});
