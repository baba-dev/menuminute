import { expect, test } from "@playwright/test";

test("a revoked public QR response clears previously rendered dishes instead of showing stale public content", async ({
  page,
}) => {
  await page.goto("/m/demo-spice-route-kitchen-v1");
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();

  // Server-rendered dishes may be visible before hydration registers the online
  // listener. Exercise a controlled filter so the following refresh is meaningful.
  const search = page.getByRole("searchbox", { name: "Search the menu" });
  await search.fill("no-match-for-hydration-check-827");
  await expect(page.getByText("0 dishes shown", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();

  await page.route("**/api/public-menu/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  const revokedResponse = page.waitForResponse(
    (response) => response.url().includes("/api/public-menu/") && response.status() === 404
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await revokedResponse;
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
