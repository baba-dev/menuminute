import { expect, test } from "@playwright/test";

test("Dining Canvas displays the public cover, illustrated navigation and browse-only details", async ({ page }) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
  await expect(page.locator(".dining-cover-image")).toHaveAttribute("src", /\/assets\/public-menu\/covers\//);
  await expect(page.getByRole("navigation", { name: "Menu categories" }).locator("img").first()).toHaveAttribute("src", /\/assets\/public-menu\/categories\//);
  await page.getByRole("button", { name: "View Paneer Tikka details" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Paneer Tikka" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".dining-customizer-photo img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("filtered public menu does not expose dead category links", async ({ page }) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  const nav = page.getByRole("navigation", { name: "Menu categories" });
  await page.getByRole("searchbox", { name: "Search the menu" }).fill("not-a-real-dish-xyz");
  await expect(nav.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(nav.getByRole("link").first()).toBeVisible();
});
