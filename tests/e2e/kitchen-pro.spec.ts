import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

// The isolated browser TLS proxy gives each fixture its own synthetic client address.
// Keep real authentication limits enabled instead of sharing a source budget across the entire suite.
test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
});
async function seed() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated test database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const owner = crypto.randomUUID(),
    outlet = crypto.randomUUID(),
    token = crypto.randomUUID();
  const email = `kitchen-${owner}@browser.invalid`,
    password = "kitchen-browser-password";
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "insert into users(id,name,email,email_verified) values($1,'Kitchen owner',$2,true)",
      [owner, email]
    );
    await c.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), owner, await hashPassword(password)]
    );
    await c.query("select set_config('app.actor_id',$1,true)", [owner]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outlet,
      token,
      JSON.stringify({
        name: "Browser Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
      }),
    ]);
    await c.query("update organizations set mfa_required=false where id=$1", ["org-" + outlet]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
  return { email, password, outlet, org: "org-" + outlet };
}
test("Kitchen Pro is scoped, responsive, and safely setup-only before commercial release", async ({
  page,
}) => {
  const f = await seed();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("link", { name: "Kitchen Setup" })).toBeVisible();
  await page.goto("/kitchen");
  await expect(page.getByRole("heading", { name: "Browser Kitchen" })).toBeVisible();
  await expect(page.getByTestId("chefs-pass")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The Chef’s Pass." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Visible kitchen workload" })).toBeVisible();
  await expect(page.getByText("Kitchen setup mode.", { exact: false })).toBeVisible();
  await expect(page.getByText("Kitchen Dashboard Coming in Phase D")).toHaveCount(0);
  // First-time kitchen configuration now opens automatically in a private modal.
  const setup = page.getByRole("dialog", { name: "Build your kitchen, beautifully." });
  await expect(setup).toBeVisible();
  await setup.getByLabel("Station name").fill("Grill");
  await setup.getByRole("button", { name: "Add station" }).click();
  await expect(
    setup.locator(".kk-setup-collection-row").filter({ hasText: "Grill" })
  ).toBeVisible();
  await setup.getByRole("button", { name: "Close kitchen setup" }).click();
  await expect(setup).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Kitchen stations" })
      .getByRole("button", { name: "Grill" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grill", exact: true })).toBeVisible();
  const current = await page.request.get(`/api/organizations/${f.org}/outlets/${f.outlet}/kitchen`);
  expect(current.status()).toBe(200);
  const body = (await current.json()) as { enabled: boolean; stations: Array<{ name: string }> };
  expect(body.enabled).toBe(false);
  expect(body.stations.map((s) => s.name)).toContain("Grill");
  await expect(page.getByRole("button", { name: "Start preparing" })).toHaveCount(0);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("group", { name: "Filter preparation lanes" })
    .getByRole("button", { name: "Preparing", exact: false })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Filter preparation lanes" })
      .getByRole("button", { name: "Preparing", exact: false })
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Grill", exact: true })).toBeVisible();
});

test("Multi-station device and expeditor flow: no premature guest Ready", async ({ page }) => {
  const f = await seed();
  const url = process.env["MIGRATION_DATABASE_URL"]!;
  const pool = new Pool({ connectionString: url, max: 1 });
  const orderId = crypto.randomUUID(),
    itemId = crypto.randomUUID();
  const a = "kst-" + crypto.randomUUID(),
    b = "kst-" + crypto.randomUUID();
  try {
    await pool.query("BEGIN");
    await pool.query("insert into kitchen_outlet_settings(outlet_id,enabled) values($1,true)", [
      f.outlet,
    ]);
    await pool.query(
      "insert into kitchen_stations(id,outlet_id,name) values($1,$3,'Grill'),($2,$3,'Tandoor')",
      [a, b, f.outlet]
    );
    await pool.query(
      "insert into orders(id,restaurant_id,order_number,status,version,fulfillment_mode) values($1,$2,1042,'preparing',3,'dine_in')",
      [orderId, f.outlet]
    );
    await pool.query(
      "insert into order_items(id,order_id,restaurant_id,dish_id,item_name,quantity,unit_price_minor,total_minor,unit_price_paise,total_paise) values($1,$2,$3,'paneer','Paneer Tikka',1,12000,12000,12000,12000)",
      [itemId, orderId, f.outlet]
    );
    await pool.query(
      "insert into kitchen_work(id,outlet_id,order_id,order_item_id,station_id,rule_version) values($1,$3,$4,$5,$6,1),($2,$3,$4,$5,$7,1)",
      ["kw-" + crypto.randomUUID(), "kw-" + crypto.randomUUID(), f.outlet, orderId, itemId, a, b]
    );
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  } finally {
    await pool.end();
  }
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/kitchen#expeditor");
  // The guided setup may open for a newly selected, not-yet-configured outlet.
  const intro = page.getByRole("dialog", { name: "Build your kitchen, beautifully." });
  if (await intro.isVisible())
    await intro.getByRole("button", { name: "Close kitchen setup" }).click();
  const expo = page.getByRole("region", { name: "Expeditor" });
  await expect(expo.getByText("#1042")).toBeVisible();
  await expect(expo.getByText("0 / 2 station tasks complete")).toBeVisible();
  await expect(expo.getByRole("button", { name: "Await all stations" })).toBeDisabled();
  for (const name of ["Grill", "Tandoor"]) {
    await page
      .getByRole("navigation", { name: "Kitchen stations" })
      .getByRole("button", { name })
      .click();
    await page.getByRole("button", { name: "Start preparing", exact: true }).click();
    await expect(page.getByRole("button", { name: "Complete item" })).toBeVisible();
    await page.getByRole("button", { name: "Complete item" }).click();
    await expect(page.getByText("Completed · Awaiting expeditor")).toBeVisible();
  }
  await expect(expo.getByText("2 / 2 station tasks complete")).toBeVisible();
  await expo.getByRole("button", { name: "Release Ready to guest" }).click();
  await expect(expo.getByText("#1042")).toHaveCount(0);
  const db = new Pool({ connectionString: url, max: 1 });
  try {
    const r = await db.query("select status,version,payment_status from orders where id=$1", [
      orderId,
    ]);
    expect(r.rows[0]).toMatchObject({ status: "ready", version: 4, payment_status: "unpaid" });
  } finally {
    await db.end();
  }
});

test("Kitchen SSE enforces a distributed session limit and revokes only after access is removed", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await seed();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const url = `/api/organizations/${f.org}/outlets/${f.outlet}/kitchen/stream`;

  // Use browser Fetch to hold open real authenticated SSE connections; an
  // ordinary APIRequestContext GET would wait for the entire 55-second body.
  const openStream = (path: string) =>
    page.evaluate(async (uri) => {
      type Holder = {
        abort: AbortController;
        reader: ReadableStreamDefaultReader<Uint8Array>;
      };
      const w = window as unknown as { kitchenTestStreams?: Holder[] };
      const abort = new AbortController();
      const res = await fetch(uri, {
        credentials: "same-origin",
        cache: "no-store",
        signal: abort.signal,
      });
      if (!res.ok) {
        abort.abort();
        return res.status;
      }
      const reader = res.body!.getReader();
      const initial = await reader.read();
      if (initial.done || !new TextDecoder().decode(initial.value).includes("event: snapshot")) {
        abort.abort();
        throw new Error("The kitchen stream did not send an initial snapshot");
      }
      (w.kitchenTestStreams ??= []).push({ abort, reader });
      return res.status;
    }, path);

  try {
    expect(await openStream(url)).toBe(200);
    expect(await openStream(url)).toBe(200);
    expect(await openStream(url)).toBe(429);

    // Revoking the outlet is reflected at the next poll, not mislabeled as a
    // temporary outage. The stream must never keep exposing prior ticket data.
    const db = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
    try {
      await db.query("update organizations set is_active=false where id=$1", [f.org]);
    } finally {
      await db.end();
    }
    const revoked = await page.evaluate(async () => {
      const w = window as unknown as {
        kitchenTestStreams?: Array<{
          abort: AbortController;
          reader: ReadableStreamDefaultReader<Uint8Array>;
        }>;
      };
      const stream = w.kitchenTestStreams?.[0];
      if (!stream) return false;
      let payload = "";
      const abortOnDeadline = setTimeout(() => stream.abort.abort(), 12000);
      try {
        while (!stream.abort.signal.aborted) {
          const next = await stream.reader.read();
          if (next.done) return false;
          payload += new TextDecoder().decode(next.value);
          if (payload.includes("event: revoked")) return true;
          if (payload.includes("event: unavailable")) return false;
        }
        return false;
      } catch {
        return false;
      } finally {
        clearTimeout(abortOnDeadline);
      }
    });
    expect(revoked).toBe(true);
  } finally {
    await page.evaluate(() => {
      const w = window as unknown as {
        kitchenTestStreams?: Array<{ abort: AbortController }>;
      };
      for (const stream of w.kitchenTestStreams ?? []) stream.abort.abort();
    });
  }
});
