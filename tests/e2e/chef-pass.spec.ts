import { expect, test } from "@playwright/test";

test("Chef's Pass is Section 5, after Order Conveyor, and truthfully advertises planned KDS", async ({
  page,
}) => {
  await page.goto("/");
  const pass = page.getByTestId("chef-pass");
  await expect(pass).toBeVisible();
  await expect(pass.getByRole("heading", { name: /One order. Every station. In sync/i })).toBeVisible();
  await expect(pass.getByText("KITCHEN PRO · IN DEVELOPMENT")).toBeVisible();
  await expect(pass.getByRole("link", { name: /Explore future plans/i })).toHaveAttribute(
    "href",
    "/pricing"
  );
  await expect(pass.getByRole("link", { name: /Create your free menu/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(pass).toContainText("No live orders or kitchen actions");
  await expect(pass.locator(".cp-capability")).toHaveCount(4);
  await expect(pass.locator("svg.cp-svg")).toHaveCount(4);
  await expect(pass.locator(".cp-desktop-dark svg")).toHaveAttribute("viewBox", "0 0 1440 790");
  await expect(pass.locator(".cp-mobile-dark svg")).toHaveAttribute("viewBox", "0 0 430 900");
  const order = await page.evaluate(() => {
    const previous = document.querySelector(".order-conveyor");
    const pass = document.querySelector(".chef-pass");
    const next = document.querySelector(".ma-product-features");
    return Boolean(
      previous &&
        pass &&
        next &&
        previous.compareDocumentPosition(pass) & Node.DOCUMENT_POSITION_FOLLOWING &&
        pass.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(order).toBe(true);
});

test("Chef's Pass uses distinct mobile artwork with reduced-motion and correct theme", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/");
    const pass = page.getByTestId("chef-pass");
    await pass.scrollIntoViewIfNeeded();
    await expect(pass).toHaveAttribute("data-phase", "4");
    const mobile = width <= 680;
    if (mobile) {
      await expect(pass.locator(".cp-mobile-light svg")).toBeVisible();
      await expect(pass.locator(".cp-desktop-light svg")).toBeHidden();
    } else {
      await expect(pass.locator(".cp-desktop-light svg")).toBeVisible();
      await expect(pass.locator(".cp-mobile-light svg")).toBeHidden();
    }
    await expect(pass.getByRole("button", { name: "Replay Chef's Pass animation" })).toBeDisabled();
    await expect(pass.getByText("Static preview for reduced motion")).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect(
      pass.locator(mobile ? ".cp-mobile-dark svg" : ".cp-desktop-dark svg")
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test("Desktop Chef's Pass has working pause and replay controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const pass = page.getByTestId("chef-pass");
  await pass.locator(".cp-stage").scrollIntoViewIfNeeded();
  const pause = pass.getByRole("button", { name: "Pause Chef's Pass animation" });
  await expect(pause).toBeEnabled({ timeout: 5000 });
  await pause.click();
  await expect(pass.getByRole("button", { name: "Play Chef's Pass animation" })).toBeEnabled();
  await pass.getByRole("button", { name: "Replay Chef's Pass animation" }).click();
  await expect(pass).toHaveAttribute("data-phase", "0");
});
