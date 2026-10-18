import { expect, test } from "@playwright/test";

test("Food Orbit is native SVG, accessible, and advertises only the free product", async ({
  page,
}) => {
  await page.goto("/");
  const art = page.getByTestId("food-orbit");
  const svg = art.locator("svg");
  await expect(art).toBeVisible();
  await expect(svg).toHaveAttribute("viewBox", "0 0 1200 900");
  await expect(svg).toHaveAttribute("role", "img");
  await expect(svg.locator("title")).toHaveText("The Food Orbit");
  await expect(svg.locator("desc")).toContainText("decorative QR table sign");
  await expect(svg.locator(".food-orbit__enter")).toHaveCount(6);
  await expect(svg).toContainText("FREE QR MENU");
  await expect(page.getByRole("link", { name: "Create your free menu" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.locator('a[href="/demo"]').first()).toHaveAttribute("href", "/demo");
  await expect(page.locator("body")).not.toContainText(/₹149|₹299/);
});

test("Food Orbit maintains a visible composition without horizontal overflow at key breakpoints", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const art = page.getByTestId("food-orbit");
    await expect(art).toBeVisible();
    const box = await art.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(200);
    expect(box?.height ?? 0).toBeGreaterThan(200);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow, "Unexpected horizontal overflow at " + width + "px").toBe(false);
  }
});

test("theme icon switches the entire hero and persists across reloads", async ({ page }) => {
  await page.goto("/");
  const art = page.getByTestId("food-orbit");
  const current =
    (await page.locator("html").getAttribute("data-theme")) === "dark" ? "dark" : "light";
  await page
    .getByRole("button", {
      name: current === "dark" ? "Switch to light mode" : "Switch to dark mode",
    })
    .click();
  const next = current === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", next);
  await expect
    .poll(async () => art.evaluate((el) => getComputedStyle(el).getPropertyValue("--paper").trim()))
    .toBe(next === "dark" ? "#302b24" : "#fff9ed");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", next);
  await page
    .getByRole("button", { name: next === "dark" ? "Switch to light mode" : "Switch to dark mode" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", current);
});

test("reduced motion shows the complete final artwork and does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const art = page.getByTestId("food-orbit");
  await expect(art).toBeVisible();
  const phone = art.locator(".food-orbit__enter--phone");
  await expect(phone).toHaveCSS("animation-name", "none");
  await expect(phone).toHaveCSS("opacity", "1");
  await expect(art.locator(".food-orbit__trace")).toHaveCSS("stroke-dashoffset", "0px");
  await expect(art).toHaveAttribute("data-paused", "true");
});

test("the centered desktop composition contains only title, artwork and supporting copy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  const art = page.getByTestId("food-orbit-hero-art");
  const description = page.locator(".food-orbit-hero__description");
  const [titleBox, artBox, descriptionBox] = await Promise.all([
    heading.boundingBox(),
    art.boundingBox(),
    description.boundingBox(),
  ]);
  expect(titleBox && artBox && descriptionBox).toBeTruthy();
  expect(titleBox!.y + titleBox!.height).toBeLessThan(artBox!.y);
  expect(artBox!.y + artBox!.height).toBeLessThan(descriptionBox!.y);
  expect(Math.abs(artBox!.x + artBox!.width / 2 - 720)).toBeLessThan(24);
  await expect(
    page.locator(".food-orbit-hero__eyebrow, .food-orbit-hero__benefits, .food-orbit-hero__cta")
  ).toHaveCount(0);
  await expect(
    page.locator(".food-orbit-hero").getByRole("link", { name: "View live demo" })
  ).toHaveCount(0);
  await expect(art.locator("svg")).toHaveAttribute("role", "img");
  await expect(art.locator("svg a, svg button, svg [tabindex]")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const hero = page.locator(".food-orbit-hero");
  expect(
    await nav.evaluate((node, parent) => parent?.contains(node), await hero.elementHandle())
  ).toBe(true);
});

test("mobile retains the same vertical story and exposes actions in its nav menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  const art = await page.getByTestId("food-orbit-hero-art").boundingBox();
  const copy = await page.locator(".food-orbit-hero__description").boundingBox();
  expect(title && art && copy).toBeTruthy();
  expect(title!.y + title!.height).toBeLessThan(art!.y);
  expect(art!.y + art!.height).toBeLessThan(copy!.y);
  await page.getByLabel("Open navigation menu").click();
  await expect(page.getByRole("link", { name: "Get started free" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
});
