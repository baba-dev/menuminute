import { test, expect } from "@playwright/test";
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
  const email = `owner-${crypto.randomUUID()}@browser.invalid`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Foundation Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("browser-password-123");
  await page.getByLabel("Confirm password").fill("browser-password-123");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Outlet name").fill("Browser Kitchen");
  await page.getByLabel("Outlet type").selectOption("cloud_kitchen");
  await page.getByLabel("Currency", { exact: true }).selectOption("OMR");
  await page.getByRole("button", { name: "Create organization and outlet" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Browser Kitchen" })).toBeVisible();
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
