import { test, expect } from "@playwright/test";
import { TERMS_VERSION } from "../../src/content/legal";

test("signup requires affirmative current-version consent before creating any account", async ({
  page,
}) => {
  const email = "consent-" + crypto.randomUUID() + "@browser.invalid";
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "https://localhost:3443" },
    data: {
      name: "Consent Candidate",
      email,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: "1995-01-01T00:00:00.000Z",
    },
  });
  expect(response.status()).toBe(422);
});

test("unauthenticated entry paths return to login safely", async ({ page }) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/join-team");
  await expect(page).toHaveURL(/\/login/);
});
