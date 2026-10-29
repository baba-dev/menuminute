import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
});

async function provisionReportsOutlet() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test") {
    throw new Error("Reports browser test requires the isolated test database");
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const user = crypto.randomUUID();
  const outlet = crypto.randomUUID();
  const email = `reports-${user}@browser.invalid`;
  const password = "reports-browser-password";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO users(id,name,email,email_verified) VALUES($1,'Reports owner',$2,true)",
      [user, email]
    );
    await client.query(
      "INSERT INTO accounts(id,user_id,provider_id,account_id,password) VALUES($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), user, await hashPassword(password)]
    );
    await client.query("SELECT set_config('app.actor_id',$1,true)", [user]);
    await client.query("SELECT app_private.provision_organization($1,$2,$3::jsonb)", [
      outlet,
      crypto.randomUUID(),
      JSON.stringify({
        name: "Reports Test Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
      }),
    ]);
    await client.query("UPDATE organizations SET mfa_required=false WHERE id=$1", [
      "org-" + outlet,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  return { email, password };
}

test("Reports Atelier supports real server filters, export and narrow viewports", async ({
  page,
}) => {
  const credentials = await provisionReportsOutlet();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/reports");
  await expect(page.getByTestId("reports-hub")).toBeVisible();
  await expect(page.getByRole("heading", { name: /story behind/i })).toBeVisible();
  await expect(page.getByText("Reports Test Kitchen")).toBeVisible();

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }

  await page.getByRole("button", { name: "Menu Intelligence" }).click();
  await expect(page).toHaveURL(/tab=menu/);
  await expect(page.getByRole("heading", { name: "Menu Performance Matrix" })).toBeVisible();

  await page.getByLabel("From", { exact: true }).fill("2026-10-28");
  await page.getByLabel("To", { exact: true }).fill("2026-10-29");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect(page).toHaveURL(/range=custom/);
  await expect(page).toHaveURL(/from=2026-10-28/);
  await expect(page).toHaveURL(/to=2026-10-29/);

  const csv = await page.request.get("/api/reports/export?range=yesterday&tab=overview");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Gross Sales");
});
