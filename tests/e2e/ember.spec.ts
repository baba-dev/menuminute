import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

// The normal production CI build deliberately keeps Ember disabled; its full flows run in
// the separate, required, isolated Ember-enabled browser lane.
test.skip(
  process.env["AI_ASSISTANT_READ_ONLY_ENABLED"] !== "true" ||
    process.env["AI_ASSISTANT_ACTIONS_ENABLED"] !== "true",
  "Ember browser flows require the isolated enabled fixture"
);

async function seed() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated Ember test database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const user = crypto.randomUUID();
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  const email = "ember-" + user + "@browser.invalid";
  const password = "ember-browser-password";
  const menuId = "menu-" + first;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "insert into users(id,name,email,email_verified) values($1,'Ember owner',$2,true)",
      [user, email]
    );
    await client.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), user, await hashPassword(password)]
    );
    await client.query("select set_config('app.actor_id',$1,true)", [user]);
    for (const [id, name] of [
      [first, "First Ember Outlet"],
      [second, "Second Ember Outlet"],
    ]) {
      await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
        id,
        crypto.randomUUID(),
        JSON.stringify({
          name,
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
        }),
      ]);
      await client.query("update organizations set mfa_required=false where id=$1", ["org-" + id]);
    }
    const document = menuDocumentSchema.parse({
      name: "Ember published lunch",
      currency: "INR",
      categories: [
        {
          id: "mains",
          name: "Mains",
          items: [{ id: "paneer", name: "Paneer Tikka", priceMinor: 15000 }],
        },
      ],
    });
    await client.query("select app_private.menu_command($1,$2,'save',$3::jsonb,$4,1)", [
      first,
      menuId,
      JSON.stringify({ document }),
      crypto.randomUUID(),
    ]);
    await client.query("select app_private.menu_command($1,$2,'publish','{}'::jsonb,$3,2)", [
      first,
      menuId,
      crypto.randomUUID(),
    ]);
    await client.query("select app_private.menu_command($1,$2,'override',$3::jsonb,$4,3)", [
      first,
      menuId,
      JSON.stringify({
        outletId: first,
        dishId: "paneer",
        priceMinor: 13500,
        soldOut: null,
      }),
      crypto.randomUUID(),
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  return { email, password, first, second, menuId };
}
type Fixture = Awaited<ReturnType<typeof seed>>;

async function switchOutlet(page: import("@playwright/test").Page, outletId: string) {
  return page.request.post("/api/context", {
    headers: { origin: "https://localhost:3443" },
    data: { outletId },
  });
}

test.beforeEach(async ({ page }) => {
  expect(process.env["AI_ASSISTANT_READ_ONLY_ENABLED"]).toBe("true");
  expect(process.env["AI_ASSISTANT_ACTIONS_ENABLED"]).toBe("true");
  expect(process.env["CLOUDFLARE_API_TOKEN"]).toBe("synthetic-browser-test-never-used");
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
});
async function signIn(page: import("@playwright/test").Page, f: Fixture) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect((await switchOutlet(page, f.first)).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Open Ember assistant" })).toBeVisible();
}
test("mobile bounds, keyboard trap, Escape, reduced-motion and restored focus", async ({
  page,
}) => {
  const f = await seed();
  await signIn(page, f);
  const launcher = page.getByRole("button", { name: "Open Ember assistant" });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: /Ember/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("For First Ember Outlet")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close assistant" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
});
test("explicit action acknowledgement, authoritative persistence and reload recovery", async ({
  page,
}) => {
  const f = await seed();
  await signIn(page, f);
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  const dialog = page.getByRole("dialog", { name: /Ember/ });
  await dialog.getByRole("button", { name: "New chat" }).click();
  await expect(dialog.getByRole("button", { name: "Actions" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Actions" }).click();
  const editor = dialog.getByRole("region", { name: "Prepare availability proposal" });
  await editor.getByLabel("Published menu").selectOption(f.menuId);
  await editor.getByLabel("Dish").selectOption("paneer");
  await expect(editor).toContainText("Proposed:");
  await editor.getByRole("button", { name: "Create review proposal" }).click();
  const proposal = dialog.getByRole("region", { name: "Availability action proposal" });
  const confirm = proposal.getByRole("button", { name: "Confirm change" });
  await expect(confirm).toBeDisabled();
  await proposal.getByRole("checkbox", { name: "I have reviewed this exact change." }).check();
  await confirm.click();
  await expect(proposal).toContainText("Confirmed in the current menu revision.");
  const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  try {
    const result = await pool.query(
      "select sold_out,price_minor from menu_overrides where menu_id=$1 and outlet_id=$2 and dish_id='paneer'",
      [f.menuId, f.first]
    );
    expect(result.rows[0]).toMatchObject({ sold_out: true, price_minor: 13500 });
  } finally {
    await pool.end();
  }
  await page.reload();
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  await expect(page.getByRole("region", { name: "Availability action proposal" })).toContainText(
    "CONFIRMED"
  );
  await expect(page.getByRole("button", { name: "Confirm change" })).toHaveCount(0);
});
test("a recorded failed inference is not presented as an uncertain network outcome", async ({
  page,
}) => {
  const f = await seed();
  await signIn(page, f);
  await page.route("**/api/assistant/conversations/*/turns", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        turnId: crypto.randomUUID(),
        status: "failed",
        errorCode: "provider_error",
      }),
    })
  );
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  const dialog = page.getByRole("dialog", { name: /Ember/ });
  await dialog.getByPlaceholder("Ask about this outlet…").fill("How is my queue?");
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(
    dialog.getByText("Ember could not verify the answer. No business change occurred.")
  ).toBeVisible();
  await expect(dialog.getByText(/request may have been recorded/)).toHaveCount(0);
});

test("switching outlets resets the assistant and keeps history scoped", async ({ page }) => {
  const f = await seed();
  await signIn(page, f);
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  const dialog = page.getByRole("dialog", { name: /Ember/ });
  await dialog.getByRole("button", { name: "New chat" }).click();
  await expect(dialog.getByText("For First Ember Outlet")).toBeVisible();
  await dialog.getByRole("button", { name: "Close assistant" }).click();
  expect((await switchOutlet(page, f.second)).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  const other = page.getByRole("dialog", { name: /Ember/ });
  await expect(other.getByText("For Second Ember Outlet")).toBeVisible();
  await other.getByRole("button", { name: "History" }).click();
  await expect(other.getByText("No conversations yet.")).toBeVisible();
  await other.getByRole("button", { name: "Close assistant" }).click();
  expect((await switchOutlet(page, f.first)).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Open Ember assistant" }).click();
  const first = page.getByRole("dialog", { name: /Ember/ });
  await expect(first.getByText("For First Ember Outlet")).toBeVisible();
  await first.getByRole("button", { name: "History" }).click();
  await expect(first.getByText("No conversations yet.")).toHaveCount(0);
});
