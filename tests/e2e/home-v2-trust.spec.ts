import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const sec = (page: Page) => page.locator("[data-testid=trust-section]");
const verdict = (page: Page) => sec(page).locator(".tr-verdict");
const outcome = (page: Page) => sec(page).locator(".tr-checkout .tr-outcome");

async function open(page: Page) {
  await page.goto("/home-v2");
  await sec(page).locator(".tr-access").scrollIntoViewIfNeeded();
  await expect(sec(page)).toHaveAttribute("data-ready", "true");
}

test.describe("home-v2 trust section", () => {
  test("access check allows what a role allows and blocks the rest", async ({ page }) => {
    await open(page);
    await expect(verdict(page)).toContainText("Allowed");
    await sec(page).getByRole("button", { name: /^Dev/ }).click();
    await expect(verdict(page)).toContainText("Blocked (403)");
    await sec(page).getByRole("button", { name: /^Fran/ }).click();
    await expect(verdict(page)).toContainText("access was removed");
    await sec(page).getByRole("button", { name: /^Gus/ }).click();
    await expect(verdict(page)).toContainText("not a member of this restaurant");
    await sec(page).getByRole("button", { name: /^Chen/ }).click();
    await sec(page).getByRole("button", { name: "Outlet B" }).click();
    await expect(verdict(page)).toContainText("no access at Spice Route · Outlet B");
    await sec(page).getByRole("button", { name: /^Asha/ }).click();
    await sec(page).getByLabel("Action").selectOption("billing.manage");
    await expect(verdict(page)).toContainText("Allowed");
  });

  test("checkout creates one order per key and refuses tampering", async ({ page }) => {
    await open(page);
    const send = sec(page).getByRole("button", { name: "Send order" });
    await send.click();
    await expect(outcome(page)).toContainText("201 Created");
    await expect(outcome(page)).toContainText("Order #1042 created");
    await send.click();
    await expect(outcome(page)).toContainText("200 Same order");
    await expect(sec(page).locator(".tr-counters")).toContainText("Taps");

    await sec(page).getByRole("button", { name: "Increase quantity" }).click();
    await send.click();
    await expect(outcome(page)).toContainText("Submission key reused with a different cart.");

    await sec(page).getByRole("button", { name: "New key" }).click();
    await sec(page).getByLabel("Total the phone sends").fill("1");
    await send.click();
    await expect(outcome(page)).toContainText("Your cart price has changed");
    await sec(page).getByLabel("Total the phone sends").fill("798");
    await send.click();
    await expect(outcome(page)).toContainText("Order #1043 created");
    await expect(sec(page).locator(".tr-counters .mm-roll__sr").nth(1)).toHaveText("2");
  });

  test("an order with history cannot be deleted", async ({ page }) => {
    await open(page);
    await sec(page).getByRole("button", { name: "Try to delete this order" }).click();
    await expect(sec(page).locator(".tr-history .tr-outcome")).toContainText("Refused");
    await expect(sec(page).locator(".tr-ledger li")).toHaveCount(5);
  });

  test("claims no certifications and links only to existing pages", async ({ page }) => {
    await open(page);
    const text = await sec(page).innerText();
    expect(text).toMatch(/no certifications, uptime figures or compliance/i);
    expect(text).not.toMatch(/SOC ?2|ISO ?27001|GDPR|HIPAA|uptime guarantee|100%/i);
    const hrefs = await sec(page)
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const href of hrefs) {
      expect([
        "/docs/organization",
        "/demo",
        "/help/owner/ai-menu-import",
        "/privacy",
        "/terms",
      ]).toContain(href);
    }
  });

  test("has no horizontal overflow and no axe violations", async ({ page }) => {
    await open(page);
    for (const reveal of await sec(page).locator("[data-reveal]").all()) {
      await reveal.scrollIntoViewIfNeeded();
    }
    await expect(sec(page).locator("[data-reveal]:not([data-in])")).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .include("[data-testid=trust-section]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("reduced motion keeps every demo working", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/home-v2");
    await sec(page).getByRole("button", { name: /^Gus/ }).click();
    await expect(verdict(page)).toContainText("Blocked (403)");
    await sec(page).getByRole("button", { name: "Send order" }).click();
    await expect(outcome(page)).toContainText("201 Created");
    await context.close();
  });
});
