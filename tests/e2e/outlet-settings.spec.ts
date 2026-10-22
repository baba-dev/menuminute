import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
async function seed() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated test database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const user = crypto.randomUUID(),
    outlet = crypto.randomUUID();
  const email = "atelier-" + user + "@browser.invalid",
    password = "atelier-browser-password";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into users(id,name,email,email_verified) values($1,'Atelier owner',$2,true)",
      [user, email]
    );
    await client.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), user, await hashPassword(password)]
    );
    await client.query("select set_config('app.actor_id',$1,true)", [user]);
    await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outlet,
      crypto.randomUUID(),
      JSON.stringify({
        name: "Atelier Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
      }),
    ]);
    await client.query("update organizations set mfa_required=false where id=$1", [
      "org-" + outlet,
    ]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
  return { email, password, outlet };
}
test("Outlet Atelier saves scoped profile and remains responsive in both themes", async ({
  page,
}) => {
  const f = await seed();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/settings");
  await expect(page.getByTestId("outlet-atelier")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Every detail/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Restaurant profile." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByLabel("Description").fill("Bespoke neighborhood dining");
  await page.getByLabel("Public phone").fill("+91 9876543210");
  await page.getByLabel("Public email").fill("info@example.com");
  await page.getByLabel("Website URL").fill("https://example.com");
  await page.getByLabel("Primary hex color").fill("#abcdef");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").getByText("Profile saved successfully.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Description")).toHaveValue("Bespoke neighborhood dining");
  await expect(page.getByLabel("Public phone")).toHaveValue("+91 9876543210");
  await expect(page.getByLabel("Primary hex color")).toHaveValue("#abcdef");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Operational identity." })).toBeVisible();
  await expect(page.getByText("INR", { exact: true }).first()).toBeVisible();
});
test("Outlet Atelier rejects a stale profile after another authorized update", async ({ page }) => {
  const f = await seed();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/settings");
  await expect(page.getByTestId("outlet-atelier")).toBeVisible();

  // A separate authorized request commits a newer profile version while this editor
  // deliberately holds its earlier version. The real database must reject its stale save.
  const endpoint =
    "/api/organizations/" + encodeURIComponent("org-" + f.outlet) +
    "/outlets/" + encodeURIComponent(f.outlet) + "/profile";
  const external = await page.request.patch(endpoint, {
    headers: { origin: new URL(page.url()).origin },
    data: {
      expectedVersion: 0,
      fields: {
        description: "First committed description",
        phone: null,
        email: null,
        website: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        primaryColor: "#f97316",
        secondaryColor: "#1c1917",
      },
    },
  });
  expect(external.status()).toBe(200);
  await page.getByLabel("Description").fill("A stale conflicting version");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator(".os-error")).toContainText("changed elsewhere");
  await page.getByRole("button", { name: "Reload latest" }).click();
  await expect(page.getByLabel("Description")).toHaveValue("First committed description");
});
