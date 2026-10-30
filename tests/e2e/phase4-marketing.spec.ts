import { expect, test } from "@playwright/test";

test("public pricing advertises the reviewed INR catalog without unsupported international checkout", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Simple, honest pricing." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free Forever" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live Table Ordering" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kitchen Pro KDS" })).toBeVisible();

  await expect(page.getByText("₹119", { exact: true })).toBeVisible();
  await expect(page.getByText("₹299", { exact: true })).toBeVisible();
  await expect(page.getByText("INR billing · international pricing coming later")).toBeVisible();
  await expect(page.getByText("Available after Kitchen Pro release approval")).toBeVisible();
  await expect(page.getByText(/AI photo extraction is optional/)).toBeVisible();
  await expect(page.getByText(/Ordering is feature-gated/)).toBeVisible();
  await expect(page.getByText(/Kitchen Pro requires approved operator activation/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Free AI paper menu photo scanner");
  await expect(page.getByText("TBA", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get started free" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.getByRole("link", { name: "Create an account for Kitchen Pro" })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.getByText(/under the MIT License/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\$19\/mo|\$39\/mo|₹149/);
});

test("homepage preserves explicit development and free-menu availability messaging", async ({
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
