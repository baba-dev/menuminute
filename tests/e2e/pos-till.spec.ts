import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

async function setup() {
  const connectionString = process.env["MIGRATION_DATABASE_URL"];
  if (!connectionString || new URL(connectionString).pathname !== "/menuminute_test")
    throw new Error("An isolated browser database is mandatory for POS tests.");
  const pool = new Pool({ connectionString, max: 1 });
  const id = crypto.randomUUID();
  const email = `pos-${id}@browser.invalid`;
  const password = "browser-pos-password";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "insert into users(id,name,email,email_verified) values($1,'POS Owner',$2,true)",
      [id, email]
    );
    await client.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), id, await hashPassword(password)]
    );
    await client.query("select set_config('app.actor_id',$1,true)", [id]);
    const outlet = crypto.randomUUID();
    await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outlet,
      crypto.randomUUID(),
      JSON.stringify({
        name: "Till Test Cafe",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
        fulfillmentModes: ["dine_in", "pickup"],
      }),
    ]);
    await client.query("update organizations set mfa_required=false where id=$1", [
      `org-${outlet}`,
    ]);
    const document = menuDocumentSchema.parse({
      name: "Till lunch menu",
      currency: "INR",
      categories: [
        {
          id: "lunch",
          name: "Lunch",
          items: [
            {
              id: "paneer",
              name: "Paneer Lunch",
              priceMinor: 12000,
              addOnGroups: [
                {
                  id: "bread",
                  name: "Bread",
                  min: 0,
                  max: 1,
                  options: [{ id: "roti", name: "Roti", priceMinor: 1000 }],
                },
              ],
            },
          ],
        },
      ],
    });
    await client.query("select app_private.menu_command($1,$2,'save',$3::jsonb,$4,1)", [
      outlet,
      `menu-${outlet}`,
      JSON.stringify({ document }),
      crypto.randomUUID(),
    ]);
    await client.query("select app_private.menu_command($1,$2,'publish','{}'::jsonb,$3,2)", [
      outlet,
      `menu-${outlet}`,
      crypto.randomUUID(),
    ]);
    await client.query("COMMIT");
    return { email, password, outlet };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("The Till is private and creates one unpaid canonical kitchen-bound draft order", async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await setup();
  await page.goto("/dashboard/pos");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/dashboard/pos");
  await expect(page.getByRole("heading", { name: "Activate draft POS" })).toBeVisible();
  await page.getByText("POS DISABLED").waitFor();
  await page.getByLabel("Registered seller address").fill("A registered fixture address in India");
  await page.getByRole("button", { name: "Save identity and enable draft orders" }).click();
  await expect(page.getByRole("heading", { name: "Published menu" })).toBeVisible();
  await page.getByRole("button", { name: /Paneer Lunch/ }).click();
  await expect(page.getByRole("dialog", { name: "Paneer Lunch" })).toBeVisible();
  await page.getByLabel("Roti").check();
  await page.getByRole("button", { name: /Add dish/ }).click();
  await expect(page.getByText("Pre-tax subtotal")).toBeVisible();
  await page.getByRole("button", { name: /Send to Service Counter/ }).click();
  await expect(page.getByRole("status")).toContainText("Recorded");
  await expect(page.getByRole("status")).toContainText("not a receipt or tax invoice");
  const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  try {
    const result = await pool.query(
      "select o.status,o.payment_status,o.total_minor,s.tax_state from orders o join pos_sales s on s.order_id=o.id where s.outlet_id=$1 order by s.created_at desc limit 1",
      [f.outlet]
    );
    expect(result.rows[0]).toMatchObject({
      status: "pending",
      payment_status: "unpaid",
      total_minor: 13000,
      tax_state: "not_calculated",
    });
  } finally {
    await pool.end();
  }
  await page.goto("/dashboard/pos/ledger");
  await expect(page.getByRole("heading", { name: "The Ledger." })).toBeVisible();
  await expect(page.getByText("LIVE FINANCE GATE IS CLOSED")).toBeVisible();
  await expect(page.getByText("No sale records yet.")).toHaveCount(0);
  await page.goto("/dashboard/pos/closing");
  await expect(page.getByRole("heading", { name: "The Closing Desk." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open register" })).toBeDisabled();
});
