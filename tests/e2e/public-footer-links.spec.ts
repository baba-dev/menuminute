import { expect, test } from "@playwright/test";

const removedHrefs = [
  "/solutions/restaurants",
  "/solutions/cafes",
  "/solutions/bakeries",
  "/solutions/cloud-kitchens",
  "/free-qr-menu",
  "/features/digital-menu-builder",
  "/features/kitchen-display-system",
  "/features/restaurant-pos",
  "/features/ai-menu-import",
  "/pricing",
  "/demo",
  "/ordering",
  "/accessibility",
  "/security",
];

test("shared public footer keeps its primary links without the removed entries", async ({ page }) => {
  await page.goto("/refund-policy");
  const footer = page.getByTestId("public-footer");
  await expect(footer).toBeVisible();

  for (const href of removedHrefs) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(0);
  }

  for (const href of [
    "/features",
    "/solutions",
    "/register",
    "/privacy",
    "/delete-account",
    "/terms",
    "/cookies",
    "/refund-policy",
  ]) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
});

test("footer links stay trimmed on another public page and on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/privacy");
  const footer = page.getByTestId("public-footer");
  await expect(footer).toBeVisible();
  for (const href of removedHrefs) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(0);
  }
});
