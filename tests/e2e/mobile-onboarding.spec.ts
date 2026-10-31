import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { mockTurnstileForBrowserTests } from "./turnstile-mock";

// Phone-first acceptance for signup -> setup -> first dashboard. Set AUDIT_OUT to also save
// screenshots of every stage.
const SIZES = [
  { name: "pixel5-393x851", width: 393, height: 851 },
  { name: "iphoneSE-375x667", width: 375, height: 667 },
  { name: "small-320x568", width: 320, height: 568 },
];
const ONE_MINUTE_MS = 60_000;

/** Elements (outside aria-hidden art and fixed chrome) that spill past the viewport edge. */
async function overflowOffenders(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push("document scrolls horizontally");
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.width === 0 || b.height === 0 || cs.visibility === "hidden" || cs.display === "none")
        continue;
      if (el.closest("[aria-hidden='true']") || cs.position === "fixed") continue;
      if (b.right > vw + 1 || b.left < -1)
        out.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 40));
    }
    return out;
  });
}

/** Text-entry controls that would trigger iOS Safari's focus-zoom (font-size < 16px). */
async function zoomTriggers(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=color]),select,textarea"
      )
    )
      .filter(
        (el) =>
          el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16
      )
      .map((el) => el.id || el.tagName)
  );
}

async function expectTouchTarget(page: Page, locator: ReturnType<Page["locator"]>, label: string) {
  const box = await locator.first().boundingBox();
  expect(box, label + " is rendered").not.toBeNull();
  expect(box!.height, label + " height").toBeGreaterThanOrEqual(43.5);
  expect(box!.width, label + " width").toBeGreaterThanOrEqual(43.5);
}

for (const size of SIZES) {
  test(`phone journey ${size.name}: signup to working dashboard under a minute`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "phone viewports only");
    test.setTimeout(150_000);
    const shots = process.env["AUDIT_OUT"] ? `${process.env["AUDIT_OUT"]}/${size.name}` : null;
    if (shots) mkdirSync(shots, { recursive: true });
    const snap = async (name: string) => {
      if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
    };
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
    await mockTurnstileForBrowserTests(page);
    const email = `mobile-${crypto.randomUUID()}@browser.invalid`;
    const pw = "mobile-secure-password-123";

    // --- Register -----------------------------------------------------------------------------
    await page.goto("/register");
    expect(await overflowOffenders(page), "register overflow").toEqual([]);
    expect(await zoomTriggers(page), "register zoom triggers").toEqual([]);
    await snap("01-register");
    await page.getByRole("button", { name: "Create free account" }).click();
    // Field errors must not pollute the accessible name of the input they describe.
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await snap("02-register-errors");
    await page.getByLabel("Your name").fill("Mobile Owner");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(pw);
    await page.getByLabel("Confirm password").fill(pw);
    await page.getByRole("checkbox", { name: /I agree to the/ }).check();
    await expectTouchTarget(
      page,
      page.getByRole("button", { name: "Create free account" }),
      "register submit"
    );
    const startedAt = Date.now();
    await page.getByRole("button", { name: "Create free account" }).click();

    // --- Straight into setup, signed in, with a nag to verify --------------------------------
    await expect(page).toHaveURL(/\/onboarding/);
    const banner = page.getByTestId("verify-email-banner");
    await expect(banner).toContainText(email);
    expect(await overflowOffenders(page), "onboarding+banner overflow").toEqual([]);
    await expectTouchTarget(page, banner.getByRole("button"), "verify banner resend");

    // Typing immediately must never be lost to the saved-progress restore.
    const name = page.getByLabel(/Outlet Public Name/);
    await name.fill("Mobile Bistro");
    await expect(name).toHaveValue("Mobile Bistro");
    await page.waitForTimeout(1200);
    await expect(name).toHaveValue("Mobile Bistro");

    // --- Wizard steps ------------------------------------------------------------------------
    const next = page.getByRole("button", { name: "Continue" });
    for (const step of [1, 2, 3, 4]) {
      if (step === 1) {
        // The primary action is reachable without scrolling a 2,000px form.
        const box = await next.boundingBox();
        expect(box!.y + box!.height, "Continue sits inside the viewport").toBeLessThanOrEqual(
          size.height + 1
        );
        await expectTouchTarget(page, next, "Continue");
        await expectTouchTarget(page, page.locator(".wizard-step-node").first(), "stepper node");
      }
      expect(await overflowOffenders(page), `wizard step ${step} overflow`).toEqual([]);
      expect(await zoomTriggers(page), `wizard step ${step} zoom triggers`).toEqual([]);
      await snap(`03-wizard-step-${step}`);
      if (step < 4) await next.click();
    }

    // Step 4: an invalid email shows its error where the user is looking.
    const contactEmail = page.locator("#wz-email");
    await contactEmail.fill("not-an-email");
    await next.click();
    const error = page.locator('.wizard-error-banner[role="alert"]').first();
    await expect(error).toBeVisible();
    await expect(error).toBeInViewport({ ratio: 0.9 });
    await snap("04-wizard-error");
    await contactEmail.fill("");
    await next.click();

    await expect(page.getByRole("heading", { name: "Review your outlet details." })).toBeVisible();
    expect(await overflowOffenders(page), "review overflow").toEqual([]);
    await page.getByRole("checkbox", { name: /I confirm the operating timezone/ }).check();
    await page.getByRole("checkbox", { name: /I confirm INR is the currency/ }).check();
    await snap("05-review");
    const launch = page.getByRole("button", { name: "Confirm & Create Outlet" });
    await expect(launch).toBeInViewport({ ratio: 1 });
    // Fully visible is not enough: nothing (e.g. another sticky bar) may sit on top of it.
    const covered = await launch.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !(hit === el || el.contains(hit));
    });
    expect(covered, "launch button is not covered by another bar").toBe(false);
    await launch.click();
    await expect(page).toHaveURL(/\/dashboard\/get-started/);
    expect(await overflowOffenders(page), "get-started overflow").toEqual([]);
    await snap("06-get-started");

    // --- First dashboard ---------------------------------------------------------------------
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Let’s add your first dish"
    );
    const elapsed = Date.now() - startedAt;
    expect(elapsed, "signup to working dashboard (ms)").toBeLessThan(ONE_MINUTE_MS);
    await expect(page.getByText(/Welcome back to/)).toHaveCount(0);
    await expect(page.getByTestId("verify-email-banner")).toBeVisible();
    // The checklist stays reachable from the dashboard itself.
    const setupCard = page.locator(".mm-setup-card");
    await expect(setupCard).toBeVisible();
    await expect(setupCard.getByRole("link", { name: "View full checklist" })).toHaveAttribute(
      "href",
      "/dashboard/get-started"
    );
    await expect(
      page
        .locator(".mm-dashboard-kpi")
        .filter({ hasText: "Menus to publish" })
        .locator(".mm-dashboard-kpi-value")
    ).toHaveText("0");
    // A brand-new floor of idle tables is collapsed, not ten identical cards.
    await expect(page.locator(".mm-ops-collapsible > summary")).toBeVisible();
    expect(await overflowOffenders(page), "dashboard overflow").toEqual([]);
    await snap("07-dashboard-first-run");

    // Nagging banner: resend is available and rate-limited client-side.
    await page
      .getByTestId("verify-email-banner")
      .getByRole("button", { name: "Resend email" })
      .click();
    await expect(page.getByTestId("verify-email-banner")).toContainText(/Resend in \d+s/);
    await snap("08-banner-resent");
  });
}

test("unverified owner keeps working; verified-only actions are refused", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await mockTurnstileForBrowserTests(page);
  const email = `gate-${crypto.randomUUID()}@browser.invalid`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Gate Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("gate-secure-password-123");
  await page.getByLabel("Confirm password").fill("gate-secure-password-123");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  // Session is real: the signed-in user can read their own context without verification.
  const ctx = await page.request.get("/api/context");
  expect(ctx.ok()).toBe(true);
  // Billing checkout is a verified-only action.
  const denied = await page.request.post("/api/organizations/org-x/billing/checkout", {
    headers: { origin: "https://localhost:3443" },
    data: {},
  });
  expect([401, 403]).toContain(denied.status());
});
