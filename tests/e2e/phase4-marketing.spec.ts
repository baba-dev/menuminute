import { expect, test } from "@playwright/test";

test("public pricing separates the available free product from future, unpriced plans", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Simple, transparent pricing" })).toBeVisible();
  await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("TBA", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Coming soon · pricing pending")).toHaveCount(2);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get started free" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.locator("body")).not.toContainText(/₹149|₹299/);
});

test("homepage describes ordering and kitchen as development, not currently purchasable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("order-conveyor")).toContainText("IN DEVELOPMENT");
  await expect(page.getByTestId("chef-pass")).toContainText("IN DEVELOPMENT");
  await expect(page.getByTestId("service-worlds")).toContainText("AVAILABLE TODAY");
  await expect(page.getByTestId("service-worlds")).toContainText(
    "Ordering and kitchen workflows are coming later."
  );
  await expect(page.locator("body")).not.toContainText(/₹149|₹299/);
  await expect(page.getByRole("link", { name: "Create your free menu" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
});
