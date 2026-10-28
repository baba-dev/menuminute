import { expect, test } from "@playwright/test";

test("subpage navigation keeps active routes and account actions styled on direct loads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  for (const route of ["/pricing", "/demo"]) {
    await page.goto(route);
    const nav = page.getByRole("navigation", { name: "Subpage navigation" });
    const active = route === "/pricing" ? "Pricing" : "Demo";
    await expect(nav.getByRole("link", { name: active })).toHaveAttribute("aria-current", "page");
    const start = nav.getByRole("link", { name: "Get started free" });
    await expect(start).toBeVisible();
    await expect(start).toHaveCSS("background-image", /linear-gradient/);
    await expect(start).toHaveCSS("min-height", "44px");
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/pricing");
  const nav = page.getByRole("navigation", { name: "Subpage navigation" });
  const trigger = nav.getByRole("button", { name: "Open navigation menu" });
  await trigger.click();
  await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
  const start = nav.getByRole("link", { name: "Get started free" });
  await expect(start).toBeVisible();
  await expect(start).toHaveCSS("background-image", /linear-gradient/);
  await expect(start).toHaveCSS("min-height", "44px");
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
  await expect(start).toHaveCount(0);
});

test("theme controls stay synchronized across responsive breakpoints and system changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/pricing");
  await page.evaluate(() => localStorage.setItem("menuminute.appearance", "light"));
  await page.reload();
  const nav = page.getByRole("navigation", { name: "Subpage navigation" });
  await nav.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(nav.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await nav.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(nav.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.evaluate(() => localStorage.setItem("menuminute.appearance", "system"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("pricing and demo have no horizontal overflow at compact and desktop sizes", async ({
  page,
}) => {
  for (const route of ["/pricing", "/demo"]) {
    for (const width of [320, 360, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Subpage navigation" })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        ),
        `${route} overflows at ${width}px`
      ).toBe(true);
    }
  }
});
