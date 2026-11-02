import { expect, test } from "@playwright/test";

test.describe("account deletion public page", () => {
  test("is public, indexable and discoverable with specific SEO metadata", async ({ page }) => {
    await page.goto("/delete-account");
    await expect(
      page.getByRole("heading", { level: 1, name: /delete your MenuMinute account/i })
    ).toBeVisible();
    await expect(page.getByRole("main", { name: "Account deletion information" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://food.bababuilds.com/delete-account"
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /request deletion of your MenuMinute account/i
    );
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
  });

  test("provides working manual request instructions and honest retention disclosures", async ({
    page,
  }) => {
    await page.goto("/delete-account");
    const request = page.getByRole("link", { name: /Request account deletion/i }).first();
    await expect(request).toHaveAttribute(
      "href",
      /^mailto:admin@bababuilds\.com\?subject=MenuMinute%20Account%20Deletion%20Request/
    );
    await expect(page.getByText(/does not offer instant or automated deletion/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /What data may be kept/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Privacy Policy/ }).last()).toHaveAttribute(
      "href",
      "/privacy"
    );
    await expect(page.getByRole("link", { name: /account privacy settings/ })).toHaveAttribute(
      "href",
      "/account#privacy"
    );
    await expect(
      page.getByRole("heading", { name: /Restaurant organizations and guest orders/ })
    ).toBeVisible();
  });

  test("has keyboard navigation and a small-screen table of contents without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/delete-account");
    await expect(page.getByText("Jump to a section")).toBeVisible();
    await page.locator("details.privacy-mobile-index summary").click();
    await page.getByRole("link", { name: /04\. Data we may retain/ }).click();
    await expect(page).toHaveURL(/#retained$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

  test("honors reduced motion for decorative illustration", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/delete-account");
    await expect(page.locator(".privacy-art-orbit")).toHaveCSS("animation-name", "none");
  });
});
