import { expect, test, type Page } from "@playwright/test";

const MENU = "/m/demo-spice-route-kitchen-v1";
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

/** A page that scrolls sideways at a supported width breaks the mobile-first contract. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const viewport of VIEWPORTS) {
    test(`public menu has no horizontal scroll at ${viewport.width}px (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize(viewport);
      await page.goto(MENU);
      await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
}

test("dish details dialog stays inside a 320px viewport and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(MENU);
  await page.getByRole("button", { name: "View Paneer Tikka details" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Paneer Tikka" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("menu remains usable at 200% text zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(MENU);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
