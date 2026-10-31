import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";

async function seed(options: { ordering: boolean; outlets?: number }) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("The shell navigation browser test requires an isolated test database");
  const pool = new Pool({ connectionString: url, max: 1 });
  const userId = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const secondaryOutletId = options.outlets === 2 ? crypto.randomUUID() : null;
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
      if (secondaryOutletId) {
        await client.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
          secondaryOutletId,
          crypto.randomUUID(),
          JSON.stringify({
            name: "Second Shell Kitchen",
            country: "OM",
            currency: "OMR",
            timezone: "Asia/Muscat",
            outletType: "cafe",
          }),
        ]);
      }
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
  return { email, password, outletId, secondaryOutletId, publicToken };
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

test.describe("desktop shell", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop layout");

  test("the sidebar is grouped and unavailable items collapse into Add-ons", async ({ page }) => {
    await signIn(page, await seed({ ordering: true }));
    const nav = page.getByRole("navigation", { name: "Workspace" });
    for (const group of ["Run service", "Menu", "Insights", "Admin"])
      await expect(nav.getByRole("group", { name: group })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dining floor" })).toBeVisible();
    // An owner can always set up the kitchen, so it is a normal link here, and with nothing
    // unavailable there is no Add-ons section to distract from.
    await expect(nav.getByRole("link", { name: "Kitchen Setup" })).toBeVisible();
    await expect(nav.getByRole("button", { name: /Add-ons/ })).toHaveCount(0);
  });

  test("a single outlet has no selector or profile footer and keeps account access", async ({
    page,
  }) => {
    await signIn(page, await seed({ ordering: true }));
    const sidebar = page.getByLabel("Workspace sidebar");
    await expect(sidebar.locator(".mm-workspace-outlet")).toHaveCount(0);
    await expect(sidebar.locator(".mm-workspace-profile")).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Account settings for/ })).toHaveAttribute(
      "href",
      "/account"
    );
    for (const width of [920, 1280]) {
      await page.setViewportSize({ width, height: 720 });
      const overflow = await sidebar
        .locator(".mm-workspace-nav")
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflow).toBe(false);
    }
    await page.setViewportSize({ width: 1024, height: 420 });
    const nav = sidebar.getByRole("navigation", { name: "Workspace" });
    await nav.getByRole("link", { name: "Settings", exact: true }).scrollIntoViewIfNeeded();
    await expect(nav.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  });

  test("multi-outlet owners can switch without duplicated outlet metadata", async ({ page }) => {
    const owner = await seed({ ordering: true, outlets: 2 });
    await signIn(page, owner);
    const sidebar = page.getByLabel("Workspace sidebar");
    await expect(sidebar.getByText("Current outlet")).toBeVisible();
    await expect(sidebar.getByText(/Selected outlet| · OMR/)).toHaveCount(0);
    const selector = sidebar.getByRole("combobox", { name: "Active outlet" });
    await expect(selector.locator("option")).toHaveCount(3);
    const selected = await selector.inputValue();
    const target = selected === owner.outletId ? owner.secondaryOutletId! : owner.outletId;
    await selector.selectOption(target);
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/context");
        return (await response.json()).selectedOutletId;
      })
      .toBe(target);
    await expect(selector).toHaveValue(target);
  });

  test("a menu-only outlet keeps ordering pages out of the sidebar, with an upgrade hint", async ({
    page,
  }) => {
    await signIn(page, await seed({ ordering: false }));
    const nav = page.getByRole("navigation", { name: "Workspace" });
    await expect(nav.getByRole("link", { name: "Orders" })).toHaveCount(0);
    await nav.getByRole("button", { name: /Add-ons/ }).click();
    await expect(nav.getByText(/Upgrade to enable it/).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: "See plans" }).first()).toHaveAttribute(
      "href",
      "/pricing"
    );
    await expect(nav.getByRole("link", { name: "Menu Studio" })).toBeVisible();
  });

  test("the palette finds a dish, marks it sold out for real, and returns focus", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    const owner = await seed({ ordering: true });
    await signIn(page, owner);
    const trigger = page.getByRole("button", { name: /Search pages/ });
    await trigger.click();
    const input = page.getByRole("combobox", { name: "Search or run a command" });
    await expect(input).toBeFocused();
    await input.fill("citrus");
    await expect(page.getByRole("option", { name: /Mark Citrus salad sold out/ })).toBeVisible();
    await page.keyboard.press("Enter");
    // It stays open and confirms only after the server has accepted the change.
    await expect(page.getByRole("option", { name: /Restore Citrus salad/ })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();

    const guest = await context.newPage();
    await guest.goto("/m/" + owner.publicToken);
    await expect(guest.getByText(/Sold Out/i).first()).toBeVisible();
    await guest.close();

    // Put it back so the outlet is left as it was found.
    await page.getByRole("option", { name: /Restore Citrus salad/ }).click();
    await expect(page.getByRole("option", { name: /Mark Citrus salad sold out/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("the palette navigates to pages and deep-links an order search into History", async ({
    page,
  }) => {
    await signIn(page, await seed({ ordering: true }));
    let input = await openPalette(page);
    await input.fill("settings");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(page.locator("#workspace-main h1")).toBeFocused();

    input = await openPalette(page);
    await input.fill("#99999");
    await expect(page.getByRole("option", { name: /Search orders for #99999/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/orders\?q=99999&tab=history/);
    await expect(page.getByRole("tab", { name: /History/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByPlaceholder("Search order # or guest")).toHaveValue("99999");
  });

  test("the topbar shows connection and till state, and + New lists what can be created", async ({
    page,
  }) => {
    await signIn(page, await seed({ ordering: true }));
    await expect(page.getByRole("button", { name: /Live.*Last synced/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Till closed/ })).toBeVisible();
    await page.getByRole("button", { name: /New/ }).click();
    await expect(page.getByRole("menuitem", { name: "New order" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add a dish" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("one sound setting, set in the notification drawer, is the one the Orders page shows", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, await seed({ ordering: true }));
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const drawer = page.getByRole("dialog", { name: "Notifications" });
    await expect(drawer.getByText(/All clear/)).toBeVisible();
    const toggle = drawer.getByRole("switch", { name: /Chime for new orders/ });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    await page.goto("/dashboard/orders");
    await expect(page.getByRole("button", { name: /Chime on/ })).toBeVisible();
    // Turning it off here turns it off everywhere, including the drawer.
    await page.getByRole("button", { name: /Chime on/ }).click();
    await expect(page.getByRole("button", { name: /Chime off/ })).toBeVisible();
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Notifications" })
        .getByRole("switch", { name: /Chime for new orders/ })
    ).toHaveAttribute("aria-checked", "false");
  });

  test("the dining floor has its own page", async ({ page }) => {
    await signIn(page, await seed({ ordering: true }));
    await page.getByRole("link", { name: "Dining floor" }).click();
    await expect(page).toHaveURL(/\/dashboard\/floor/);
    await expect(page.getByRole("heading", { name: "Dining floor", level: 1 })).toBeVisible();
    await expect(page.getByTestId("floor-page")).toBeVisible();
  });
});

test.describe("phone shell", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone layout");

  test("a bottom bar replaces the sidebar links, and More holds the rest", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, await seed({ ordering: true }));
    const bar = page.getByRole("navigation", { name: "Primary" });
    await expect(bar).toBeVisible();
    for (const name of ["Orders", "Point of Sale", "Dining floor", "More"])
      await expect(bar.getByRole(name === "More" ? "button" : "link", { name })).toBeVisible();
    // The old chip row is gone, and the bar never makes the page scroll sideways.
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    // Touch targets are comfortably large.
    const box = await bar.getByRole("link", { name: "Orders" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await bar.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("link", { name: "Menu Studio" })).toBeVisible();
    await sheet.getByRole("link", { name: "Menu Studio" }).click();
    await expect(page).toHaveURL(/\/dashboard\/menu/);
    await expect(page.getByRole("dialog", { name: "More" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "More" })).toBeVisible();
  });

  test("a mobile single outlet uses the compact header, without sideways scrolling", async ({
    page,
  }) => {
    await signIn(page, await seed({ ordering: true }));
    const sidebar = page.getByLabel("Workspace sidebar");
    await expect(sidebar.locator(".mm-workspace-outlet")).toHaveCount(0);
    await expect(sidebar.locator(".mm-workspace-profile")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "More" })
      .click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("link", { name: "Account & security" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Platform admin" })).toHaveCount(0);
  });

  test("a mobile multi-outlet account retains its context switcher", async ({ page }) => {
    const owner = await seed({ ordering: true, outlets: 2 });
    await signIn(page, owner);
    const sidebar = page.getByLabel("Workspace sidebar");
    await expect(sidebar.getByText("Current outlet")).toBeVisible();
    await expect(sidebar.getByRole("combobox", { name: "Active outlet" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });

  test("Menu Studio's own action bar sits above the nav bar instead of hiding under it", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, await seed({ ordering: false }));
    await page.goto("/dashboard/menu");
    const actions = page.getByRole("group", { name: "Draft and publication actions" });
    await expect(actions).toBeVisible();
    const bar = page.getByRole("navigation", { name: "Primary" });
    const [actionBox, barBox] = [await actions.boundingBox(), await bar.boundingBox()];
    expect(actionBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    // Two stacked bars must not overlap, or the Studio's Save / Publish buttons become unreachable.
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
    // And the last control on the page can be scrolled clear of both.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page
      .locator("#workspace-main")
      .locator("button, a, input, select, textarea")
      .last();
    const lastBox = await last.boundingBox();
    if (lastBox) expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(actionBox!.y + 1);
  });

  test("a menu-only outlet still gets a useful bar", async ({ page }) => {
    await signIn(page, await seed({ ordering: false }));
    const bar = page.getByRole("navigation", { name: "Primary" });
    // The owner can set up the kitchen, which takes a slot; Overview and Menu fill the rest.
    for (const name of ["Overview", "Point of Sale", "Kitchen Setup", "Menu Studio"])
      await expect(bar.getByRole("link", { name })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Orders" })).toHaveCount(0);
  });

  test("search and notifications are reachable from More", async ({ page }) => {
    await signIn(page, await seed({ ordering: true }));
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "More" })
      .click();
    await page
      .getByRole("dialog", { name: "More" })
      .getByRole("button", { name: /Search/ })
      .click();
    await expect(page.getByRole("combobox", { name: "Search or run a command" })).toBeFocused();
    await page.keyboard.press("Escape");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "More" })
      .click();
    await page
      .getByRole("dialog", { name: "More" })
      .getByRole("button", { name: /Notifications/ })
      .click();
    await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
  });
});

test("floor lifecycle keeps one physical table, QR association, and reservation conflict", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await seed({ ordering: true });
  await signIn(page, fixture);
  await page.goto("/dashboard/floor");
  await expect(page.getByRole("heading", { name: "Dining floor", level: 1 })).toBeVisible();
  await expect(page.getByTestId("floor-page")).toBeVisible();
  const headers = { "x-outlet-id": fixture.outletId };
  const response = await page.request.get("/api/floor", { headers });
  expect(response.ok()).toBe(true);
  const initial = await response.json();
  const table = {
    id: crypto.randomUUID(), tableNumber: "QA-1", label: "QR test", capacity: 4,
    shape: "square", x: 200, y: 200, width: 100, height: 100,
    rotation: 0, section: initial.layout.sections[0].name, assignedStaff: null,
  };
  const created = await page.request.post("/api/floor/tables", {
    headers, data: { table, layout: { ...initial.layout, tables: [...initial.layout.tables, table] } }
  });
  expect(created.status()).toBe(200);
  const floor = await page.request.get("/api/floor", { headers });
  expect(floor.ok()).toBe(true);
  expect((await floor.json()).layout.tables.filter((item: { id: string }) => item.id === table.id))
    .toHaveLength(1);
  const qr = await page.request.post("/api/floor/tables/qr", {
    headers, data: { tableId: table.id }
  });
  expect(qr.status()).toBe(200);
  expect((await qr.json()).tableId).toBe(table.id);
  const duplicate = await page.request.post("/api/floor/tables/qr", {
    headers, data: { tableId: table.id }
  });
  expect(duplicate.status()).toBe(200);
  expect((await duplicate.json()).id).toBe((await qr.json()).id);

  const start = new Date(Date.now() + 86400000 * 3).toISOString();
  const booking = {
    tableId: table.id, guestName: "Floor QA", partySize: 2,
    reservationTime: start, durationMinutes: 90,
  };
  expect((await page.request.post("/api/floor/reservations", { headers, data: booking })).ok())
    .toBe(true);
  expect((await page.request.post("/api/floor/reservations", { headers, data: booking })).status())
    .toBe(409);
  const archive = await page.request.delete("/api/floor/tables", {
    headers,
    data: {
      tableId: table.id,
      layout: {
        ...(await created.json()),
        tables: (await created.json()).tables.filter((item: { id: string }) => item.id !== table.id)
      }
    }
  });
  expect(archive.status()).toBe(409);
});
