import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const sec = (page: Page) => page.locator("[data-testid=pdf-to-menu]");

async function open(page: Page) {
  await page.goto("/home-v2");
  await sec(page).locator(".pm-source").scrollIntoViewIfNeeded();
  await expect(sec(page)).toHaveAttribute("data-ready", "true");
}

async function review(page: Page) {
  await open(page);
  await sec(page).getByRole("button", { name: "Upload the sample PDF" }).click();
  await expect(sec(page)).toHaveAttribute("data-phase", "review", { timeout: 8000 });
}

test.describe("home-v2 pdf to menu", () => {
  test("uploading reads the menu into a draft for review", async ({ page }) => {
    await review(page);
    await expect(sec(page).locator(".pm-row")).toHaveCount(4);
    await expect(sec(page).getByRole("button", { name: "Publish menu" })).toBeDisabled();
  });

  test("an unreadable price must be entered before that dish can be confirmed", async ({
    page,
  }) => {
    await review(page);
    const confirm = sec(page).getByRole("button", { name: "Confirm Amritsari Fish" });
    await expect(confirm).toBeDisabled();
    await sec(page).getByLabel("Price in rupees for Amritsari Fish").fill("359");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(sec(page).getByRole("button", { name: "Unconfirm Amritsari Fish" })).toBeVisible();
    // Editing a confirmed price re-opens it.
    await sec(page).getByLabel("Price in rupees for Amritsari Fish").fill("369");
    await expect(sec(page).getByRole("button", { name: "Confirm Amritsari Fish" })).toBeVisible();
  });

  test("only the owner can publish, and only after every dish is confirmed", async ({ page }) => {
    await review(page);
    const publish = sec(page).getByRole("button", { name: "Publish menu" });
    await sec(page).getByLabel("Price in rupees for Amritsari Fish").fill("359");
    for (const name of ["Butter Chicken", "Biryani", "Chettinad Chicken"]) {
      await sec(page)
        .getByRole("button", { name: `Confirm ${name}` })
        .click();
      await expect(publish).toBeDisabled();
    }
    await sec(page).getByRole("button", { name: "Confirm Amritsari Fish" }).click();
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(sec(page)).toHaveAttribute("data-phase", "published");
    await expect(sec(page).locator(".pm-pill")).toHaveText("Live");
    await expect(sec(page).locator(".pm-live img")).toBeVisible();
    await expect(sec(page).getByText("The scanner never does.")).toBeVisible();

    await sec(page).getByRole("button", { name: "Reset the preview" }).click();
    await expect(sec(page)).toHaveAttribute("data-phase", "idle");
  });

  test("focusing a dish shows where it was read on the source", async ({ page }) => {
    await review(page);
    await sec(page).getByRole("button", { name: "Confirm Biryani" }).focus();
    await expect(sec(page).locator(".pm-hit")).toHaveCount(1);
  });

  test("states what it is: a scripted sample, open to every outlet", async ({ page }) => {
    await open(page);
    const text = await sec(page).innerText();
    expect(text).toMatch(/no file is uploaded or processed/i);
    expect(text).toMatch(/available to every outlet/i);
    const hrefs = await sec(page)
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const href of hrefs) {
      expect(["/help/owner/ai-menu-import", "/docs/menu-import", "/register"]).toContain(href);
    }
  });

  test("has no horizontal overflow and no axe violations in review", async ({ page }) => {
    await review(page);
    for (const reveal of await sec(page).locator("[data-reveal]").all()) {
      await reveal.scrollIntoViewIfNeeded();
    }
    await expect(sec(page).locator("[data-reveal]:not([data-in])")).toHaveCount(0);
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .include("[data-testid=pdf-to-menu]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("reduced motion goes straight to review and keeps controls working", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/home-v2");
    await sec(page).locator(".pm-source").scrollIntoViewIfNeeded();
    await expect(sec(page)).toHaveAttribute("data-phase", "review", { timeout: 8000 });
    await sec(page).getByRole("button", { name: "Confirm Biryani" }).click();
    await expect(sec(page).getByRole("button", { name: "Unconfirm Biryani" })).toBeVisible();
    await context.close();
  });
});
