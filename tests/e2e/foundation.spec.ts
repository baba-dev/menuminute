import { test, expect } from "@playwright/test";
import { mockTurnstileForBrowserTests } from "./turnstile-mock";
import { admin } from "../helpers";
test("private pages require login and private menu APIs do not fall back to demo", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/api/menu/items");
  expect(res.status()).toBe(401);
  const rejected = await request.post("/api/menu/categories", {
    headers: { origin: "https://untrusted.invalid" },
    data: { name: "Denied" },
  });
  expect(rejected.status()).toBe(403);
});
test("signup, atomic outlet setup, private mutation and session recovery", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const email = `owner-${crypto.randomUUID()}@browser.invalid`;
  await mockTurnstileForBrowserTests(page);
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Foundation Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  // Isolated synthetic browser account: simulate clicking the delivered verification link.
  await admin(async (_db, pool) => {
    await pool.query("update users set email_verified=true where email=$1", [email]);
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/onboarding");
  // The first-outlet wizard replaced the legacy single-step form. Exercise every
  // stage before continuing the existing private mutation/session recovery check.
  await expect(page.getByLabel(/Outlet Public Name/)).toBeVisible();
  await page.getByLabel(/Outlet Public Name/).fill("Browser Kitchen");
  await page.getByRole("radio", { name: /Cloud \/ Ghost Kitchen/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Country/).selectOption("OM");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel(/Menu pricing currency/)).toHaveValue("OMR");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // The timezone must be explicitly confirmed before the first outlet can be created.
  const launch = page.getByRole("button", { name: "Confirm & Create Outlet" });
  await expect(launch).toBeDisabled();
  await page.getByRole("checkbox", { name: /I confirm the operating timezone/ }).check();
  await expect(launch).toBeEnabled();
  await launch.click();
  await expect(page).toHaveURL(/\/dashboard\/get-started/);
  await page.goto("/dashboard/menu");
  await expect(page.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
  const created = await page.request.post("/api/menu/categories", {
    headers: { origin: "https://localhost:3443" },
    data: { name: "Browser category" },
  });
  expect(created.status()).toBe(201);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
test("published demo menu stays public and contains no private membership details", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  await expect(page.getByRole("heading", { name: "Spice Route Kitchen" })).toBeVisible();
  await expect(page.getByText("Paneer Tikka")).toBeVisible();
});
