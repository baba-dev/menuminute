import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// P2: the catalogue is not indexable until independently reviewed PostgreSQL
// revisions are published. The previous P1 sample articles stay available only
// in local development; production must not leak an unapproved demo article.
test("Atlas homepage and browse fail closed without reviewed content", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /Every dish.*has a story/i })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("searchbox", { name: "Search food guides" })).toBeVisible();
  await page.getByRole("link", { name: /Dishes The foods we love/i }).click();
  await expect(page).toHaveURL(/\/explore\/browse\?kind=dishes/);
  await expect(page.getByText(/first reviewed guides are being prepared/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Paneer Tikka/i })).toHaveCount(0);
});

test("Search indexes only published articles and never shows AdSense", async ({
  page,
  request,
}) => {
  await page.goto("/explore");
  const search = page.getByRole("searchbox", { name: "Search food guides" });
  await search.fill("paneer tikka");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/explore\/search\?q=paneer/);
  await expect(page.getByRole("heading", { name: /What are you curious about/i })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(/No reviewed guide matched your search/i)).toBeVisible();
  await expect(page.locator(".atlas-ad-reservation")).toHaveCount(0);
  expect((await request.get("/explore/dishes/paneer-tikka")).status()).toBe(404);
  expect((await request.get("/explore/dishes/missing-entry")).status()).toBe(404);
});

test("Atlas mobile navigation remains within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator(".atlas-mobile-nav summary").click();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile encyclopedia" })
      .getByRole("link", { name: /Ingredients/ })
  ).toBeVisible();
});

test("Atlas public homepage has no serious WCAG A/AA violations", async ({ page }) => {
  await page.goto("/explore");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
  ).toEqual([]);
});

test("No draft or sample page is emitted in the public sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).not.toContain("/explore/dishes/paneer-tikka");
  expect(xml).not.toContain("/explore/search");
});

test("Editorial admin requires authenticated privileged session", async ({ request }) => {
  const response = await request.get("/admin/encyclopedia", { maxRedirects: 0 });
  expect([302, 303, 307, 308, 404]).toContain(response.status());
});
