import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const section = (page: Page) => page.locator("[data-testid=scan-to-order]");

async function open(page: Page) {
  await page.goto("/home-v2");
  await section(page).locator(".sto-stage").scrollIntoViewIfNeeded();
  await expect(section(page)).toHaveAttribute("data-ready", "true");
}

test.describe("home-v2 scan to order", () => {
  test("scanning reveals the sample menu", async ({ page }) => {
    await open(page);
    await section(page).getByRole("button", { name: "Scan the QR" }).click();
    await expect(section(page)).toHaveAttribute("data-scanned", "true");
    await expect(section(page).getByRole("button", { name: /^Butter Chicken/ })).toBeVisible();
  });

  test("adds dishes, reorders by price, sends to the kitchen tile and resets", async ({ page }) => {
    await open(page);
    await section(page).getByRole("button", { name: "Scan the QR" }).click();
    await section(page)
      .getByRole("button", { name: /Add Butter Chicken/ })
      .click();
    await section(page)
      .getByRole("button", { name: /^Biryani/ })
      .click();
    await section(page).getByRole("button", { name: "Increase quantity" }).click();
    await section(page)
      .getByRole("button", { name: /^Add 2/ })
      .click();
    await expect(section(page).getByRole("dialog")).toHaveCount(0);

    await section(page).getByRole("button", { name: "Price: low to high" }).click();
    const names = await section(page).locator(".sto-dish__name").allInnerTexts();
    expect(names[0]).toBe("Biryani");

    const tickets = section(page).locator(".sto-ticket");
    await expect(tickets).toHaveCount(2);
    await section(page).getByRole("button", { name: "Send to kitchen" }).click();
    await expect(section(page).locator(".sto-kitchen strong .mm-roll__sr")).toHaveText("1");
    await expect(section(page).getByRole("button", { name: /Add Biryani/ })).toBeDisabled();

    await section(page).getByRole("button", { name: "Reset the preview" }).click();
    await expect(section(page).locator(".sto-kitchen strong .mm-roll__sr")).toHaveText("0");
    await expect(tickets).toHaveCount(0);
  });

  test("the dish sheet is keyboard operable and closes with Escape", async ({ page }) => {
    await open(page);
    await section(page).getByRole("button", { name: "Scan the QR" }).click();
    const opener = section(page).getByRole("button", { name: /^Chettinad Chicken/ });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = section(page).getByRole("dialog", { name: /Chettinad Chicken/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close dish details" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("makes no dietary claims and links only to public pages", async ({ page }) => {
    await open(page);
    const text = await section(page).innerText();
    expect(text).not.toMatch(/vegan|vegetarian|gluten|halal|allergen-free/i);
    expect(text).toMatch(/No real orders or payments are placed/i);
    const hrefs = await section(page)
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const href of hrefs) expect(["/help/owner", "/demo", "/pricing"]).toContain(href);
  });

  test("has no horizontal overflow and no axe violations", async ({ page }) => {
    await open(page);
    // Let every first-reveal fade finish: axe must not sample a half-transparent card.
    for (const reveal of await section(page).locator("[data-reveal]").all()) {
      await reveal.scrollIntoViewIfNeeded();
    }
    await expect(section(page).locator("[data-reveal]:not([data-in])")).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .include("[data-testid=scan-to-order]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("reduced motion shows the menu immediately and keeps controls working", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/home-v2");
    await expect(section(page)).toHaveAttribute("data-scanned", "true");
    await expect(section(page).locator(".sto-scan")).toBeHidden();
    await section(page)
      .getByRole("button", { name: /Add Biryani/ })
      .click();
    await expect(section(page).locator(".sto-ticket")).toHaveCount(1);
    await context.close();
  });
});
