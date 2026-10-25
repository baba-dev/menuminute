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
  return { email, password, outlet };
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
  await expect(page.getByRole("heading", { name: /Your menu\. Digitized\./ })).toBeVisible();
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

test("scan table allows selecting photos before creating a private session", async ({ page }) => {
  test.setTimeout(90000);
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu/import");
  await expect(page.getByRole("heading", { name: "Your menu. Digitized." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Import progress" })).toBeVisible();
  await page.getByLabel("Choose menu photographs").setInputFiles({
    name: "baba-bakery.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 640, height: 480, channels: 3, background: "white" } }).png().toBuffer(),
  });
  await expect(page.getByText("baba-bakery.png")).toBeVisible();
  await page.getByRole("button", { name: "Upload photos privately" }).click();
  await expect(page.getByText("Page 1 · ready")).toBeVisible();
  await page.getByRole("button", { name: "All drafts" }).click();
  await expect(page.getByRole("button", { name: /Collect photographs/ })).toBeVisible();
});

test("reviewer corrects an unreadable price and applies only a private draft", async ({ page }) => {
  test.setTimeout(90000);
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu/import");
  await page.getByRole("button", { name: "Create private draft" }).click();
  await expect(page.getByRole("heading", { name: "Collect photographs" })).toBeVisible();
  await page.getByLabel("Choose menu photographs").setInputFiles({
    name: "menu.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 320, height: 280, channels: 3, background: "white" } })
      .png()
      .toBuffer(),
  });
  await page.getByRole("button", { name: "Upload photos privately" }).click();
  await expect(page.getByText("Page 1 · ready")).toBeVisible();
  // Simulate PR B's already-validated candidate without calling an external provider.
  const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  let importId = "";
  try {
    const row = (
      await pool.query(
        "select i.id as id,s.id as source from menu_imports i join menu_import_sources s on s.import_id=i.id where i.outlet_id=$1 and s.status='ready' order by i.created_at desc limit 1",
        [f.outlet]
      )
    ).rows[0];
    expect(row).toBeTruthy();
    importId = row.id as string;
    const revision = (
      await pool.query(
        "update menu_imports set status='needs_review',revision=revision+1 where id=$1 returning revision",
        [row.id]
      )
    ).rows[0].revision;
    const candidate = {
      schemaVersion: 1,
      importId,
      currency: "INR",
      categories: [
        {
          id: crypto.randomUUID(),
          name: { value: "Starters", evidence: [{ sourceId: row.source, excerpt: "Starters" }] },
          items: [
            {
              id: crypto.randomUUID(),
              name: { value: "Curry", evidence: [{ sourceId: row.source, excerpt: "Curry" }] },
              priceMinor: {
                value: null,
                review: "needs_attention",
                evidence: [{ sourceId: row.source, excerpt: "Unclear" }],
              },
              variants: [],
            },
          ],
        },
      ],
    };
    await pool.query(
      "insert into menu_import_candidates(import_id,organization_id,outlet_id,revision,schema_version,document) select id,organization_id,outlet_id,$2,1,$3::jsonb from menu_imports where id=$1",
      [importId, revision, JSON.stringify(candidate)]
    );
  } finally {
    await pool.end();
  }
  await page.getByRole("button", { name: "Refresh import" }).click();
  await expect(page.getByRole("link", { name: /Open source-aware review/ })).toBeVisible();
  await page.getByRole("link", { name: /Open source-aware review/ }).click();
  await expect(page.getByRole("heading", { name: "Perfect every detail." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Needs review (2)" })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("125%")).toBeVisible();
  await page.getByRole("button", { name: "Fit" }).click();
  await expect(page.getByText(/AI could not verify this price/)).toBeVisible();
  await page.getByLabel("Dish 1.1 price").fill("12.50");
  await page.getByLabel("I checked this category heading against the photograph").check();
  await page
    .getByLabel("I verified this dish, description and its price against the photograph")
    .check();
  await page.getByRole("button", { name: "Confirm review" }).click();
  await expect(page.getByText(/Human review confirmed/)).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Apply to private draft" }).click();
  await expect(page.getByText(/Applied to a PRIVATE menu draft/)).toBeVisible();
  const verify = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  try {
    const applied = (
      await verify.query(
        "select r.state,r.applied_menu_id,m.published_revision,m.document from menu_import_reviews r join menus m on m.id=r.applied_menu_id where r.import_id=$1",
        [importId]
      )
    ).rows[0];
    expect(applied.state).toBe("applied");
    expect(applied.published_revision).toBeNull();
    expect(applied.document.categories[0].items[0].priceMinor).toBe(1250);
    expect(
      (
        await verify.query("select count(*)::int AS n from menu_releases where menu_id=$1", [
          applied.applied_menu_id,
        ])
      ).rows[0].n
    ).toBe(0);
  } finally {
    await verify.end();
  }
});
