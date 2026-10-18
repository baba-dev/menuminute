import { expect, test } from "@playwright/test";

test("Menu Alchemy follows the Journey and preserves the existing product links", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("food-orbit");
  const journey = page.getByTestId("menu-journey");
  const alchemy = page.getByTestId("menu-alchemy");
  await expect(hero).toBeVisible();
  await expect(journey).toBeVisible();
  await expect(alchemy).toBeVisible();
  await expect(alchemy.getByRole("heading", { name: /Your menu already exists/i })).toBeVisible();
  await expect(alchemy.getByText(/COMING SOON — SMART MENU IMPORT/i)).toBeVisible();
  await expect(alchemy.getByRole("link", { name: /Create your free menu today/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(alchemy.getByText(/Manual menu creation is available now/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start free. Grow as you need." })).toBeVisible();
  const order = await page.locator("main, body").first().evaluate((node) => {
    const journeyNode = node.querySelector(".menu-journey");
    const alchemyNode = node.querySelector(".menu-alchemy");
    return Boolean(
      journeyNode &&
        alchemyNode &&
        (journeyNode.compareDocumentPosition(alchemyNode) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(order).toBe(true);
});

test("Menu Alchemy controls pause and restart its original SVG timeline", async ({ page }) => {
  await page.goto("/");
  const alchemy = page.getByTestId("menu-alchemy");
  await alchemy.scrollIntoViewIfNeeded();
  await expect(alchemy.locator(".ma-desktop-art svg")).toBeVisible();
  await expect(alchemy.locator("#menuGroup")).toHaveCount(1);
  await expect(alchemy.locator("#dashboard")).toHaveCount(1);
  const pause = alchemy.getByRole("button", { name: "Pause illustration" });
  await expect(pause).toBeEnabled({ timeout: 5000 });
  await pause.click();
  await expect(alchemy.getByRole("button", { name: "Play illustration" })).toBeEnabled();
  await alchemy.getByRole("button", { name: /Replay the nine-second illustration/i }).click();
  await expect(alchemy).toHaveAttribute("data-phase", "0");
});

test("Menu Alchemy is mobile-safe, theme-aware and static with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const alchemy = page.getByTestId("menu-alchemy");
  await alchemy.scrollIntoViewIfNeeded();
  await expect(alchemy.locator(".ma-mobile-art")).toBeVisible();
  await expect(alchemy).toHaveAttribute("data-phase", "3");
  await expect(alchemy.getByText("Static preview for reduced motion")).toBeVisible();
  await expect(alchemy.getByRole("button", { name: /Replay the nine-second illustration/i })).toBeDisabled();
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflowing).toBe(false);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect
    .poll(() => alchemy.evaluate((element) => getComputedStyle(element).getPropertyValue("--ma-accent").trim()))
    .toBe("#ffc83d");
});
