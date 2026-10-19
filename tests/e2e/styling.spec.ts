import { test, expect } from "@playwright/test";

test("homepage has integrated responsive navigation, centered copy and compiled theme styles", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.locator(".food-orbit-hero");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Your menu, beautifully digital.");
  await expect(heading).toContainText("Free forever.");
  await expect(hero).toContainText("Build your restaurant menu");
  await expect(nav).toHaveCSS("position", "relative");
  await expect(page.locator(".appearance-bar, .appearance")).toHaveCount(0);
  await expect(page.locator(".food-orbit-hero__divider")).toBeVisible();
  const width = page.viewportSize()!.width;
  await expect(heading).toHaveCSS(
    "font-size",
    width >= 1024 ? "60px" : width >= 640 ? "48px" : "36px"
  );
  if (width < 768) {
    await expect(nav.getByLabel("Open navigation menu")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Get started free" })).toBeHidden();
    await nav.getByLabel("Open navigation menu").click();
    await expect(nav.getByRole("link", { name: "Get started free" })).toBeVisible();
  } else {
    await expect(nav.getByLabel("Open navigation menu")).toBeHidden();
    await expect(nav.getByRole("link", { name: "Get started free" })).toBeVisible();
  }
  const selected = await page.locator("html").getAttribute("data-theme");
  await nav
    .getByRole("button", {
      name: selected === "dark" ? "Switch to light mode" : "Switch to dark mode",
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    selected === "dark" ? "light" : "dark"
  );
  await expect(heading).toHaveCSS(
    "color",
    selected === "dark" ? "rgb(23, 23, 23)" : "rgb(255, 255, 255)"
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    selected === "dark" ? "light" : "dark"
  );
});

test("homepage has no horizontal overflow at phone, tablet and desktop widths", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("food-orbit-hero-art")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      ),
      `overflow at ${width}px`
    ).toBe(true);
  }
});
