import { expect, test, type Page } from "@playwright/test";

/** Scroll the pinned section to progress `p` (0..1) and wait for the eased value to settle. */
async function scrollToProgress(page: Page, p: number) {
  await page.evaluate((target) => {
    const section = document.querySelector<HTMLElement>(".db")!;
    const travel = section.offsetHeight - window.innerHeight;
    window.scrollTo(0, section.offsetTop + travel * target);
  }, p);
  await expect
    .poll(async () => Number(await page.locator(".db").getAttribute("data-p")), { timeout: 5000 })
    .toBeCloseTo(p, 2);
}

const bell = (page: Page) => page.locator(".mm-topbar-bell-badge");
const stage = (page: Page) => page.locator(".db__stage");

test.describe("home-v2 scroll-assembled dashboard", () => {
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

  test("the new order lands, and un-lands when scrolling back", async ({ page }) => {
    await page.goto("/home-v2");
    const awaiting = page.locator("[data-beat-add]");
    const newTable = page.locator('li[data-beat="table"] span[data-beat="table"]');
    await scrollToProgress(page, 0.8);
    await expect(bell(page)).toHaveText("3");
    await expect(awaiting).toHaveText("3");
    await expect(newTable).toHaveText("No open tickets");
    await scrollToProgress(page, 1);
    await expect(bell(page)).toHaveText("4");
    await expect(awaiting).toHaveText("4");
    await expect(newTable).toHaveText("Order active");
    await scrollToProgress(page, 0.8);
    await expect(bell(page)).toHaveText("3");
    await expect(newTable).toHaveText("No open tickets");
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

  test("shows no horizontal overflow and no console errors", async ({ page }) => {
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

  test("reduced motion: no pin, finished page, every caption listed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home-v2");
    await expect(bell(page)).toHaveText("4");
    await expect(page.locator('[data-piece="kpi-3"] [data-count-to]')).toHaveText("236");
    await expect(page.locator(".db__caption:visible")).toHaveCount(5);
    // Not pinned and not a clipped window: the whole dashboard simply flows down the page.
    const layout = await page.evaluate(() => ({
      sticky: getComputedStyle(document.querySelector(".db__sticky")!).position,
      overflow: getComputedStyle(document.querySelector(".db__stage")!).overflow,
      transform: getComputedStyle(document.querySelector("[data-camera]")!).transform,
    }));
    expect(layout).toEqual({ sticky: "static", overflow: "visible", transform: "none" });
  });
});
