import { expect, test } from "@playwright/test";

test("a revoked public QR response clears previously rendered dishes instead of showing stale public content", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();

  await page.route("**/api/public-menu/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("This menu is no longer available. Please ask the staff.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No dishes in this service" })).toBeVisible();
});
