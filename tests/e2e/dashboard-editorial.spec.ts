import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

async function seedPublishedOutlet(publish = true) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The editorial dashboard browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const email = "editorial-" + userId + "@browser.invalid";
  const password = "editorial-browser-password";
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "insert into users(id,name,email,email_verified) values($1,'Editorial owner',$2,true)",
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
          name: "Editorial Test Kitchen",
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
      if (publish) {
        await client.query("select app_private.menu_command($1,$2,$3,$4::jsonb,$5,2)", [
          outletId,
          "menu-" + outletId,
          "publish",
          "{}",
          crypto.randomUUID(),
        ]);
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
  return { email, password, outletId };
}

test("private editorial dashboard renders real KPIs, tooltips and responsive artwork", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const owner = await seedPublishedOutlet();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Make something delicious today/ })).toBeVisible();
  await expect(page.getByText("Editorial Test Kitchen").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByText("Guest-visible releases")).toBeVisible();
  await expect(page.getByText("Published and visible")).toBeVisible();
  await expect(page.getByRole("link", { name: "Public menu" })).toBeVisible();
  await page.getByRole("button", { name: "Dish Availability" }).click();
  const dialog = page.getByRole("dialog", { name: "Dish Availability" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Citrus salad")).toBeVisible();
  await expect(dialog.getByText("Signature dishes")).toBeVisible();
  await dialog.getByRole("button", { name: /Mark sold out Citrus salad/ }).click();
  await expect(dialog.getByRole("button", { name: /Restore Citrus salad/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Dish Availability" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Dish Availability" })
      .getByRole("button", { name: /Restore Citrus salad/ })
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Dish Availability" })
    .getByRole("button", { name: /Restore Citrus salad/ })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Dish Availability" })
      .getByRole("button", { name: /Mark sold out Citrus salad/ })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "About Published menus" }).click();
  await expect(page.getByRole("dialog", { name: "About Published menus" })).toContainText(
    "committed menus"
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Today’s priorities" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("dashboard-light-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: info.outputPath("dashboard-dark-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: info.outputPath("dashboard-dark-desktop.png"), fullPage: true });
});

test("editorial assets resolve with correct media types", async ({ request }) => {
  const files = [
    ["hero-desktop-light.webp", "image/webp"],
    ["hero-desktop-dark.webp", "image/webp"],
    ["priorities-illustration.webp", "image/webp"],
    ["outlet-health-illustration.webp", "image/webp"],
    ["hero-mobile-light.webp", "image/webp"],
    ["hero-mobile-dark.webp", "image/webp"],
  ];
  for (const [file, mime] of files) {
    const response = await request.get("/brand/dashboard/editorial/" + file);
    expect(response.status(), file).toBe(200);
    expect(response.headers()["content-type"], file).toContain(mime);
  }
});

test("an outlet with an unpublished draft receives honest next-step guidance", async ({ page }) => {
  const owner = await seedPublishedOutlet(false);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();
  await expect(page.getByText("Public menu unavailable")).toBeVisible();
  await expect(page.getByText("Continue your saved menu")).toBeVisible();
  await expect(page.getByText("Not live", { exact: true })).toBeVisible();
  await expect(page.getByText("1 menu has unpublished changes.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Public menu" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dish Availability" })).toBeVisible();
});

test("service pulse requires a session and never caches tenant data", async ({ request }) => {
  const response = await request.get("/api/dashboard/pulse");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("service pulse resolves the authorized outlet, ignoring forged outlet headers", async ({
  page,
}) => {
  const owner = await seedPublishedOutlet();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("editorial-dashboard")).toBeVisible();

  const response = await page.request.get("/api/dashboard/pulse", {
    headers: { "x-outlet-id": "forged-unrelated-outlet-id" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["vary"]).toContain("Cookie");
  const json = await response.json();
  expect(json.outletId).toBe(owner.outletId);
  expect(json.state).toBe("ready");
  expect(json.data).toMatchObject({
    pending: 0,
    preparing: 0,
    ready: 0,
    completedToday: 0,
  });
  expect(Date.parse(json.checkedAt)).not.toBeNaN();

  await expect(page.getByText(/Snapshot updated at/)).toBeVisible();
  await page.getByRole("button", { name: "Refresh service activity" }).click();
  await expect(page.getByText(/Snapshot updated at/)).toBeVisible();

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
});
