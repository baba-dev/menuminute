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
  await expect(
    page.getByText("This menu is no longer available. Please ask the staff.")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No dishes in this service" })).toBeVisible();
});

test("search hides dead category anchors and restores navigation when filters clear", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  const links = page.getByRole("navigation", { name: "Menu categories" }).getByRole("link");
  await expect(links.first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search the menu" }).fill("impossible-dish-zxy-827");
  await expect(page.getByText("0 dishes shown", { exact: true })).toBeVisible();
  await expect(links).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(links.first()).toBeVisible();
  await expect(page.getByText("0 dishes shown", { exact: true })).toHaveCount(0);
});

test("editorial dish detail is an accessible read-only sheet and returns focus to the guest menu", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  const trigger = page.getByRole("button", { name: "View Paneer Tikka details" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const detail = page.getByRole("dialog", { name: "Paneer Tikka" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Back to menu")).toBeVisible();
  await expect(detail.getByRole("button", { name: /checkout|place order/i })).toHaveCount(0);
  await detail.getByRole("button", { name: "Back to menu" }).click();
  await expect(detail).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
