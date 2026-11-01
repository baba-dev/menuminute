import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const board = (page: Page) => page.locator("[data-testid=kitchen-board]");
const ticket = (page: Page) => page.locator("[data-testid=ticket-t-11]");

async function open(page: Page) {
  await page.goto("/home-v2");
  await board(page).locator(".kb-board").scrollIntoViewIfNeeded();
  await expect(board(page)).toHaveAttribute("data-ready", "true");
}

test.describe("home-v2 kitchen board", () => {
  test("a ticket moves through the stages and the guest view follows", async ({ page }) => {
    await open(page);
    await expect(board(page)).toHaveAttribute("data-focus-stage", "new");
    await ticket(page).getByRole("button", { name: "Accept Table 11 ticket" }).click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "preparing");

    const markReady = ticket(page).getByRole("button", { name: "Mark ready Table 11 ticket" });
    await expect(markReady).toBeDisabled();
    for (const line of await ticket(page).locator("button.kb-line").all()) await line.click();
    await expect(markReady).toBeEnabled();
    await markReady.click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "ready");
    await expect(board(page).locator(".kb-guest__msg")).toHaveText("Your order is ready");

    await ticket(page).getByRole("button", { name: "Serve Table 11 ticket" }).click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "served");
    await expect(ticket(page)).toHaveCount(0);
    await expect(board(page).locator(".kb-stats strong").nth(2)).toContainText("1");
  });

  test("watch it run plays the whole order, and reset restores it", async ({ page }) => {
    await open(page);
    await board(page).getByRole("button", { name: "Watch it run" }).click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "served", { timeout: 15000 });
    await board(page).getByRole("button", { name: "Reset" }).click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "new");
    await expect(ticket(page)).toHaveCount(1);
  });

  test("ticket age shows a word as well as a colour", async ({ page }) => {
    await open(page);
    await expect(page.locator("[data-testid=ticket-t-04] .kb-age b")).toHaveText("Due soon");
    await expect(ticket(page).locator(".kb-age b")).toHaveText("On time");
  });

  test("makes no availability promise and links only to public pages", async ({ page }) => {
    await open(page);
    const text = await board(page).innerText();
    expect(text).toMatch(/Kitchen Pro is in development/i);
    const hrefs = await board(page)
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const href of hrefs) expect(["/help/owner", "/demo", "/pricing"]).toContain(href);
  });

  test("has no horizontal overflow and no axe violations", async ({ page }) => {
    await open(page);
    for (const reveal of await board(page).locator("[data-reveal]").all()) {
      await reveal.scrollIntoViewIfNeeded();
    }
    await expect(board(page).locator("[data-reveal]:not([data-in])")).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .include("[data-testid=kitchen-board]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("reduced motion keeps every control working", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/home-v2");
    await ticket(page).getByRole("button", { name: "Accept Table 11 ticket" }).click();
    await expect(board(page)).toHaveAttribute("data-focus-stage", "preparing");
    await expect(board(page).locator(".kb-confetti")).toHaveCount(0);
    await context.close();
  });
});
