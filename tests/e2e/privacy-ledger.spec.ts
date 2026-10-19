import { expect, test } from "@playwright/test";

test.describe("privacy ledger review draft", () => {
  test("renders an accessible, complete review draft without publication claims", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: /Your trust matters/ })).toBeVisible();
    await expect(page.getByRole("main", { name: "Privacy policy draft" })).toBeVisible();
    await expect(page.getByText("Legal and operational review draft", { exact: false })).toBeVisible();
    await expect(page.getByText("BabaBuilds", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /15\. Contact and complaints/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
    const sections = page.locator("main.privacy-copy > section.privacy-section");
    await expect(sections).toHaveCount(15);
    await page.getByRole("navigation", { name: "Privacy policy contents" }).getByRole("link", { name: /10\. Retention and deletion/ }).click();
    await expect(page).toHaveURL(/#retention$/);
  });

  test("deletion request is public, honest about manual status and linked from policy", async ({ page }) => {
    await page.goto("/privacy");
    await page.getByRole("link", { name: /View the account-deletion request information/ }).click();
    await expect(page).toHaveURL(/\/delete-account$/);
    await expect(page.getByRole("heading", { level: 1, name: /Request account and data deletion/ })).toBeVisible();
    await expect(page.getByText(/not a finished automated in-app deletion feature/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Email admin@bababuilds.com/ })).toHaveAttribute("href", /^mailto:admin@bababuilds\.com/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("small screen has visible contents and no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/privacy");
    await expect(page.getByText("Jump to a section")).toBeVisible();
    await page.locator("details.privacy-mobile-index").evaluate((e: HTMLDetailsElement) => { e.open = true; });
    await expect(page.getByRole("link", { name: /15\. Contact and complaints/ }).last()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("reduced motion freezes decorative art", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/privacy");
    const animation = await page.locator(".privacy-art-orbit").evaluate(e => getComputedStyle(e).animationName);
    expect(animation).toBe("none");
  });
});
