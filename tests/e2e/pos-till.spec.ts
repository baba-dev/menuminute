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

test("Point of Sale creates one canonical accepted staff order with one-tap entry", async ({
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
  await expect(page.getByRole("heading", { name: "Activate Point of Sale" })).toBeVisible();
  await expect(page.getByTestId("pos-till").locator(".pos-hero")).toBeVisible();
  // Both the HTML theme attributes and The Till's own palette must switch.
  if ((await page.locator("html").getAttribute("data-theme")) !== "dark") {
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  // The editorial POS layer intentionally overrides the base Till token.
  await expect(page.getByTestId("pos-till")).toHaveCSS("--till-ink", "#fff");
  await expect(page.getByTestId("pos-till")).toHaveCSS("--till-ember", "#ffc078");
  await expect(page.getByTestId("pos-till")).toHaveCSS("--pos-surface", "#28231e");
  await expect(
    page
      .getByRole("navigation", { name: "POS workspaces" })
      .getByRole("link", { name: /Point of Sale/ })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Point of Sale overview" })).toContainText(
    "Published menus"
  );
  await page.getByLabel("Registered seller address").fill("A registered fixture address in India");
  await page.getByRole("button", { name: "Save seller details and enable POS" }).click();
  await expect(page.getByRole("heading", { name: "Published menu" })).toBeVisible();
  await page.getByRole("button", { name: /Paneer Lunch/ }).click();
  // The mobile order pad is a bottom sheet; open it before selecting cart actions.
  const mobileTicket = page.getByRole("button", { name: /View Ticket/ });
  const usesMobileSheet = await mobileTicket.isVisible();
  if (usesMobileSheet) await mobileTicket.click();
  // A simple dish goes straight into the cart, optional add-ons use inline editor.
  await expect(page.locator(".till-cartline")).toContainText("Paneer Lunch");
  await page.getByRole("button", { name: "Customize Paneer Lunch" }).click();
  await expect(page.getByRole("region", { name: "Paneer Lunch" })).toBeVisible();
  await page.getByLabel("Roti").check();
  await page.getByRole("button", { name: /Save options/ }).click();
  // The editor lives in the catalogue; reopen the ticket for mobile checkout.
  if (usesMobileSheet) {
    await expect(mobileTicket).toBeVisible();
    await mobileTicket.click();
  }
  await page.getByLabel("Mobile number (optional)").fill("9876543210");
  await expect(page.getByText("Pre-tax subtotal")).toBeVisible();
  await page.getByRole("button", { name: /Place Order & Send/ }).click();
  await expect(page.locator(".till-success")).toContainText("Dispatched");
  await expect(page.locator(".till-success")).toContainText("not a receipt or tax invoice");

  // The searchable register exposes sale-specific actions without auto-reordering or refunding.
  const register = page.getByRole("region", { name: "Recent Orders & Sales" });
  await expect(register.getByRole("table", { name: /Order history/ })).toBeVisible();
  await expect(register.getByRole("button", { name: /View order #/ })).toHaveCount(1);
  await expect(register.getByRole("link", { name: /Reprint bill for order #/ })).toHaveAttribute(
    "href",
    /receipts/
  );
  const reprintHref = await register
    .getByRole("link", { name: /Reprint bill for order #/ })
    .getAttribute("href");
  expect(reprintHref?.startsWith("/dashboard/pos/receipts/")).toBe(true);
  await expect(register.getByRole("link", { name: /Refund or correct payment/ })).toHaveCount(0);
  const orderSearch = register.getByPlaceholder("Order #, guest, table, dish…");
  await orderSearch.fill("unmatched_dish_name");
  await expect(register.getByText("No matching orders.")).toBeVisible();
  await orderSearch.fill("Paneer Lunch");
  await expect(
    register.getByRole("button", { name: /Repeat order #.*into new ticket/ })
  ).toBeVisible();
  const repeatResponse = page.waitForResponse(
    (response) => response.url().includes("view=repeat") && response.request().method() === "GET"
  );
  await register.getByRole("button", { name: /Repeat order #.*into new ticket/ }).click();
  const selectionResponse = await repeatResponse;
  expect(selectionResponse.status(), "The authorized repeat snapshot must be readable").toBe(200);
  const repeatSnapshot = await selectionResponse.json();
  expect(repeatSnapshot.items).toEqual([
    expect.objectContaining({
      dishId: "paneer",
      quantity: 1,
      selectedOptions: [expect.objectContaining({ groupId: "bread", optionId: "roti" })],
    }),
  ]);
  await expect(page.getByText(/copied to a NEW draft/)).toBeVisible();
  await expect(page.locator(".till-cartline")).toContainText("Paneer Lunch");
  await expect(page.getByText(/copied to a NEW draft/)).toBeVisible();
  await expect(page.getByText(/no new order or payment has been recorded/)).toBeVisible();

  const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  try {
    const result = await pool.query(
      "select o.status,o.payment_status,o.total_minor,s.tax_state from orders o join pos_sales s on s.order_id=o.id where s.outlet_id=$1 order by s.created_at desc limit 1",
      [f.outlet]
    );
    expect(result.rows[0]).toMatchObject({
      status: "accepted",
      payment_status: "unpaid",
      total_minor: 13000,
      tax_state: "not_calculated",
    });
  } finally {
    await pool.end();
  }
  await page.goto("/dashboard/pos/ledger");
  await expect(page.getByRole("heading", { name: "The Ledger." })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "POS workspaces" })
      .getByRole("link", { name: /The Ledger/ })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("LIVE FINANCE GATE IS CLOSED")).toHaveCount(0);
  await expect(page.getByText("No sale records yet.")).toHaveCount(0);
  await page.goto("/dashboard/pos/closing");
  await expect(page.getByRole("heading", { name: "The Closing Desk." })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "POS workspaces" })
      .getByRole("link", { name: /Closing Desk/ })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Open register" })).toBeEnabled();
  await page.getByRole("button", { name: "Open register" }).click();
  await expect(page.getByRole("heading", { name: "counter" })).toBeVisible();
  await expect(page.getByText("Cash collections")).toBeVisible();

  // Exercise the real receipt route under both screen and print media. A browser
  // print preview must contain only the bill, never the authenticated workspace.
  const receiptPath = reprintHref!.split("?")[0];
  await page.goto(receiptPath + "?paper=80");
  await expect(page.locator(".receipt-paper")).toContainText("Paneer Lunch");
  await expect(page.locator(".receipt-details")).toContainText("+919876543210");
  await expect(page.locator(".receipt-details dt").filter({ hasText: "Table" })).toHaveCount(0);
  await expect(page.locator(".mm-workspace-sidebar")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".mm-workspace-sidebar")).toBeHidden();
  await expect(page.locator(".mm-shared-topbar")).toBeHidden();
  await expect(page.locator(".receipt-toolbar")).toBeHidden();
  await expect(page.locator(".receipt-paper")).toBeVisible();
  await expect(page.locator(".mm-workspace-shell")).toHaveCSS("display", "block");
  await expect(page.locator(".mm-workspace-main")).toHaveCSS("padding", "0px");
  const width80 = await page
    .locator(".receipt-paper")
    .evaluate((el) => el.getBoundingClientRect().width);

  await page.goto(receiptPath + "?paper=58");
  await expect(page.locator(".receipt-paper")).toBeVisible();
  await expect(page.locator(".mm-workspace-sidebar")).toBeHidden();
  const width58 = await page
    .locator(".receipt-paper")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width58).toBeLessThan(width80);
});

test("POS merchant Ledger and Closing Desk stay usable at 390px", async ({ page }) => {
  test.setTimeout(120000);
  const f = await setup();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/dashboard/pos");
  await page.getByLabel("Registered seller address").fill("Accessible fixture address");
  await page.getByRole("button", { name: "Save seller details and enable POS" }).click();
  await page.getByRole("button", { name: /Paneer Lunch/ }).click();
  const ticket = page.getByRole("button", { name: /View Ticket/ });
  if (await ticket.isVisible()) await ticket.click();
  await page.getByRole("button", { name: /Place Order & Send/ }).click();
  await expect(page.locator(".till-success")).toBeVisible();
  await page.goto("/dashboard/pos/ledger");
  await expect(page.locator(".finance-mobile-register")).toBeVisible();
  await expect(page.locator(".finance-mobile-sale")).toHaveCount(1);
  await page.getByRole("button", { name: /View financial details/ }).click();
  await expect(page.getByLabel("Verified internal payment evidence")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Registered invoice readiness — review only",
    })
  ).toBeVisible();
  await expect(page.getByText(/No IRP registration, statutory serial/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/dashboard/pos/closing");
  await page.getByRole("button", { name: "Start new consistency scan" }).click();
  await expect(page.getByText(/All currently reachable sale pages scanned/)).toBeVisible();
  await expect(page.getByText(/1 sales inspected/)).toBeVisible();
  await page.goto("/dashboard/reports?tab=till");
  await expect(
    page.getByRole("heading", { name: "Cashier evidence & unassigned cash" })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
