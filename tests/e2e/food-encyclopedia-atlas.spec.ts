import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Atlas landing and browse render real routes without search-indexing previews", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /Every dish.*has a story/i })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("searchbox", { name: "Search food guides" })).toBeVisible();
  await page.getByRole("link", { name: /Dishes The foods we love/i }).click();
  await expect(page).toHaveURL(/\/explore\/browse\?kind=dishes/);
  await expect(page.getByRole("link", { name: /Paneer Tikka/i }).first()).toBeVisible();
});

test("Atlas search and editorial article work without ads or external AI calls", async ({ page, request }) => {
  await page.goto("/explore");
  const search = page.getByRole("searchbox", { name: "Search food guides" });
  await search.fill("paneer tikka");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/explore\/search\?q=paneer/);
  await expect(page.getByRole("heading", { name: /What are you curious about/i })).toBeVisible();
  await page.getByRole("link", { name: /Paneer Tikka/i }).first().click();
  await expect(page).toHaveURL(/\/explore\/dishes\/paneer-tikka/);
  await expect(page.getByRole("heading", { name: "Paneer Tikka", exact: true })).toBeVisible();
  await expect(page.getByText("Editorial preview.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator(".atlas-ad-reservation")).toHaveCount(0);
  expect((await request.get("/explore/dishes/missing-entry")).status()).toBe(404);
});

test("Atlas mobile navigation and article remain within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore/dishes/paneer-tikka");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator(".atlas-mobile-nav summary").click();
  await expect(page.getByRole("navigation", { name: "Mobile encyclopedia" }).getByRole("link", { name: /Ingredients/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
});

test("Atlas article has no serious WCAG A/AA violations", async ({ page }) => {
  await page.goto("/explore/dishes/paneer-tikka");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});

test("Atlas previews stay out of the public sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).not.toContain("/explore/dishes/paneer-tikka");
  expect(xml).not.toContain("/explore/search");
});
