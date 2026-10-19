import { expect, test } from "@playwright/test";

test.describe("shared public footer", () => {
  for (const route of ["/", "/pricing", "/demo", "/login", "/register", "/privacy", "/terms"]) {
    test(`renders once on ${route}`, async ({ page }) => {
      await page.goto(route);
      const footer = page.getByTestId("public-footer");
      await expect(footer).toHaveCount(1);
      await expect(footer).toContainText("© 2026 Menu Minute App - A Subsidiary of BabaBuilds.com.");
      await expect(footer.getByRole("link", { name: /BabaBuilds website/ })).toHaveAttribute("href", "https://bababuilds.com/");
      await expect(footer.getByRole("link", { name: /BabaBuilds ERP/ })).toHaveAttribute("href", "https://erp.bababuilds.com/");
      await expect(footer.getByRole("link", { name: /Privacy Policy/ })).toHaveAttribute("href", "/privacy");
      await expect(footer.getByRole("link", { name: /Terms of Service/ })).toHaveAttribute("href", "/terms");
      await expect(footer).toContainText("not external certifications");
      await expect(footer).toContainText("Planned · not yet available");
    });
  }

  test("legal placeholders do not pretend to be published policies", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText("not a published Privacy Policy", { exact: false })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByText("not a published Terms of Service", { exact: false })).toBeVisible();
  });

  test("restaurant guest menus do not receive a marketing footer", async ({ page }) => {
    await page.goto("/m/demo-spice-route-kitchen-v1");
    await expect(page.getByTestId("public-footer")).toHaveCount(0);
  });

  test("footer remains usable on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const footer = page.getByTestId("public-footer");
    await expect(footer.getByRole("link", { name: /Create your free menu/ })).toBeVisible();
    await expect(footer.getByRole("link", { name: /Contact/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
