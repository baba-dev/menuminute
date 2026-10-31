import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
async function seed() {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated browser database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const id = crypto.randomUUID();
  const email = `domain-${id}@browser.invalid`;
  const password = "browser-domain-password";
  const memberId = crypto.randomUUID();
  const memberEmail = `member-${id}@browser.invalid`;
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  try {
    const hash = await hashPassword(password);
    const c = await pool.connect();
    try {
      await c.query("begin");
      for (const [uid, mail, name] of [
        [id, email, "Browser owner"],
        [memberId, memberEmail, "Browser staff"],
      ]) {
        await c.query("insert into users(id,name,email,email_verified) values($1,$2,$3,true)", [
          uid,
          name,
          mail,
        ]);
        await c.query(
          "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
          [crypto.randomUUID(), uid, hash]
        );
      }
      await c.query("select set_config('app.actor_id',$1,true)", [id]);
      for (const [outlet, name] of [
        [first, "Alpha Domain"],
        [second, "Beta Domain"],
      ])
        await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
          outlet,
          crypto.randomUUID(),
          JSON.stringify({
            name,
            country: "IN",
            currency: "INR",
            timezone: "Asia/Kolkata",
            outletType: "restaurant",
          }),
        ]);
      await c.query("update organizations set mfa_required=false where id=any($1::text[])", [
        [`org-${first}`, `org-${second}`],
      ]);
      // This existing-member fixture exercises outlet grants. The separate invitation
      // lifecycle suite tests real issuance, verification, consent and replay prevention.
      await c.query(
        "insert into organization_members(id,organization_id,user_id,role,is_active) values($1,$2,$3,'member',true)",
        [crypto.randomUUID(), `org-${first}`, memberId]
      );
      await c.query("commit");
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
  return {
    email,
    password,
    memberEmail,
    first,
    second,
    org: `org-${first}`,
    otherOrg: `org-${second}`,
  };
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}
test("organization and outlet management, scoped roles, billing and suspension recovery", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const f = await seed();
  await login(page, f.email, f.password);
  const organizationLink = page.getByRole("link", { name: "Organization & access" });
  // On a phone the sidebar is replaced by the bottom bar; this page lives under More there.
  if (!(await organizationLink.isVisible()))
    await page.getByRole("button", { name: "More" }).click();
  await organizationLink.click();
  await expect(page.getByRole("heading", { name: "Organization management" })).toBeVisible();
  await page.getByLabel("Organization", { exact: true }).selectOption(f.org);
  const rename = page
    .getByRole("button", { name: "Save organization name" })
    .locator("xpath=ancestor::form");
  await rename.getByLabel("Organization name", { exact: true }).fill("Alpha Renamed");
  await rename.getByRole("button", { name: "Save organization name" }).click();
  await expect(rename.getByRole("status")).toHaveText("Saved");
  const create = page
    .getByRole("button", { name: "Create outlet", exact: true })
    .locator("xpath=ancestor::form");
  await create.getByLabel("Outlet name").fill("Scoped Pickup");
  await create.getByLabel("Currency", { exact: true }).fill("OMR");
  await create.getByLabel("Timezone").selectOption("Asia/Muscat");
  await create.getByLabel("Outlet type").selectOption("cafe");
  await create.getByLabel("Dine-in").uncheck();
  await create.getByLabel("Pickup", { exact: true }).check();
  await create.getByRole("button", { name: "Create outlet", exact: true }).click();
  await expect(create.getByRole("status")).toHaveText("Saved");
  await expect(page.getByRole("heading", { name: "Invite a teammate" })).toBeVisible();
  const roles = page
    .getByRole("button", { name: "Save outlet roles" })
    .locator("xpath=ancestor::form");
  await roles.getByLabel("Outlet", { exact: true }).selectOption({ label: "Scoped Pickup" });
  await roles
    .getByLabel("Member", { exact: true })
    .selectOption({ label: `Browser staff (${f.memberEmail})` });
  await roles.getByLabel("manager", { exact: true }).check();
  await roles.getByRole("button", { name: "Save outlet roles" }).click();
  await expect(roles.getByRole("status")).toHaveText("Saved");
  const list = await page.request.get(`/api/organizations/${f.org}`);
  const detail = await list.json();
  const pickup = detail.outlets.find((o: { name: string }) => o.name === "Scoped Pickup");
  await page.reload();
  await page.getByLabel("Active outlet").selectOption(pickup.id);
  await expect(page.getByLabel("Active outlet")).toHaveValue(pickup.id);
  await page.goto("/dashboard");
  // The compact sidebar no longer repeats the selected outlet as a heading.
  // Verify persisted, authorized outlet context instead of relying on removed chrome.
  const activeContext = await page.request.get("/api/context");
  expect(activeContext.ok()).toBe(true);
  expect((await activeContext.json()).selectedOutletId).toBe(pickup.id);
  await expect(page.getByRole("heading", { name: "Scoped Pickup", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/organization");
  await page.getByLabel("Organization", { exact: true }).selectOption(f.org);
  await expect(page.getByRole("heading", { name: "Billing entitlements" })).toBeVisible();
  await expect(page.getByText(/Public QR menus: free/)).toBeVisible();
  const status = page
    .getByRole("button", { name: "Suspend organization" })
    .locator("xpath=ancestor::form");
  await status.getByLabel("Confirm organization status change").check();
  await status.getByRole("button", { name: "Suspend organization" }).click();
  await expect(page.getByRole("button", { name: "Reactivate organization" })).toBeVisible();
  await page.reload();
  // Suspension falls back to an active workspace. Re-select the suspended
  // organization explicitly before exercising recovery after a reload.
  await page.getByLabel("Organization", { exact: true }).selectOption(f.org);
  await expect(page.getByRole("button", { name: "Reactivate organization" })).toBeVisible();
  const reactivate = page
    .getByRole("button", { name: "Reactivate organization" })
    .locator("xpath=ancestor::form");
  await reactivate.getByLabel("Confirm organization status change").check();
  await reactivate.getByRole("button", { name: "Reactivate organization" }).click();
  await expect(page.getByRole("button", { name: "Suspend organization" })).toBeVisible();
  // The navigation-first workspace intentionally has no sidebar logout.
  // Exercise the real Account-page sign-out flow on desktop and mobile.
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // Confirm the new sign-out action clears the session before signing in again.
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await login(page, f.memberEmail, f.password);
  await page.goto("/dashboard/organization");
  await expect(
    page.getByRole("heading", { name: "Settings: Scoped Pickup", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite a teammate" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Billing entitlements" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Settings: Alpha Domain", exact: true })
  ).toHaveCount(0);
  const forbidden = await page.request.get(`/api/organizations/${f.otherOrg}`);
  expect(forbidden.status()).toBe(403);
});
test("organization switching ignores a late response from the previous organization", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const f = await seed();
  await login(page, f.email, f.password);
  let resolve!: () => void;
  const gate = new Promise<void>((r) => (resolve = r));
  let intercepted!: () => void;
  const started = new Promise<void>((r) => (intercepted = r));
  await page.route(`**/api/organizations/${f.org}`, async (route) => {
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response });
  });
  // Explicitly select the intercepted organization: the active-outlet preference may point
  // at the other organization, making an implicit initial-request race indeterminate.
  await page.goto(`/dashboard/organization?organization=${encodeURIComponent(f.org)}`, {
    waitUntil: "domcontentloaded",
  });
  await started;
  await page.getByLabel("Organization", { exact: true }).selectOption(f.otherOrg);
  await expect(page.getByLabel("Organization name", { exact: true })).toHaveValue("Beta Domain");
  resolve();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByLabel("Organization name", { exact: true })).toHaveValue("Beta Domain");
  const form = page
    .getByRole("button", { name: "Save organization name" })
    .locator("xpath=ancestor::form");
  await form.getByLabel("Organization name", { exact: true }).fill("Beta Safely Renamed");
  await form.getByRole("button", { name: "Save organization name" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved");
  let releaseSave!: () => void;
  let saveStarted!: () => void;
  const saving = new Promise<void>((r) => (saveStarted = r));
  const saveGate = new Promise<void>((r) => (releaseSave = r));
  await page.route(`**/api/organizations/${f.otherOrg}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    saveStarted();
    await saveGate;
    await route.fulfill({ response });
  });
  await form.getByLabel("Organization name", { exact: true }).fill("Beta Background Save");
  await form.getByRole("button", { name: "Save organization name" }).click();
  await saving;
  await page.getByLabel("Organization", { exact: true }).selectOption(f.org);
  releaseSave();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByLabel("Organization name", { exact: true })).toHaveValue("Alpha Domain");
  const unchanged = await page.request.get(`/api/organizations/${f.org}`);
  expect((await unchanged.json()).organization.name).toBe("Alpha Domain");
});

test("Hospitality House uses approved theme art, mobile composition and accessible help", async ({
  page,
}) => {
  const f = await seed();
  await login(page, f.email, f.password);
  await page.setViewportSize({ width: 1280, height: 800 });
  // The help control is within the role form; select the fixture with an eligible staff member.
  await page.goto(`/dashboard/organization?organization=${encodeURIComponent(f.org)}`);
  await expect(page.getByRole("heading", { name: /Everything under one roof/ })).toBeVisible();
  await expect(page.locator(".oh-hero")).toHaveCSS(
    "background-image",
    /Organization-Hero-Light\.png/
  );
  await expect(page.locator(".oh-art-outlet-collection").first()).toHaveCSS(
    "background-image",
    /outlet-collection-light\.webp/
  );

  await page.locator("html").evaluate((node) => node.setAttribute("data-theme", "dark"));
  await expect(page.locator(".oh-hero")).toHaveCSS(
    "background-image",
    /Organization-Hero-Dark\.png/
  );
  await expect(page.locator(".oh-art-team-hall")).toHaveCSS(
    "background-image",
    /team-hall-dark\.webp/
  );

  const help = page.getByRole("button", { name: "About outlet roles" });
  await expect(help).toBeEnabled();
  await help.click();
  await expect(page.getByText(/Clearing them revokes that outlet access/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Clearing them revokes that outlet access/)).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".oh-hero")).toHaveCSS(
    "background-image",
    /Organization-Hero-Mobile-Dark\.png/
  );
  await expect(page.getByRole("navigation", { name: "Organization sections" })).toBeVisible();

  await page.locator("html").evaluate((node) => node.setAttribute("data-theme", "light"));
  await expect(page.locator(".oh-hero")).toHaveCSS(
    "background-image",
    /Organization-Hero-Mobile-Light\.png/
  );
});

test("outlet role grants reflect saved permissions after refresh and switching members", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const f = await seed();
  await login(page, f.email, f.password);
  await page.goto("/dashboard/organization");
  await page.getByLabel("Organization", { exact: true }).selectOption(f.org);
  const form = page
    .getByRole("button", { name: "Save outlet roles" })
    .locator("xpath=ancestor::form");
  await form
    .getByLabel("Member", { exact: true })
    .selectOption({ label: `Browser staff (${f.memberEmail})` });
  await form.getByLabel("service", { exact: true }).check();
  await form.getByRole("button", { name: "Save outlet roles" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved");
  await page.reload();
  const restored = page
    .getByRole("button", { name: "Save outlet roles" })
    .locator("xpath=ancestor::form");
  await restored
    .getByLabel("Member", { exact: true })
    .selectOption({ label: `Browser staff (${f.memberEmail})` });
  await expect(restored.getByLabel("service", { exact: true })).toBeChecked();
  await restored.getByLabel("service", { exact: true }).uncheck();
  await expect(restored.getByLabel("Confirm clearing outlet roles")).toBeVisible();
  await expect(restored.getByRole("button", { name: "Save outlet roles" })).toBeVisible();
});
