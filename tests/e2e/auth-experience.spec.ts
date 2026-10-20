import { test, expect } from "@playwright/test";
test("auth screens expose validated fields, legal links, theme switching and keyboard-friendly focus", async ({
  page,
}) => {
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
  await expect(page.getByText(/draft, which is not yet effective/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /I agree to the/ })).toHaveCount(0);
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
