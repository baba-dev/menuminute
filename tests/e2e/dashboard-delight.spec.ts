import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

async function seedOwner() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The dashboard delight browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const email = "delight-" + userId + "@browser.invalid";
  const password = "delight-browser-password";
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Delight owner',$2,true)",
        [userId, email]
      );
      await client.query(
        "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
        [crypto.randomUUID(), userId, await hashPassword(password)]
      );
      await client.query("select set_config('app.actor_id',$1,true)", [userId]);
      await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
        outletId,
        crypto.randomUUID(),
        JSON.stringify({
          name: "Delight Test Kitchen",
          country: "OM",
          currency: "OMR",
          timezone: "Asia/Muscat",
          outletType: "cafe",
        }),
      ]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  return { email, password, outletId };
}

async function signIn(page: Page, owner: { email: string; password: string }) {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
}

test("keyboard users can skip the sidebar", async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, await seedOwner());
  // signIn already lands on the dashboard: an immediate redundant navigation can
  // catch the outgoing and incoming route during a short App Router transition.
  await expect(page.locator("#workspace-main").getByTestId("editorial-dashboard")).toHaveCount(1);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
});

test("layout choices persist across reloads and hidden widgets are not rendered", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, await seedOwner());
  await expect(page.locator('.mm-widget[data-widget="floor"]')).toHaveCount(1);

  await page.getByRole("button", { name: /Customize layout/ }).click();
  await page.getByRole("button", { name: "Hide Dining floor" }).click();
  await page.getByRole("button", { name: "Pin Outlet health" }).click();
  await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
  await expect(page.locator('.mm-widget[data-widget="floor"]')).toHaveCount(0);
  // DOM order, not just CSS order, follows the layout so tab and reading order match.
  await expect(page.locator(".mm-widget").first()).toHaveAttribute("data-widget", "health");

  const stored = await page.evaluate(async () => {
    const response = await fetch("/api/account/dashboard-layout", { credentials: "same-origin" });
    return response.json();
  });
  expect(stored.layout.hidden).toEqual(["floor"]);
  expect(stored.layout.pinned).toEqual(["health"]);

  // Restoring brings the widget back after the server re-renders.
  await page.getByRole("button", { name: /Customize layout/ }).click();
  await page.getByRole("button", { name: "Show Dining floor" }).click();
  await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
  await expect(page.locator('.mm-widget[data-widget="floor"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
});

test("the layout API validates input and enforces same-origin JSON", async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, await seedOwner());
  const result = await page.evaluate(async () => {
    const send = (body: string, headers: Record<string, string> = {}) =>
      fetch("/api/account/dashboard-layout", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...headers },
        body,
      }).then((response) => response.status);
    const valid = {
      version: 1,
      order: ["kpis", "priorities", "dispatch", "health", "floor", "serviceRequests"],
      hidden: [],
      pinned: [],
    };
    return {
      unknown: await send(JSON.stringify({ ...valid, order: ["ghost"] })),
      duplicate: await send(JSON.stringify({ ...valid, hidden: ["kpis", "kpis"] })),
      extra: await send(JSON.stringify({ ...valid, admin: true })),
      oversize: await send(JSON.stringify({ ...valid, pad: "x".repeat(8000) })),
      ok: await send(JSON.stringify(valid)),
    };
  });
  expect(result.unknown).toBe(422);
  expect(result.duplicate).toBe(422);
  expect(result.extra).toBe(422);
  expect(result.oversize).toBeGreaterThanOrEqual(400);
  expect(result.ok).toBe(200);
  const anonymousContext = await page.context().browser()!.newContext({
    baseURL: "https://localhost:3443",
    ignoreHTTPSErrors: true,
  });
  const anonymous = await anonymousContext.request.get("/api/account/dashboard-layout");
  expect(anonymous.status()).toBe(401);
  await anonymousContext.close();
});

test("a service milestone shows once per day and never replays", async ({ page }) => {
  test.setTimeout(120000);
  const owner = await seedOwner();
  await page.route("**/api/dashboard/pulse", (route) =>
    route.fulfill({
      json: {
        outletId: owner.outletId,
        state: "ready",
        checkedAt: new Date().toISOString(),
        data: { pending: 0, preparing: 0, ready: 0, active: 0, completedToday: 1 },
      },
    })
  );
  await signIn(page, owner);
  await page.getByRole("button", { name: "Refresh service activity" }).click();
  const ticket = page.getByTestId("milestone-ticket");
  await expect(ticket).toContainText("First order out the door");
  await expect(ticket).toHaveAttribute("role", "status");
  // The ticket never steals focus.
  await expect(ticket).not.toBeFocused();
  await ticket.getByRole("button", { name: /Dismiss/ }).click();
  await expect(ticket).toHaveCount(0);

  await page.getByRole("button", { name: "Refresh service activity" }).click();
  await expect(page.getByTestId("milestone-ticket")).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Refresh service activity" }).click();
  await expect(page.getByTestId("milestone-ticket")).toHaveCount(0);
});

test("status is never colour alone and the shift summary follows the Ember flag", async ({
  page,
}) => {
  test.setTimeout(90000);
  await signIn(page, await seedOwner());
  const badge = page.locator(".mm-dashboard-health-badge").first();
  await expect(badge).toContainText(/Live|Pending/);
  await expect(badge.locator("svg")).toHaveCount(1);
  // Flag-gated: absent (not merely disabled) unless the Ember-enabled fixture is running.
  await expect(page.getByRole("button", { name: "Shift summary" })).toHaveCount(
    process.env["AI_ASSISTANT_READ_ONLY_ENABLED"] === "true" ? 1 : 0
  );
});

test("the editor fits a phone without horizontal scrolling", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, await seedOwner());
  await page.getByRole("button", { name: /Customize layout/ }).click();
  await expect(page.getByRole("region", { name: "Customize your overview" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
