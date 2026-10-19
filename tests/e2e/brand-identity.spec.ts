import { expect, test } from "@playwright/test";

test("brand logo enters once and remounts only when the resolved color mode changes", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const logo = nav.getByTestId("animated-nav-logo");
  await expect(logo).toBeVisible();
  const initial = (await page.locator("html").getAttribute("data-theme")) === "dark" ? "dark" : "light";
  await expect(logo).toHaveAttribute("data-logo-theme", initial);
  await expect(logo).toHaveAttribute("src", new RegExp(`nav-${initial}-transparent\\.svg$`));
  // A regular navigation interaction may rerender its surroundings, but does not replay the logo.
  const originalNode = await logo.elementHandle();
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByLabel("Open navigation menu").click();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((node, original) => node === original, originalNode)).toBe(true);

  const next = initial === "light" ? "dark" : "light";
  await nav.getByRole("button", { name: initial === "dark" ? "Switch to light mode" : "Switch to dark mode" }).click();
  await expect(logo).toHaveAttribute("data-logo-theme", next);
  await expect(logo).toHaveAttribute("src", new RegExp(`nav-${next}-transparent\\.svg$`));
  expect(await logo.evaluate((node, original) => node === original, originalNode)).toBe(false);
  await expect(logo).toHaveAttribute("alt", "");
  await expect(nav.getByRole("link", { name: "MenuMinute home" })).toHaveAttribute("href", "/");
});

test("reduced-motion visitors receive the static final lockup without logo motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const logo = page.getByRole("navigation", { name: "Main navigation" }).getByTestId("animated-nav-logo");
  await expect(logo).toBeVisible();
  const response = await page.request.get(await logo.getAttribute("src") as string);
  expect(response.ok()).toBe(true);
  const svg = await response.text();
  expect(svg).toContain("@media(prefers-reduced-motion:reduce)");
  expect(svg).toContain("animation:none!important");
  expect(svg).not.toContain("animation-iteration-count:infinite");
});
