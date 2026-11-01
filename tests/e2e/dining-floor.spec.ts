import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

async function seedOwner() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The dining floor browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const email = "floor-" + userId + "@browser.invalid";
  const password = "floor-browser-password";
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Floor owner',$2,true)",
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
          name: "Floor Test Kitchen",
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
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
  await expect(page).toHaveURL(/dashboard/);
}

test("owner builds a dining room: table, chairs, one-tap occupancy, edit and archive", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const owner = await seedOwner();
  await signIn(page, owner);
  await page.goto("/dashboard/floor");

  const floor = page.getByTestId("dining-floor");
  await expect(floor).toBeVisible();
  await expect(floor.getByRole("heading", { level: 1 })).toHaveText(/build your dining room/i);
  await expect(page.getByRole("heading", { name: "Your dining room is empty" })).toBeVisible();

  // Add a table through the popup, creating the first section inline.
  await floor.getByRole("button", { name: "Add table" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a table" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Table number")).toHaveValue("1");
  await dialog.getByLabel("Table name").fill("Window booth");
  await expect(dialog.getByLabel("New section name")).toHaveValue("Main Dining");
  await dialog.getByRole("button", { name: "Booth" }).click();
  await expect(dialog.getByText("A permanent system ID is assigned when you save.")).toBeVisible();
  await dialog.getByRole("button", { name: "More chairs" }).click();
  await dialog.getByRole("button", { name: "More chairs" }).click(); // 6 chairs
  await dialog.getByRole("button", { name: "Create table" }).click();
  await expect(dialog).toHaveCount(0);

  const card = page.getByRole("article", { name: /Table 1, Window booth/ });
  await expect(card).toBeVisible();
  await expect(floor.getByRole("heading", { level: 1 })).toHaveText(/6 seats, all free/);
  await expect(floor.getByText("Total tables")).toBeVisible();
  await expect(floor.locator("section[aria-label='Floor at a glance']")).toContainText("6");

  // One tap on a chair marks it taken; totals and copy follow immediately.
  const chairs = card.getByRole("button", { name: /Window booth, Chair \d, standard chair, free/ });
  await expect(chairs).toHaveCount(6);
  await chairs.first().click();
  await expect(floor.getByRole("heading", { level: 1 })).toHaveText(/1 of 6 seats taken, 5 free/);
  await expect(
    card.getByRole("button", { name: /Chair 1, standard chair, taken/ })
  ).toHaveAttribute("aria-pressed", "true");
  // The server really recorded it.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/1 of 6 seats taken/);

  // Seat a party of 3 from the table prompt, then clear in one tap.
  await card.getByRole("button", { name: "Seat party" }).click();
  const seat = page.getByRole("dialog", { name: "Window booth" });
  await seat.getByRole("button", { name: "Fewer guests" }).click();
  await seat.getByRole("button", { name: "Fewer guests" }).click();
  await seat.getByRole("button", { name: /^Seat \d/ }).click();
  await expect(seat).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/4 of 6 seats taken/);
  await card.getByRole("button", { name: "Clear table" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/6 seats, all free/);

  // Add chairs to a table via the hero button, then edit and renumber the table.
  await floor.getByRole("button", { name: "Add chair" }).first().click();
  const chairsDialog = page.getByRole("dialog", { name: "Add chairs" });
  await chairsDialog
    .getByLabel("Put them at")
    .selectOption({ label: "1 · Window booth (6 chairs)" });
  await chairsDialog.getByRole("button", { name: /^Add 1 chair$/ }).click();
  await expect(chairsDialog).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/7 seats, all free/);

  await card.getByRole("button", { name: "More actions for Window booth" }).click();
  await page.getByRole("menuitem", { name: "Edit table" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Window booth" });
  await edit.getByLabel("Table number").fill("12");
  await edit.getByLabel("Table name").fill("Garden booth");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("article", { name: /Table 12, Garden booth/ })).toBeVisible();

  // Duplicate numbers are caught as you type.
  await floor.getByRole("button", { name: "Add table" }).first().click();
  const second = page.getByRole("dialog", { name: "Add a table" });
  await second.getByLabel("Table name").fill("Patio");
  await second.getByLabel("Table number").fill("12");
  await expect(second.getByText(/Table 12 already exists/)).toBeVisible();
  await expect(second.getByRole("button", { name: "Create table" })).toBeDisabled();
  await second.getByLabel("Table number").fill("2");
  await second.getByRole("combobox", { name: /^Section/ }).selectOption({ label: "Main Dining" });
  await second.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByRole("article", { name: /Table 2, Patio/ })).toBeVisible();

  await page.screenshot({
    path: info.outputPath(`dining-floor-${info.project.name}-light.png`),
    fullPage: true,
  });

  // Seated guests block archiving; a free, chair-less table archives and its chairs are kept.
  const patio = page.getByRole("article", { name: /Table 2, Patio/ });
  await patio.getByRole("button", { name: "More actions for Patio" }).click();
  await page.getByRole("menuitem", { name: "Archive table" }).click();
  await page
    .getByRole("dialog", { name: "Archive Patio?" })
    .getByRole("button", { name: "Archive table" })
    .click();
  await expect(patio).toHaveCount(0);

  // Dark mode keeps the same page readable.
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(page.getByRole("article", { name: /Table 12, Garden booth/ })).toBeVisible();
  await page.screenshot({
    path: info.outputPath(`dining-floor-${info.project.name}-dark.png`),
    fullPage: true,
  });
});
