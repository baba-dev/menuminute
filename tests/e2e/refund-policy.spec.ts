import { expect, test } from "@playwright/test";

test.describe("published Refund Policy", () => {
  test("replaces the placeholder, is indexable, canonical and linked", async ({ page }) => {
    await page.goto("/refund-policy");
    await expect(
      page.getByRole("heading", { level: 1, name: /Clear prices.*Clear policies/ })
    ).toBeVisible();
    await expect(page.getByRole("main", { name: "Refund and Cancellation Policy" })).toBeVisible();
    await expect(
      page.getByText(/Paid subscription pricing and refund terms are not finalized/)
    ).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://food.bababuilds.com/refund-policy"
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /No voluntary refunds, with statutory protections/i
    );
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
    await expect(page.locator("main.privacy-copy > section.privacy-section")).toHaveCount(9);
  });

  test("explains both the no-voluntary-refund rule and mandatory legal remedies", async ({
    page,
  }) => {
    await page.goto("/refund-policy");
    await expect(
      page.getByRole("heading", { name: "2. Our no-voluntary-refund policy" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "3. When a refund or remedy may be due" })
    ).toBeVisible();
    await expect(
      page.getByText(/duplicate, incorrect, excessive or otherwise unauthorized billing/i)
    ).toBeVisible();
    await expect(page.getByText(/end of the already-paid billing period/)).toBeVisible();
    await expect(page.getByText(/not for food or restaurant-service purchases/i)).toBeVisible();
    await expect(page.getByText(/Consumer Protection Act, 2019/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact billing support" })).toHaveAttribute(
      "href",
      /^mailto:admin@bababuilds\.com/
    );
    await expect(page.getByRole("link", { name: "Terms of Service" }).first()).toHaveAttribute(
      "href",
      "/terms"
    );
  });

  test("mobile table of contents, accessible art and reduced-motion layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/refund-policy");
    await page.locator("details.privacy-mobile-index summary").click();
    await page.getByRole("link", { name: "4. Cancellation and renewals" }).last().click();
    await expect(page).toHaveURL(/#cancellation$/);
    await expect(page.locator(".privacy-art-orbit")).toHaveCSS("animation-name", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
  });
});
