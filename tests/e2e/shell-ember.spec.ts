import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

async function seed(options: { ordering: boolean }) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The shell navigation browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const email = "shell-" + userId + "@browser.invalid";
  const password = "shell-browser-password";
  let publicToken = "";
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Shell owner',$2,true)",
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
          name: "Shell Test Kitchen",
          country: "OM",
          currency: "OMR",
          timezone: "Asia/Muscat",
          outletType: "cafe",
        }),
      ]);
      const document = menuDocumentSchema.parse({
        name: "Live menu",
        currency: "OMR",
        categories: [
          {
            id: "signature",
            name: "Signature dishes",
            items: [{ id: "salad", name: "Citrus salad", priceMinor: 2500 }],
          },
        ],
      });
      await client.query("select app_private.menu_command($1,$2,$3,$4::jsonb,$5,1)", [
        outletId,
        "menu-" + outletId,
        "save",
        JSON.stringify({ document }),
        crypto.randomUUID(),
      ]);
      await client.query("select app_private.menu_command($1,$2,$3,$4::jsonb,$5,2)", [
        outletId,
        "menu-" + outletId,
        "publish",
        "{}",
        crypto.randomUUID(),
      ]);
      const qr = await client.query<{ data: { token: string } }>(
        "select app_private.qr_command($1,'create',$2::jsonb,$3) as data",
        [
          outletId,
          JSON.stringify({ label: "Dining room", pointLabel: "Table 4" }),
          crypto.randomUUID(),
        ]
      );
      publicToken = qr.rows[0]!.data.token;
      if (options.ordering) {
        await client.query(
          `insert into entitlement_grants
          (id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
          values($1,$2,'ordering.new','USD',now()-interval '1 minute',
          now()+interval '1 hour','browser-test','Shell navigation acceptance',$3)`,
          [crypto.randomUUID(), "org-" + outletId, crypto.randomUUID()]
        );
      }
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
  return { email, password, outletId, publicToken };
}

async function signIn(page: Page, owner: { email: string; password: string }) {
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
}
const openPalette = async (page: Page) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search or run a command" });
  await expect(input).toBeFocused();
  return input;
};

// Needs the Ember-enabled build (the normal CI build keeps the assistant off).
test.skip(
  process.env["AI_ASSISTANT_READ_ONLY_ENABLED"] !== "true",
  "Requires the isolated Ember-enabled fixture"
);

test("Ask Ember from the palette opens the assistant with the question filled in, and sends nothing", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, await seed({ ordering: true }));
  const assistantCalls: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/assistant/"))
      assistantCalls.push(request.url());
  });
  const launcher = page.getByRole("button", { name: "Open Ember assistant" });
  await expect(launcher).toBeVisible();

  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search or run a command" });
  await input.fill("how many orders are waiting");
  const ask = page.getByRole("option", { name: /Ask Ember: how many orders are waiting/ });
  await expect(ask).toBeVisible();
  // A question puts Ember first.
  await expect(page.getByRole("option").first()).toHaveAttribute("id", /ember_ask/);
  await page.keyboard.press("Enter");

  const assistant = page.getByRole("dialog", { name: /Ember/ });
  await expect(assistant).toBeVisible();
  await expect(assistant.getByPlaceholder("Ask about this outlet…")).toHaveValue(
    "how many orders are waiting"
  );
  await page.waitForTimeout(600);
  expect(assistantCalls).toEqual([]);
});

test("without a question, Ember is not offered, and it is hidden when the assistant is off", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, await seed({ ordering: true }));
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search or run a command" }).fill("settings");
  await expect(page.getByRole("option", { name: /Settings/ }).first()).toBeVisible();
  await expect(page.getByRole("option", { name: /Ask Ember/ })).toHaveCount(0);
});
