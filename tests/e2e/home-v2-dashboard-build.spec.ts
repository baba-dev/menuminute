import { expect, test, type Page } from "@playwright/test";

/**
 * Scroll the pinned section to progress `p` (0..1) and wait for the eased value to settle.
 * The stage pins below the sticky homepage nav, so progress runs from where the section's top
 * reaches the nav to where the stage lets go (see `pinnedProgress`).
 */
async function scrollToProgress(page: Page, p: number) {
  await page.evaluate((target) => {
    const section = document.querySelector<HTMLElement>(".db")!;
    const nav = parseFloat(getComputedStyle(section).getPropertyValue("--db-nav")) || 0;
    const travel = section.offsetHeight - (window.innerHeight - nav);
    window.scrollTo(0, section.offsetTop - nav + travel * target);
  }, p);
  await expect
    .poll(async () => Number(await page.locator(".db").getAttribute("data-p")), { timeout: 5000 })
    .toBeCloseTo(p, 2);
}

const bell = (page: Page) => page.locator(".mm-topbar-bell-badge");
const stage = (page: Page) => page.locator(".db__stage");
const cue = (page: Page) => page.locator(".db__cue");

test.describe("home-v2 scroll-assembled dashboard", () => {
  test("shows the homepage nav bar with a working appearance toggle", async ({ page }) => {
    await page.goto("/home-v2");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("link", { name: "MenuMinute home" })).toBeVisible();
    const html = page.locator("html");
    const before = (await html.getAttribute("data-theme")) === "dark" ? "dark" : "light";
    const after = before === "dark" ? "light" : "dark";
    // The mobile layout has its own toggle; take whichever is visible.
    await page
      .getByRole("button", {
        name: before === "dark" ? "Switch to light mode" : "Switch to dark mode",
      })
      .locator("visible=true")
      .first()
      .click();
    await expect(html).toHaveAttribute("data-theme", after);
    // The stage still renders after the switch, mid-build.
    await scrollToProgress(page, 0.45);
    await expect(page.locator('[data-piece="kpi-3"]')).toBeVisible();
  });

  test("a scroll cue and wireframe orient the first frame, then give way", async ({ page }) => {
    await page.goto("/home-v2");
    await scrollToProgress(page, 0);
    await expect(cue(page)).toBeVisible();
    await expect(cue(page)).toContainText("Scroll to build your dashboard");
    await expect(page.locator(".db__ghost")).toHaveCSS("opacity", "1");
    await scrollToProgress(page, 0.3);
    await expect(cue(page)).toHaveCSS("opacity", "0");
    await expect(page.locator(".db__ghost")).toHaveCSS("opacity", "0");
    await scrollToProgress(page, 0);
    await expect(cue(page)).toHaveCSS("opacity", "1");
  });

  test("assembles on the way down and disassembles on the way up, identically", async ({
    page,
  }) => {
    await page.goto("/home-v2");
    const kpi = page.locator('[data-piece="kpi-3"] [data-count-to]');
    await scrollToProgress(page, 0);
    await expect(kpi).toHaveText("0");
    await scrollToProgress(page, 0.5);
    const downward = await page.locator('[data-piece="kpi-3"]').getAttribute("style");
    await scrollToProgress(page, 1);
    await expect(kpi).toHaveText("236");
    await scrollToProgress(page, 0.5);
    expect(await page.locator('[data-piece="kpi-3"]').getAttribute("style")).toBe(downward);
    await scrollToProgress(page, 0);
    await expect(kpi).toHaveText("0");
  });

  test("renders the product's own floor and Today's pulse, in the product's widget order", async ({
    page,
  }) => {
    await page.goto("/home-v2");
    await scrollToProgress(page, 0.9);
    const widgets = await page
      .locator(".db .mm-widget-grid > .mm-widget")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset["widget"]));
    expect(widgets).toEqual([
      "kpis",
      "priorities",
      "dispatch",
      "health",
      "floor",
      "serviceRequests",
      "pulse",
      "plan",
    ]);
    const floor = page.locator('[data-widget="floor"]');
    await expect(floor).toContainText("Your dining floor");
    await expect(floor).toContainText("Tables in use");
    await expect(floor.locator("svg[role='img']")).toHaveCount(12);
    await expect(page.locator('[data-widget="pulse"]')).toContainText("Today’s pulse");
  });

  test("the new order lands, and un-lands when scrolling back", async ({ page }) => {
    await page.goto("/home-v2");
    const awaiting = page.locator("[data-beat-add]");
    const floor = page.locator('[data-widget="floor"]');
    const pulse = page.locator('[data-widget="pulse"]');
    await scrollToProgress(page, 0.8);
    await expect(bell(page)).toHaveText("3");
    await expect(awaiting).toHaveText("3");
    await expect(floor.locator('[data-focused="true"]')).toHaveCount(0);
    await expect(floor).toContainText("6 open");
    await expect(pulse).toContainText("6 open orders");
    await scrollToProgress(page, 1);
    await expect(bell(page)).toHaveText("4");
    await expect(awaiting).toHaveText("4");
    await expect(floor.locator('[data-focused="true"]')).toHaveCount(1);
    await expect(floor).toContainText("7 open");
    await expect(pulse).toContainText("7 open orders");
    await scrollToProgress(page, 0.8);
    await expect(bell(page)).toHaveText("3");
    await expect(floor.locator('[data-focused="true"]')).toHaveCount(0);
    await expect(pulse).toContainText("6 open orders");
  });

  test("the stage is a non-interactive picture; captions carry the links", async ({ page }) => {
    await page.goto("/home-v2");
    await expect(stage(page)).toHaveAttribute("aria-hidden", "true");
    await expect(stage(page)).toHaveAttribute("inert", "");
    await scrollToProgress(page, 0.3);
    await expect(page.locator(".db__caption:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "Priorities" }).click();
    await expect(page.locator(".db")).toHaveAttribute("data-chapter", "priorities");
    const link = page.getByRole("link", { name: "How publishing works" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/help/owner");
    await page.getByRole("button", { name: "Live service" }).click();
    await expect(page.locator(".db")).toHaveAttribute("data-chapter", "live-service");
    await expect(page.getByRole("link", { name: "Try the live demo" }).first()).toBeVisible();
  });

  test("shows no horizontal overflow and no console errors from the page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/home-v2");
    await scrollToProgress(page, 0.6);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("reduced motion: no pin, finished page, every caption listed, no cue", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home-v2");
    await expect(bell(page)).toHaveText("4");
    await expect(page.locator('[data-piece="kpi-3"] [data-count-to]')).toHaveText("236");
    await expect(page.locator(".db__caption:visible")).toHaveCount(5);
    await expect(cue(page)).toBeHidden();
    // Not pinned and not a clipped window: the whole dashboard simply flows down the page.
    const layout = await page.evaluate(() => ({
      sticky: getComputedStyle(document.querySelector(".db__sticky")!).position,
      overflow: getComputedStyle(document.querySelector(".db__stage")!).overflow,
      transform: getComputedStyle(document.querySelector("[data-camera]")!).transform,
    }));
    expect(layout).toEqual({ sticky: "static", overflow: "visible", transform: "none" });
  });
});
