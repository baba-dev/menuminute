import { expect, test } from "@playwright/test";
import { mockTurnstileForBrowserTests } from "./turnstile-mock";

// A deterministic non-Indian browser locale verifies worldwide first-outlet defaults.
test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("QR-only Quick Start resumes its compact flow and reaches the first menu milestone", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await mockTurnstileForBrowserTests(page);

  const email = `quick-menu-${crypto.randomUUID()}@browser.invalid`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("QR Menu Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("quick-menu-secure-password-123");
  await page.getByLabel("Confirm password").fill("quick-menu-secure-password-123");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.goto("/onboarding?quick=1");
  await expect(page.getByRole("heading", { name: "What should we call your menu?" })).toBeVisible();
  await expect(page.locator(".wizard-step-node")).toHaveCount(3);
  await page.getByLabel("Restaurant name *").fill("Quick Menu Bakery");
  await page.getByLabel("Type of food business").selectOption("cafe");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Choose your restaurant region." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose your restaurant region." })).toBeVisible();
  await expect(page.getByLabel("Restaurant country *")).toHaveValue("US");
  await expect(page.getByLabel("Menu pricing currency *")).toHaveValue("USD");
  // Unmapped countries must not inherit the currency of a previous country.
  await page.getByLabel("Restaurant country *").selectOption("BW");
  await expect(page.getByLabel("Menu pricing currency *")).toHaveValue("");
  await page.getByLabel("Menu pricing currency *").selectOption("BWP");
  await expect(page.getByText("Auto-saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Restaurant country *")).toHaveValue("BW");
  await expect(page.getByLabel("Menu pricing currency *")).toHaveValue("BWP");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Review your outlet details." })).toBeVisible();
  await page.getByRole("checkbox", { name: /I confirm the operating timezone/ }).check();
  await page.getByRole("checkbox", { name: /I confirm BWP is the currency/ }).check();
  await page.getByRole("button", { name: "Confirm & Create Outlet" }).click();
  await expect(page).toHaveURL(/\/dashboard\/get-started/);
  await expect(page.getByRole("link", { name: "Add your first dish" })).toBeVisible();
  const status = await (await page.request.get("/api/onboarding")).json();
  expect(status.status).toBe("completed");
});
