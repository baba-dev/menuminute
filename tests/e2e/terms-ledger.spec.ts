import { expect, test } from "@playwright/test";

test.describe("Terms: The Shared Table", () => {
  test("shows all 24 sections and the effective date", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { level: 1, name: /Good terms make better partnerships/ })
    ).toBeVisible();
    await expect(page.getByRole("main", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByText("Effective 24 October 2026", { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await expect(page.locator("main.privacy-copy > section.privacy-section")).toHaveCount(24);
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: /24\. General legal provisions and contact/ })
    ).toBeVisible();
    await expect(page.getByText(/not the seller, cook, caterer, restaurant/i)).toBeVisible();
  });

  test("anchors, Privacy Policy and account-deletion links are accessible", async ({ page }) => {
    await page.goto("/terms");
    const desktopContents = page.getByRole("navigation", { name: "Terms of Service contents" });
    if (await desktopContents.isVisible()) {
      await desktopContents
        .getByRole("link", { name: /9\. Guest ordering, acceptance and fulfillment/ })
        .click();
    } else {
      const mobileContents = page.locator("details.privacy-mobile-index");
      await mobileContents.locator("summary").click();
      await mobileContents
        .getByRole("link", { name: /9\. Guest ordering, acceptance and fulfillment/ })
        .click();
    }
    await expect(page).toHaveURL(/#ordering$/);
    await page.getByRole("link", { name: /Read the companion Privacy Policy/ }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goto("/terms");
    await page
      .getByRole("link", { name: /View current account-deletion request information/ })
      .click();
    await expect(page).toHaveURL(/\/delete-account$/);
  });

  test("mobile layout has no horizontal overflow or hidden terms sections", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/terms");
    await expect(page.getByText("Jump to a section")).toBeVisible();
    await page.locator("details.privacy-mobile-index").evaluate((e: HTMLDetailsElement) => {
      e.open = true;
    });
    await expect(
      page.getByRole("link", { name: /24\. General legal provisions and contact/ }).last()
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

  test("decorative animation respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/terms");
    const orbit = await page
      .locator(".terms-page .privacy-art-orbit")
      .evaluate((e) => getComputedStyle(e).animationName);
    const scales = await page
      .locator(".terms-scale")
      .evaluate((e) => getComputedStyle(e).animationName);
    expect(orbit).toBe("none");
    expect(scales).toBe("none");
  });
});
