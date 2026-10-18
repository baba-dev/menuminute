import { expect, test } from "@playwright/test";

test("Section 4 follows smart import and advertises only planned ordering", async ({ page }) => {
  await page.goto("/");
  const conveyor = page.getByTestId("order-conveyor");
  await expect(conveyor).toBeVisible();
  await expect(conveyor.getByRole("heading", { name: /From craving to counter/i })).toBeVisible();
  await expect(conveyor.getByText("ONLINE ORDERING · IN DEVELOPMENT")).toBeVisible();
  await expect(conveyor.getByRole("link", { name: /Explore future plans/i })).toHaveAttribute(
    "href",
    "/pricing"
  );
  await expect(conveyor.getByRole("link", { name: /Create your free menu/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(conveyor.locator(".oc-capability")).toHaveCount(4);
  await expect(conveyor.locator("svg.oc-svg")).toHaveCount(2);
  await expect(conveyor.locator("svg.oc-svg").first()).toHaveAttribute("viewBox", "0 0 1440 620");
  await expect(conveyor.locator("svg.oc-svg").last()).toHaveAttribute("viewBox", "0 0 420 880");
  await expect(conveyor).toContainText("No real orders or payments are placed");
  await expect(conveyor.getByRole("navigation")).toHaveCount(0);
  const correctOrder = await page.evaluate(() => {
    const journey = document.querySelector(".menu-journey");
    const alchemy = document.querySelector(".menu-alchemy");
    const conveyor = document.querySelector(".order-conveyor");
    const products = document.querySelector(".ma-product-features");
    return Boolean(
      journey && alchemy && conveyor && products &&
      (journey.compareDocumentPosition(alchemy) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (alchemy.compareDocumentPosition(conveyor) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (conveyor.compareDocumentPosition(products) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(correctOrder).toBe(true);
});

test("Conveyor uses a separate phone composition, follows theme, and preserves reduced-motion finale", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/");
    const conveyor = page.getByTestId("order-conveyor");
    await conveyor.scrollIntoViewIfNeeded();
    await expect(conveyor).toBeVisible();
    if (width <= 680) {
      await expect(conveyor.locator(".oc-mobile-art svg")).toBeVisible();
      await expect(conveyor.locator(".oc-desktop-art svg")).toBeHidden();
    } else {
      await expect(conveyor.locator(".oc-desktop-art svg")).toBeVisible();
      await expect(conveyor.locator(".oc-mobile-art svg")).toBeHidden();
    }
    await expect(conveyor.getByRole("button", { name: "Replay Order Conveyor animation" })).toBeDisabled();
    await expect(conveyor.getByText("Static preview for reduced motion")).toBeVisible();
    const svg = conveyor.locator(width <= 680 ? ".oc-mobile-art svg" : ".oc-desktop-art svg");
    await expect(svg.locator(".oc-merchant-accepted")).toHaveCSS("opacity", "1");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    await expect(svg).toHaveAttribute("data-theme", "dark");
    await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
    await expect(svg).toHaveAttribute("data-theme", "light");
  }
});

test("Conveyor animation is one-shot, viewport-triggered and replayable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const conveyor = page.getByTestId("order-conveyor");
  await conveyor.scrollIntoViewIfNeeded();
  const svg = conveyor.locator(".oc-desktop-art svg");
  await expect(svg).toHaveClass(/oc-play/);
  await expect(conveyor).toHaveAttribute("data-state", /playing|complete/);
  const replay = conveyor.getByRole("button", { name: "Replay Order Conveyor animation" });
  await expect(replay).toBeEnabled();
  await replay.click();
  await expect(conveyor).toHaveAttribute("data-state", "playing");
  await expect(svg).toHaveClass(/oc-play/);
  expect(await svg.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
});
