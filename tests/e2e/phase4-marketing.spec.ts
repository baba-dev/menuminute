import { expect, test } from "@playwright/test";

test("public pricing advertises the four INR tiers without unsupported international checkout", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Simple, honest pricing." })).toBeVisible();
  for (const name of ["Free", "Ordering", "Kitchen Pro", "Dedicated"])
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  for (const price of ["₹0", "₹119", "₹499", "₹30,000"])
    await expect(page.getByText(price, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("One flat price for up to 10 outlets")).toBeVisible();
  await expect(page.getByText(/Current self-service checkout charges in INR/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subscription pricing currency" })).toBeVisible();
  await expect(page.getByText("Virtually unlimited").first()).toBeVisible();
  await expect(page.getByRole("table", { name: /Limits and features/ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Limited rollout|feature-gated|approved operator activation|release approval/
  );
  await expect(page.locator("body")).not.toContainText("Free AI paper menu photo scanner");
  await expect(page.getByText("TBA", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get started free" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.getByRole("link", { name: "Get Kitchen Pro" })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.getByRole("link", { name: /Talk to us about Dedicated/ })).toHaveAttribute(
    "href",
    "/contact"
  );
  await expect(page.getByText(/under the MIT License/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\$19\/mo|\$39\/mo|₹299/);
});

test("homepage presents ordering and the kitchen as available, with their real prices", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("order-conveyor")).toContainText("AVAILABLE NOW");
  await expect(page.getByTestId("order-conveyor")).toContainText("₹119");
  await expect(page.getByTestId("chef-pass")).toContainText("AVAILABLE NOW");
  await expect(page.getByTestId("chef-pass")).toContainText("₹499");
  await expect(page.getByTestId("service-worlds")).toContainText("AVAILABLE TODAY");
  for (const id of ["order-conveyor", "chef-pass", "service-worlds"])
    await expect(page.getByTestId(id)).not.toContainText(/in development|coming later|planned/i);
  await expect(page.locator("body")).not.toContainText(/₹299/);
  await expect(page.getByRole("link", { name: "Create your free menu" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
});

test("international USD price book is published but cannot open INR checkout", async ({ page }) => {
  await page.goto("/pricing?currency=USD");
  for (const price of ["$0", "$5.00", "$20.00", "$3,000.00"])
    await expect(page.getByText(price, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dedicated · On-premise Private" })
  ).toBeVisible();
  await expect(page.getByText("Private on-premise deployment")).toBeVisible();
  await expect(page.getByText(/USD checkout is not yet active/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask about USD billing" })).toHaveCount(2);
  for (const link of await page.getByRole("link", { name: "Ask about USD billing" }).all())
    await expect(link).toHaveAttribute("href", "/contact");
  await expect(page.getByRole("link", { name: "Discuss private deployment" })).toHaveAttribute("href", "/contact");
});
