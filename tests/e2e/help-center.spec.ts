import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ownerSlugs = [
  "getting-started", "menu-studio", "ai-menu-import", "qr-codes-and-tables",
  "kitchen-display-system", "live-orders-and-service", "table-floor-matrix",
  "pos-and-payments", "reports-and-analytics", "ember-assistant-and-settings",
];
const customerSlugs = [
  "how-to-scan-qr", "browsing-and-searching", "customizing-dishes",
  "placing-orders", "order-tracking-and-service", "offline-menu-and-pwa",
];

test("all public help pages, their sitemap and robots.txt respond successfully", async ({ request }) => {
  const paths = [
    "/help", "/help/owner", "/help/customer", "/help/faq",
    ...ownerSlugs.map((slug) => "/help/owner/" + slug),
    ...customerSlugs.map((slug) => "/help/customer/" + slug),
    "/sitemap.xml", "/robots.txt",
  ];
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    if (path.endsWith(".xml")) {
      const text = await response.text();
      expect(text).toContain("/help/owner/menu-studio");
      expect(text).toContain("/help/customer/how-to-scan-qr");
    }
  }
});

test("help search finds useful guides for natural questions", async ({ page }) => {
  await page.goto("/help");
  const search = page.getByRole("searchbox", { name: "Search help guides" });
  await expect(search).toBeVisible();
  await search.fill("How do I print a table QR code?");
  const matches = page.getByRole("region", { name: "Matching help guides" });
  await expect(matches.getByRole("link", { name: /QR Studio/ }).first()).toBeVisible();
  await search.press("Escape");
  await expect(matches).toHaveCount(0);
});

test("article navigation works on phones and is not wider than the viewport", async ({ page, isMobile }) => {
  await page.goto("/help/owner/qr-codes-and-tables");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(1);
  if (isMobile) {
    const sections = page.getByText("Jump to a section");
    await sections.click();
    await expect(page.getByRole("navigation", { name: "Article sections" }).getByRole("link").first()).toBeVisible();
  }
});

test("help article has no serious accessibility violations", async ({ page }) => {
  await page.goto("/help/owner/getting-started");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});
