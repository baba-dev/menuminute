import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";

async function seed() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated test DB required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const user = crypto.randomUUID(),
    outlet = crypto.randomUUID(),
    token = crypto.randomUUID();
  const email = "capture-" + user + "@browser.invalid",
    password = "capture-password-123";
  try {
    const hash = await hashPassword(password);
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "insert into users(id,name,email,email_verified) values($1,'Capture Owner',$2,true)",
        [user, email]
      );
      await c.query(
        "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
        [crypto.randomUUID(), user, hash]
      );
      await c.query("select set_config('app.actor_id',$1,true)", [user]);
      await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
        outlet,
        token,
        JSON.stringify({
          name: "Capture Test Kitchen",
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "cafe",
        }),
      ]);
      await c.query("update organizations set mfa_required=false where id=$1", [outlet]);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
  return { email, password };
}
test("capture page does not expose private import UI to anonymous guests", async ({ page }) => {
  await page.goto("/dashboard/menu/import");
  await expect(page).toHaveURL(/\/login/);
});
test("menu editor can create and privately upload a gallery image without an enabled provider", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  await expect(page.getByRole("link", { name: /Import from photos/ })).toBeVisible();
  await page.getByRole("link", { name: /Import from photos/ }).click();
  await expect(page.getByRole("heading", { name: /From a paper menu/ })).toBeVisible();
  await page.getByRole("button", { name: "Create private draft" }).click();
  await expect(page.getByRole("heading", { name: "Collect photographs" })).toBeVisible();
  await page.getByLabel("Choose menu photographs").setInputFiles({
    name: "menu-photo.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 640, height: 480, channels: 3, background: "white" } })
      .png()
      .toBuffer(),
  });
  await expect(page.getByText("menu-photo.png")).toBeVisible();
  await page.getByRole("button", { name: "Upload photos privately" }).click();
  await expect(page.getByText("Page 1 · ready")).toBeVisible();
  await expect(page.getByText(/Extraction is currently unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start extraction" })).toHaveCount(0);
});
