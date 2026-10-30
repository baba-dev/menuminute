import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

// The normal CI build keeps Ember disabled; this runs in the Ember-enabled browser lane.
test.skip(
  process.env["AI_ASSISTANT_READ_ONLY_ENABLED"] !== "true",
  "Shift summary requires the isolated Ember-enabled fixture"
);

async function seedOwner() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The dashboard delight browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const email = "delight-" + userId + "@browser.invalid";
  const password = "delight-browser-password";
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Delight owner',$2,true)",
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
          name: "Delight Test Kitchen",
          country: "OM",
          currency: "OMR",
          timezone: "Asia/Muscat",
          outletType: "cafe",
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
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
}

const evidence = [
  {
    tool: "orders.pulse",
    source: "orders.servicePulse",
    capturedAt: "2027-01-02T09:30:00.000Z",
    data: { pending: 2, preparing: 3, ready: 1, active: 6, completedToday: 41 },
  },
];

test("a manager can draft, review, copy and keep a shift summary", async ({ page }) => {
  test.setTimeout(120000);
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => undefined);
  const seen: { conversation: string[]; turn: string[]; prompt: string[] } = {
    conversation: [],
    turn: [],
    prompt: [],
  };
  await page.route("**/api/assistant/conversations", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    seen.conversation.push(route.request().postDataJSON().key);
    return route.fulfill({ json: { id: "conv-1", updatedAt: new Date().toISOString() } });
  });
  await page.route("**/api/assistant/conversations/conv-1/turns", (route) => {
    const body = route.request().postDataJSON();
    seen.turn.push(body.key);
    seen.prompt.push(body.prompt);
    return route.fulfill({
      json: {
        turnId: "turn-1",
        status: "completed",
        answer:
          "A steady shift.\n- 41 orders completed\n- 2 awaiting acceptance\n- 17 covers seated",
        evidence,
      },
    });
  });
  await signIn(page, await seedOwner());
  const trigger = page.getByRole("button", { name: "Shift summary" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Shift summary — draft" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Draft today’s summary" }).click();

  const draft = dialog.getByRole("textbox", { name: /Shift summary draft/ });
  await expect(draft).toHaveValue(/41 orders completed/);
  await expect(dialog.getByText(/Draft\. Check the figures before sharing/)).toBeVisible();
  // 17 is not in the evidence: the reviewer is warned, nothing is silently trusted.
  await expect(dialog.getByRole("alert")).toContainText("17");
  await expect(dialog.getByRole("alert")).not.toContainText("41");
  // The prompt forbids money and allergen claims and carries no merchant-chosen text.
  expect(seen.prompt[0]).toMatch(/Do not state money amounts/);
  expect(seen.prompt[0]).not.toContain("Delight Test Kitchen");

  await draft.fill("Edited by the manager.");
  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: /Download \.txt/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^shift-summary-delight-test-kitchen-\d{4}-\d{2}-\d{2}\.txt$/
  );

  // Escape closes, focus returns to the trigger, and the edited draft is kept.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("textbox", { name: /Shift summary draft/ })).toHaveValue(
    "Edited by the manager."
  );
});

test("a failed draft is recoverable and a retry reuses the same idempotency keys", async ({
  page,
}) => {
  test.setTimeout(120000);
  const keys: { conversation: string[]; turn: string[] } = { conversation: [], turn: [] };
  let attempts = 0;
  await page.route("**/api/assistant/conversations", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    keys.conversation.push(route.request().postDataJSON().key);
    return route.fulfill({ json: { id: "conv-2", updatedAt: new Date().toISOString() } });
  });
  await page.route("**/api/assistant/conversations/conv-2/turns", (route) => {
    keys.turn.push(route.request().postDataJSON().key);
    attempts += 1;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: { turnId: "t", status: "failed", errorCode: "processing_failed" },
      });
    return route.fulfill({
      json: {
        turnId: "t",
        status: "completed",
        answer: "Recovered. 41 orders completed.",
        evidence,
      },
    });
  });
  await signIn(page, await seedOwner());
  await page.getByRole("button", { name: "Shift summary" }).click();
  const dialog = page.getByRole("dialog", { name: "Shift summary — draft" });
  await dialog.getByRole("button", { name: "Draft today’s summary" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No business change occurred");
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("textbox", { name: /Shift summary draft/ })).toHaveValue(
    /Recovered/
  );
  expect(new Set(keys.conversation).size).toBe(1);
  expect(new Set(keys.turn).size).toBe(1);
  expect(keys.turn).toHaveLength(2);
});
