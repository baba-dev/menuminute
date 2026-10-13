import { test, expect } from "@playwright/test";

test.describe("MenuMinute End-to-End Smoke Tests", () => {
  test("Homepage loads with branding, hero, and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MenuMinute/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your menu, beautifully digital"
    );
    await expect(page.getByRole("link", { name: "Create your free menu" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View live demo" })).toBeVisible();
  });

  test("Pricing page displays all 3 product tiers correctly", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Simple, transparent pricing"
    );
    await expect(page.getByText("Free Forever")).toBeVisible();
    await expect(page.getByText("Online Ordering")).toBeVisible();
    await expect(page.getByText("Kitchen Pro")).toBeVisible();
    await expect(page.getByText("₹149")).toBeVisible();
    await expect(page.getByText("₹299")).toBeVisible();
  });

  test("Demo page displays live QR code and sample showcase", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Explore the MenuMinute Demo"
    );
    await expect(page.getByText("Spice Route Kitchen")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Customer View/i })).toBeVisible();
  });

  test("Public customer menu loads dishes with prices and dietary flags", async ({ page }) => {
    await page.goto("/m/demo-spice-route-kitchen-v1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Spice Route Kitchen");
    await expect(page.getByText("Sample Menu")).toBeVisible();
    await expect(page.getByText("Butter Chicken")).toBeVisible();
    await expect(page.getByText("Paneer Tikka")).toBeVisible();
    await expect(page.getByText("₹379")).toBeVisible();
  });

  test("Authentication login page renders with demo credentials hint", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByText("demo@menuminute.com")).toBeVisible();
  });

  test("Registration page renders all signup fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Create your account");
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create free account" })).toBeVisible();
  });

  test("Kitchen Display route loads with upcoming Phase D banner", async ({ page }) => {
    await page.goto("/kitchen");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kitchen Display System");
    await expect(page.getByText("Kitchen Dashboard Coming in Phase D")).toBeVisible();
  });
});
