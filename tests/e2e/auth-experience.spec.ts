import { test, expect } from "@playwright/test";
import { mockTurnstileForBrowserTests } from "./turnstile-mock";
test("auth screens expose validated fields, legal links, theme switching and keyboard-friendly focus", async ({
  page,
}) => {
  await mockTurnstileForBrowserTests(page);
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" }).first()).toHaveAttribute(
    "href",
    "/terms"
  );
  await expect(page.getByRole("link", { name: "Privacy Policy" }).first()).toHaveAttribute(
    "href",
    "/privacy"
  );
  await expect(page.getByRole("checkbox", { name: /I agree to the/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  const dark = page.getByRole("button", { name: "Switch to dark mode" });
  if (await dark.isVisible()) await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
test("reduced motion and narrow view retain accessible form without horizontal overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.locator("#auth-content")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
});


test("Android-sized login exposes signup above the fold and keeps the app return target", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login?next=%2Fapp");
  const create = page.getByRole("link", { name: "Create a free account" });
  await expect(create).toBeVisible();
  await expect(create).toBeInViewport();
  await expect(create).toHaveAttribute("href", "/register?next=%2Fapp");
  await create.click();
  await expect(page).toHaveURL(/\/register\?next=%2Fapp/);
  await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
  const consent = page.getByRole("checkbox", { name: /I agree to the/ });
  await expect(consent).toBeVisible();
  const google = page.getByRole("button", { name: "Continue with Google" });
  if (await google.count()) {
    await expect(google).toBeDisabled();
    await consent.check();
    await expect(google).toBeEnabled();
  }
  await expect(page.getByRole("button", { name: "Create free account" })).toBeVisible();
});

test("Google signup stays accessible on small and large phone screens", async ({ page }) => {
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/login");
    const create = page.getByRole("link", { name: "Create a free account" });
    await expect(create).toBeInViewport();
    const bounds = await create.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
