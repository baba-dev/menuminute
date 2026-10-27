import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

async function seedOrdering(enabled: boolean) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test") {
    throw new Error("An isolated test database is required.");
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const ownerId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const email = `ordering-${ownerId}@browser.invalid`;
  const password = "order-browser-password";
  let tableToken = "";
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Ordering owner',$2,true)",
        [ownerId, email]
      );
      await client.query(
        "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
        [crypto.randomUUID(), ownerId, await hashPassword(password)]
      );
      await client.query("select set_config('app.actor_id',$1,true)", [ownerId]);
      await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
        outletId,
        publicId,
        JSON.stringify({
          name: "Order Browser Kitchen",
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
          fulfillmentModes: ["dine_in", "pickup"],
        }),
      ]);
      const document = menuDocumentSchema.parse({
        name: "Online menu",
        currency: "INR",
        categories: [
          {
            id: "mains",
            name: "Mains",
            items: [{ id: "paneer", name: "Paneer Curry", priceMinor: 15000 }],
          },
        ],
      });
      await client.query("select app_private.menu_command($1,$2,'save',$3::jsonb,$4,1)", [
        outletId,
        `menu-${outletId}`,
        JSON.stringify({ document }),
        crypto.randomUUID(),
      ]);
      await client.query("select app_private.menu_command($1,$2,'publish','{}'::jsonb,$3,2)", [
        outletId,
        `menu-${outletId}`,
        crypto.randomUUID(),
      ]);
      const result = await client.query<{ data: { token: string } }>(
        "select app_private.qr_command($1,'create',$2::jsonb,$3) as data",
        [
          outletId,
          JSON.stringify({ label: "Dining room", pointLabel: "Table 4" }),
          crypto.randomUUID(),
        ]
      );
      tableToken = result.rows[0]!.data.token;
      if (enabled) {
        await client.query(
          `insert into entitlement_grants
          (id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
          values($1,$2,'ordering.new','USD',now()-interval '1 minute',
          now()+interval '1 hour','browser-test','Ordering UI acceptance',$3)`,
          [crypto.randomUUID(), `org-${outletId}`, crypto.randomUUID()]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  return { outletId, publicId, tableToken, email, password };
}

test("the free QR-only outlet retains its public menu but does not offer checkout", async ({
  page,
}) => {
  const fixture = await seedOrdering(false);
  await page.goto(`/m/${fixture.tableToken}`);
  await expect(page.getByRole("heading", { name: "Paneer Curry" })).toBeVisible();
  await page.getByRole("button", { name: "View Paneer Curry details" }).first().click();
  const detail = page.getByRole("dialog", { name: "Paneer Curry" });
  await expect(detail.getByText(/Browse the available options and pricing/)).toBeVisible();
  await expect(detail.getByRole("button", { name: /Add to Order/ })).toHaveCount(0);
  await detail.getByRole("button", { name: "Back to menu" }).click();
  await expect(page.getByRole("button", { name: "View order cart" })).toHaveCount(0);
});

test("guest QR-to-kitchen lifecycle, independent finance settlement and tracking capability", async ({
  page,
}) => {
  test.setTimeout(120000);
  const fixture = await seedOrdering(true);
  await page.goto(`/m/${fixture.tableToken}`);
  await expect(page.getByRole("heading", { name: "Paneer Curry" })).toBeVisible();
  await page.getByRole("button", { name: "Add to order", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Paneer Curry" })
    .getByRole("button", { name: /Add to Order/ })
    .click();
  await page.getByRole("button", { name: "View order cart" }).click();
  await expect(page.getByText("Table 4", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: /Submit order/ }).click();
  await expect(page).toHaveURL(/\/m\/[^/]+\/orders\/ord-/);
  await expect(page.getByText("Order Sent to Restaurant")).toBeVisible();

  const orderId = new URL(page.url()).pathname.split("/").at(-1)!;
  const unauthorized = await page.request.get(
    `/api/public-orders/${orderId}?token=${encodeURIComponent(fixture.tableToken)}`,
    { headers: { "x-tracking-token": "incorrect-token" } }
  );
  expect(unauthorized.status()).toBe(404);

  // Keep each synthetic browser login on an independent proxy-supplied client IP.
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const owner = await page.context().newPage();
  try {
    await owner.goto("/login");
    await owner.getByLabel("Email address").fill(fixture.email);
    await owner.getByLabel("Password", { exact: true }).fill(fixture.password);
    await owner.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(owner).toHaveURL(/dashboard/);
    await owner.goto("/dashboard/orders");
    await expect(owner.getByRole("heading", { name: "The Service Counter." })).toBeVisible();
    await expect(owner.getByTestId("service-counter")).toBeVisible();
    await expect(owner.getByText("Today's service pulse")).toBeVisible();
    await expect(owner.getByRole("tab", { name: /Live orders/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await owner.getByRole("button", { name: "Details", exact: false }).first().click();
    await expect(owner.getByRole("dialog", { name: /Order #/ })).toBeVisible();
    await owner.getByRole("button", { name: "Close order details" }).click();
    await owner.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByText("Order Accepted!")).toBeVisible({ timeout: 15000 });
    await owner.getByRole("button", { name: "Start Preparing" }).click();
    await expect(page.getByText("Food Being Prepared")).toBeVisible({ timeout: 15000 });
    await owner.getByRole("button", { name: "Mark Ready" }).click();
    await expect(page.getByText("Order Ready!")).toBeVisible({ timeout: 15000 });
    await owner.getByRole("button", { name: "Record Paid" }).click();
    await owner.getByRole("button", { name: "Confirm cash received" }).click();
    await expect(page.getByText("Your payment has been received.")).toBeVisible({
      timeout: 15000,
    });
    await owner.getByRole("button", { name: "Mark Served" }).click();
    await expect(page.getByText("Order Complete")).toBeVisible({ timeout: 15000 });
    await owner.getByRole("tab", { name: "History" }).click();
    await expect(owner.getByText("matching concluded orders")).toBeVisible();
    for (const width of [360, 390, 768, 1024, 1440]) {
      await owner.setViewportSize({ width, height: 900 });
      expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
    }
  } finally {
    await owner.close();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Service Counter keeps verified queue and counters isolated under partial outages", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const fixture = await seedOrdering(true);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);

  const pulsePath = "**/orders/workspace?view=pulse";
  const railPath = "**/orders/workspace?view=rail";
  await page.route(pulsePath, (route) =>
    route.fulfill({
      status: 503,
      headers: { "x-request-id": "test-ref-001" },
      contentType: "application/json",
      body: JSON.stringify({ message: "An unexpected error occurred" }),
    })
  );
  await page.goto("/dashboard/orders");
  await expect(page.getByTestId("service-rail-status")).toContainText("Live queue synced");
  await expect(page.getByTestId("service-pulse-error")).toBeVisible();
  await expect(page.getByTestId("service-pulse-error")).toContainText("Reference: test-ref");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(1);
  await expect(page.getByText("No tickets awaiting acceptance.")).toBeVisible();
  const cells = page.getByTestId("service-pulse-grid").locator("button");
  await expect(cells).toHaveCount(4);
  await expect(cells.first()).toContainText("—");

  await page.setViewportSize({ width: 1440, height: 900 });
  const geometry = await cells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        x: box.x,
        right: box.right,
        y: box.y,
        bottom: box.bottom,
        border: parseFloat(style.borderLeftWidth),
      };
    })
  );
  expect(geometry.every((box) => box.border >= 1)).toBe(true);
  for (let i = 0; i < geometry.length; i += 1) {
    for (let j = i + 1; j < geometry.length; j += 1) {
      const a = geometry[i]!;
      const b = geometry[j]!;
      expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
    }
  }

  await page.unroute(pulsePath);
  await page.route(railPath, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "An unexpected error occurred" }),
    })
  );
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByTestId("service-rail-error")).toBeVisible();
  await expect(page.getByTestId("service-pulse-error")).toHaveCount(0);
  await expect(page.getByTestId("service-rail-status")).toContainText("read-only");
  await expect(page.getByText("Queue unavailable").first()).toBeVisible();
  await expect(cells.first()).toContainText("0");

  await page.unroute(railPath);
  await page.getByRole("button", { name: "Retry queue" }).click();
  await expect(page.getByTestId("service-rail-error")).toHaveCount(0);
  await expect(page.getByText("All caught up.")).toBeVisible();

  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("service-counter-light-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: info.outputPath("service-counter-dark-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: info.outputPath("service-counter-dark-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Live orders" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
});
