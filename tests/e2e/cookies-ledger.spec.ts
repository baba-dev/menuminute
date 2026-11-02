import { expect, test } from "@playwright/test";

test.describe("public Cookie Policy", () => {
  test("replaces the placeholder with a canonical indexable public page", async ({ page }) => {
    await page.goto("/cookies");
    await expect(
      page.getByRole("heading", { level: 1, name: /Small files.*Clear choices/ })
    ).toBeVisible();
    await expect(page.getByRole("main", { name: "Cookie Policy" })).toBeVisible();
    await expect(page.getByText(/Our cookie notice is being prepared/)).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://food.bababuilds.com/cookies"
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /essential cookies, login sessions and browser storage/i
    );
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
    await expect(page.locator("main.privacy-copy section.privacy-section")).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: "5. Analytics, advertising and consent" })
    ).toBeVisible();
  });

  test("discloses verified browser storage without fake preference switches", async ({ page }) => {
    await page.goto("/cookies");
    const inventory = page.getByRole("region", { name: "Cookies and browser storage inventory" });
    await expect(inventory).toContainText("menuminute.appearance");
    await expect(inventory).toContainText("menuminute.remembered-email.v1");
    await expect(inventory).toContainText("menuminute.pending-login.v1");
    await expect(inventory).toContainText("Better Auth");
    await expect(page.getByText(/does not record consent/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "account and data deletion page" })
    ).toHaveAttribute("href", "/delete-account");
    await expect(page.getByRole("switch")).toHaveCount(0);
  });

  test("has mobile contents navigation, no horizontal page overflow and reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/cookies");
    await page.locator("details.privacy-mobile-index summary").click();
    await page.getByRole("link", { name: "3. What we use today" }).last().click();
    await expect(page).toHaveURL(/#inventory$/);
    await expect(page.locator(".privacy-art-orbit")).toHaveCSS("animation-name", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
  });
});
