import { expect, test } from "@playwright/test";
import { admin } from "../helpers";

test("failed outlet setup keeps the retry key for identical input and changes it for edited input", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const email = `phase4-${crypto.randomUUID()}@browser.invalid`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Phase Four Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("phase4-password-123");
  await page.getByLabel("Confirm password").fill("phase4-password-123");
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await admin(async (_db, pool) => {
    await pool.query("update users set email_verified=true where email=$1", [email]);
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("phase4-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/onboarding");
  await expect(page.getByLabel("Outlet name")).toBeVisible();

  const observed: number[] = [];
  await page.route("**/api/onboarding", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    observed.push(observed.length + 1);
    if (observed.length < 3) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Synthetic temporary failure" }),
      });
    } else {
      await route.continue();
    }
  });

  const submit = page.getByRole("button", { name: "Create organization and outlet" });
  await page.getByLabel("Outlet name").fill("Phase Four Kitchen");
  await submit.click();
  await expect(page.locator('form[aria-busy] [role="alert"]')).toBeVisible();
  await expect(page.getByLabel("Outlet name")).toHaveValue("Phase Four Kitchen");
  const first = await (await page.request.get("/api/onboarding")).json();

  await page.getByLabel("Outlet name").fill("Phase Four Kitchen Updated");
  await submit.click();
  await expect(page.locator('form[aria-busy] [role="alert"]')).toBeVisible();
  const revised = await (await page.request.get("/api/onboarding")).json();
  expect(revised.key).not.toBe(first.key);
  await page.reload();
  await expect(page.getByLabel("Outlet name")).toHaveValue("Phase Four Kitchen Updated");
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard\/menu/);
  expect(observed).toHaveLength(3);
  expect(revised.status).toBe("draft");
  const completed = await (await page.request.get("/api/onboarding")).json();
  expect(completed.status).toBe("completed");
  expect(completed.key).toBe(revised.key);
});
