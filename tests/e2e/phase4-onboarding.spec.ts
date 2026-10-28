import { expect, test } from "@playwright/test";
import { mockTurnstileForBrowserTests } from "./turnstile-mock";
import { admin } from "../helpers";

test("first-outlet wizard resumes a saved draft, recovers from failure and opens guided setup", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const email = `onboarding-${crypto.randomUUID()}@browser.invalid`;
  await mockTurnstileForBrowserTests(page);
  await page.goto("/register");
  await page.getByLabel("Your name").fill("First Outlet Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("onboarding-secure-password-123");
  await page.getByLabel("Confirm password").fill("onboarding-secure-password-123");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await admin(async (_, pool) =>
    pool.query("update users set email_verified=true where email=$1", [email])
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("onboarding-secure-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/start/);
  await expect(page.getByRole("link", { name: /Create my first restaurant/ })).toBeVisible();
  await page.getByRole("link", { name: /Create my first restaurant/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByLabel(/Outlet Public Name/)).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".wizard-mobile-step-pill")).toHaveText("Step 1 of 5");
  }
  await page.getByLabel(/Outlet Public Name/).fill("Kitchen for Guided Setup");
  await page.getByRole("radio", { name: /Online Ordering/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where is your outlet located?" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".wizard-mobile-step-pill")).toHaveText("Step 2 of 5");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "How will your restaurant operate?" })
  ).toBeVisible();
  await expect(page.getByLabel("Operating timezone *")).toHaveValue("Asia/Kolkata");
  await expect(page.getByText(/Restaurant local time:/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review your outlet details." })).toBeVisible();
  let requests = 0;
  await page.route("**/api/onboarding", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    if (requests === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary provisioning error" }),
      });
    return route.continue();
  });
  await page.getByRole("checkbox", { name: /I confirm the operating timezone/ }).check();
  await page.getByRole("checkbox", { name: /I confirm INR is the currency/ }).check();
  await page.getByRole("button", { name: "Confirm & Create Outlet" }).click();
  await expect(page.locator('.wizard-error-banner[role="alert"]')).toContainText(
    "Temporary provisioning error"
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Review your outlet details." })).toBeVisible();
  // Consent is intentionally not persisted after a reload or a failed attempt.
  const recoveredLaunch = page.getByRole("button", { name: "Confirm & Create Outlet" });
  await expect(recoveredLaunch).toBeDisabled();
  await page.getByRole("checkbox", { name: /I confirm the operating timezone/ }).check();
  await expect(recoveredLaunch).toBeEnabled();
  await page.getByRole("checkbox", { name: /I confirm INR is the currency/ }).check();
  await recoveredLaunch.click();
  await expect(page).toHaveURL(/\/dashboard\/get-started/);
  await expect(page.getByText("Kitchen for Guided Setup").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Import your existing menu/ })).toBeVisible();
  expect(requests).toBe(2);
  const progress = await (await page.request.get("/api/onboarding")).json();
  expect(progress.status).toBe("completed");
});
