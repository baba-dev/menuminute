import { expect, test } from "@playwright/test";

test("failed outlet setup keeps the retry key for identical input and changes it for edited input", async ({
  page,
}) => {
  const email = `phase4-${crypto.randomUUID()}@browser.invalid`;
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Phase Four Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("phase4-password-123");
  await page.getByLabel("Confirm password").fill("phase4-password-123");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  const observed: { key: string; body: string }[] = [];
  await page.route("**/api/organizations", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    observed.push({
      key: request.headers()["idempotency-key"] ?? "",
      body: request.postData() ?? "",
    });
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
  await expect(page.getByRole("alert")).toContainText("Your entries are preserved");
  await expect(page.getByLabel("Outlet name")).toHaveValue("Phase Four Kitchen");

  await page.getByLabel("Outlet name").fill("Phase Four Kitchen Updated");
  await submit.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard\/menu/);

  expect(observed).toHaveLength(3);
  expect(observed[0]!.key).toBeTruthy();
  expect(observed[0]!.key).not.toBe(observed[1]!.key);
  expect(observed[1]!.key).toBe(observed[2]!.key);
  expect(observed[1]!.body).toBe(observed[2]!.body);
});
