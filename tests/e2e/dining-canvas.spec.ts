import { expect, test } from "@playwright/test";

test("Dining Canvas displays the public cover, illustrated navigation and browse-only details", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
  await expect(page.locator(".dining-cover-image")).toHaveAttribute(
    "src",
    /\/assets\/public-menu\/covers\//
  );
  const thumbnail = page
    .getByRole("navigation", { name: "Explore menu categories" })
    .locator("img")
    .first();
  // next/image rewrites src to its optimized endpoint. Verify the actual
  // network image loaded rather than freezing an implementation-specific URL.
  await expect(thumbnail).toHaveAttribute("sizes", "32px");
  await expect
    .poll(() =>
      thumbnail.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);
  await page.getByRole("button", { name: "View Paneer Tikka details" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Paneer Tikka" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".dining-customizer-photo img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("filtered public menu does not expose dead category links", async ({ page }) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  const links = page.locator(".dining-hero-categories a");
  await page.getByRole("searchbox", { name: "Search the menu" }).fill("not-a-real-dish-xyz");
  await expect(links).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(links.first()).toBeVisible();
});
