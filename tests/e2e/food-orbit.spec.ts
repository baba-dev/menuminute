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
  await expect(page.getByRole("link", { name: "View live demo" }).first()).toHaveAttribute(
    "href",
    "/demo"
  );
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

test("Food Orbit respects explicit appearance changes", async ({ page }) => {
  await page.goto("/");
  const art = page.getByTestId("food-orbit");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect
    .poll(async () => art.evaluate((el) => getComputedStyle(el).getPropertyValue("--paper").trim()))
    .toBe("#302b24");
  await page.reload();
  await expect
    .poll(async () => art.evaluate((el) => getComputedStyle(el).getPropertyValue("--paper").trim()))
    .toBe("#302b24");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect
    .poll(async () => art.evaluate((el) => getComputedStyle(el).getPropertyValue("--paper").trim()))
    .toBe("#fff9ed");
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

test("the artwork is centered on desktop while primary actions remain interactive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const art = page.getByTestId("food-orbit-hero-art");
  const box = await art.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(32);
  const primary = page.getByRole("link", { name: "Create your free menu", exact: true }).first();
  const demo = page.getByRole("link", { name: "View live demo", exact: true }).first();
  await expect(primary).toBeVisible();
  await expect(demo).toBeVisible();
  await expect(primary).toHaveCSS("background-image", /linear-gradient/);
  await expect(art.locator("svg")).toHaveAttribute("role", "img");
  await expect(art.locator("svg a, svg button, svg [tabindex]")).toHaveCount(0);
});

test("mobile hero keeps its copy and actions ahead of the illustrated stage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const primary = page.getByRole("link", { name: "Create your free menu", exact: true }).first();
  const art = page.getByTestId("food-orbit-hero-art");
  const [buttonBox, artBox] = await Promise.all([primary.boundingBox(), art.boundingBox()]);
  expect(buttonBox).not.toBeNull();
  expect(artBox).not.toBeNull();
  expect(buttonBox!.y).toBeLessThan(artBox!.y);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
  expect(noOverflow).toBe(true);
});
