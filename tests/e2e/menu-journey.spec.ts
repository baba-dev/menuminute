import { expect, test } from "@playwright/test";

test("homepage replaces the free checklist with the three-stage Menu Journey", async ({ page }) => {
  await page.goto("/");
  const journey = page.getByTestId("menu-journey");
  await expect(journey).toBeVisible();
  await expect(
    journey.getByRole("heading", { name: /From your kitchen to their fingertips/i })
  ).toBeVisible();
  await expect(journey.locator(".mj-step")).toHaveCount(3);
  await expect(journey.getByRole("heading", { name: "Add your dishes." })).toBeVisible();
  await expect(journey.getByRole("heading", { name: "Make it yours." })).toBeVisible();
  await expect(journey.getByRole("heading", { name: "Share one QR." })).toBeVisible();
  await expect(journey.getByRole("link", { name: /Create your free menu/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(journey.getByRole("link", { name: /Explore the live demo/i })).toHaveAttribute(
    "href",
    "/demo"
  );
  await expect(journey.getByRole("link", { name: /Ordering & kitchen plans/i })).toHaveAttribute(
    "href",
    "/pricing"
  );
  await expect(journey.getByText("In development")).toBeVisible();
  await expect(page.getByTestId("food-orbit")).toBeVisible();
  await expect(page.getByText("Everything in the free plan")).toHaveCount(0);
});

test("Menu Journey respects reduced motion and phone width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const journey = page.getByTestId("menu-journey");
  await journey.scrollIntoViewIfNeeded();
  await expect(journey).toBeVisible();
  await expect(journey.locator(".mj-mobile-connector").first()).toBeVisible();
  await expect(journey.locator(".mj-route-progress")).toHaveCSS("stroke-dashoffset", "0px");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});
