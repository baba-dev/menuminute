import { expect, test } from "@playwright/test";

test("nav logo plays once per resolved theme and is a correctly labeled home link", async ({
  page,
}) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "MenuMinute home" });
  await expect(link).toBeVisible();
  const current =
    (await page.locator("html").getAttribute("data-theme")) === "dark" ? "dark" : "light";
  const object = link.getByTestId("brand-nav-motion");
  await expect(object).toHaveAttribute("data-brand-mode", current);
  await expect(object).toHaveAttribute("data", `/brand/motion/logo-reveal-${current}-nav.svg`);
  const original = await object.elementHandle();
  await page.getByLabel("Open navigation menu").count(); // unrelated DOM updates cannot restart motion
  expect(await original?.evaluate((node) => node.isConnected)).toBe(true);
  await page
    .getByRole("button", {
      name: current === "dark" ? "Switch to light mode" : "Switch to dark mode",
    })
    .first()
    .click();
  const next = current === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", next);
  await expect(object).toHaveAttribute("data-brand-mode", next);
  await expect(object).toHaveAttribute("data", `/brand/motion/logo-reveal-${next}-nav.svg`);
  expect(await original?.evaluate((node) => node.isConnected)).toBe(false);
});

test("brand animation has reduced-motion final-state fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const object = page.getByTestId("brand-nav-motion");
  await expect(object).toBeVisible();
  const url = await object.getAttribute("data");
  const response = await page.request.get(url!);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("prefers-reduced-motion:reduce");
});
