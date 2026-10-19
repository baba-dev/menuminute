import { expect, test } from "@playwright/test";

test("desktop hero keeps the approved composition and brings supporting copy above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1363, height: 936 });
  await page.goto("/");
  const hero = page.locator(".food-orbit-hero");
  const description = hero.getByText(/Build your restaurant menu, publish it/i);
  await expect(description).toBeVisible();
  const box = await description.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(936);
  await expect(hero.getByRole("heading", { level: 1 })).toContainText("Free forever.");
});

test("mobile navigation exposes state, closes with Escape and retains 44px controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open navigation menu" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toHaveCSS("height", "44px");
  await open.click();
  const close = page.getByRole("button", { name: "Close navigation menu" });
  const pricing = page.locator("#food-orbit-mobile-nav").getByRole("link", { name: "Pricing" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(pricing).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
  await expect(pricing).toBeHidden();
});

test("homepage sections are sequential and exclusive choices use radio semantics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const order = await page.evaluate(() => {
    const selectors = [
      ".menu-alchemy",
      ".order-conveyor",
      ".chef-pass",
      ".service-worlds",
      ".storefront-studio",
    ];
    const nodes = selectors.map((selector) => document.querySelector(selector));
    return (
      nodes.every((node) => node) &&
      nodes.every(
        (node, index) =>
          index === 0 ||
          Boolean(
            nodes[index - 1]!.compareDocumentPosition(node!) & Node.DOCUMENT_POSITION_FOLLOWING
          )
      )
    );
  });
  expect(order).toBe(true);
  await expect(page.getByTestId("service-worlds").getByRole("radiogroup")).toHaveCount(1);
  await expect(page.getByTestId("storefront-studio").getByRole("radiogroup")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
