import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";
import { formatPrice } from "../../src/lib/utils";
async function seed(publish = false, culinaryMode?: "verified" | "cross-contact") {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated test DB required");
  const pool = new Pool({ connectionString: url, max: 1 });
  const user = crypto.randomUUID(),
    outlet = crypto.randomUUID(),
    token = crypto.randomUUID();
  const email = `menu-${user}@browser.invalid`,
    password = "menu-browser-password";
  try {
    const hash = await hashPassword(password);
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "insert into users(id,name,email,email_verified) values($1,'Menu owner',$2,true)",
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
          name: "Ember Test Kitchen",
          country: "OM",
          currency: "OMR",
          timezone: "Asia/Muscat",
          outletType: "cafe",
        }),
      ]);
      if (publish) {
        const doc = menuDocumentSchema.parse({
          name: "All-day kitchen",
          currency: "OMR",
          categories: [
            {
              id: "favourites",
              name: "Kitchen favourites",
              items: [
                {
                  id: "thali",
                  name: "Signature thali",
                  description: "A restaurant-supplied description for the test menu.",
                  priceMinor: 12500,
                  dietary: ["vegetarian"],
                  safety:
                    culinaryMode === "verified"
                      ? {
                          ingredients: ["Rice", "Peas"],
                          allergens: [],
                          verified: true,
                          verifiedFreeFrom: ["nuts", "dairy"],
                        }
                      : culinaryMode === "cross-contact"
                        ? {
                            ingredients: ["Rice", "Peas"],
                            allergens: [],
                            verified: true,
                            crossContact: "Prepared beside nuts on a shared surface.",
                          }
                        : undefined,
                  nutrition:
                    culinaryMode === "verified"
                      ? { calories: 400, servingSize: "350g", verified: true }
                      : undefined,
                },
                { id: "sold", name: "Seasonal special", priceMinor: 9000, soldOut: true },
                {
                  id: "long",
                  name: "An intentionally long dish name for testing responsive menu layouts and readable prices",
                  priceMinor: 4500,
                  dietary: ["vegan"],
                },
              ],
            },
          ],
        });
        await c.query("select app_private.menu_command($1,$2,$3,$4::jsonb,$5,1)", [
          outlet,
          `menu-${outlet}`,
          "save",
          JSON.stringify({ document: doc }),
          crypto.randomUUID(),
        ]);
        await c.query("select app_private.menu_command($1,$2,$3,$4::jsonb,$5,2)", [
          outlet,
          `menu-${outlet}`,
          "publish",
          "{}",
          crypto.randomUUID(),
        ]);
      }
      await c.query("commit");
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
  return { outlet, token, email, password };
}
test("owner completes free menu, reviewed photograph, publication and permanent table QR lifecycle", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  await expect(page.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import from photos" })).toBeVisible();
  await expect(page.getByLabel("Menu Studio overview")).toBeVisible();
  await page.getByPlaceholder("Search dishes or sections").fill("nonexistent-dish-search");
  await expect(page.getByPlaceholder("Search dishes or sections")).toHaveValue(
    "nonexistent-dish-search"
  );
  await page.getByPlaceholder("Search dishes or sections").clear();
  if ((page.viewportSize()?.width ?? 1440) <= 720) {
    await page.getByRole("button", { name: "Preview draft" }).click();
    await expect(page.getByText("Draft preview — not public")).toBeVisible();
    await page.getByRole("button", { name: "Back to edit" }).click();
  } else {
    await expect(page.getByLabel("Integrated private draft preview")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "New section" }).click();
  await page.getByLabel("Section name", { exact: true }).fill("Chef’s specials");
  await page.getByRole("button", { name: "Create section" }).click();
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Add a dish" });
  await addDialog.getByLabel("Dish name", { exact: true }).fill("Signature thali");
  await addDialog.getByLabel(/Price \(/).fill("12.500");
  await addDialog.getByRole("button", { name: "Add to draft" }).click();
  await page.getByRole("button", { name: "Edit Signature thali" }).click();
  await page.getByLabel("Dish name 1.1", { exact: true }).fill("Signature thali");
  await page.getByLabel("Dish price 1.1", { exact: true }).fill("12.500");
  await expect(page.getByRole("button", { name: "Move dish 1 up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move dish 1 down" })).toBeDisabled();
  await page.getByLabel("vegetarian", { exact: true }).check();
  await page.getByText("Variants & add-ons", { exact: true }).click();
  await page.getByRole("button", { name: "Add variant", exact: true }).click();
  await page.getByLabel("Variant name 1", { exact: true }).fill("Regular");
  await page.getByLabel("Variant price 1", { exact: true }).fill("15.000");
  await page.getByRole("button", { name: "Add add-on group", exact: true }).click();
  await page.getByLabel("Add-on name 1", { exact: true }).fill("Extra bread");
  await page.getByLabel("Add-on price 1", { exact: true }).fill("0.500");
  const extras = page
    .getByLabel("Add-on group 1")
    .locator("xpath=ancestor::div[contains(@class,'panel')]");
  await extras.getByRole("checkbox", { name: "Available", exact: true }).uncheck();
  await extras.getByRole("checkbox", { name: "Available", exact: true }).check();
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  expect((await page.request.get(`/api/public-menu/${f.token}`)).status()).toBe(404);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page.getByLabel("Dish photograph", { exact: true }).setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await page
    .getByLabel("Rights or source confirmation")
    .fill("I own this restaurant test photograph");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.locator(".product [role='alert']")).toContainText("Photo exceeds 5 MiB");
  await page.getByLabel("Dish photograph", { exact: true }).setInputFiles({
    name: "dish.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 640, height: 480, channels: 3, background: "#ed872c" } })
      .png()
      .toBuffer(),
  });
  await page
    .getByLabel("Rights or source confirmation")
    .fill("I own this restaurant test photograph");
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo queued" })).toBeVisible();
  await expect
    .poll(
      async () => {
        const r = await page.request.get("/api/media");
        return (await r.json())[0]?.status;
      },
      { timeout: 20000 }
    )
    .toBe("ready");
  await page.getByRole("button", { name: "Refresh photo status" }).click();
  await expect(
    page.getByText("Private preview only. Approval does not publish your menu.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve photo", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo approved" })).toBeVisible();
  await page.getByRole("button", { name: "Dishes", exact: true }).click();
  await page.getByRole("button", { name: "Edit Signature thali" }).click();
  await page
    .getByLabel("Dish photo 1.1", { exact: true })
    .selectOption({ label: "Approved photo 1" });
  await expect(
    page.getByRole("img", { name: "Uploaded photograph for Signature thali" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.getByRole("button", { name: "Publish menu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Publish menu", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Publish menu", exact: true }).click();
  await page.getByRole("button", { name: "Confirm publication" }).click();
  await expect(page.getByText("Your menu is live.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage permanent QR codes" })).toHaveAttribute(
    "href",
    "/dashboard/qr-codes"
  );
  const guest = await page.context().newPage();
  await guest.goto(`/m/${f.token}`);
  await expect(guest.getByRole("heading", { name: "Signature thali" })).toBeVisible();
  // QR-only menus still show option prices inside the read-only details sheet, never checkout.
  await guest.getByRole("button", { name: "View Signature thali details" }).first().click();
  const guestDetails = guest.getByRole("dialog", { name: "Signature thali" });
  await expect(guestDetails.getByText("Regular", { exact: true })).toBeVisible();
  await expect(guestDetails.getByText(formatPrice(15000, "OMR"), { exact: true })).toBeVisible();
  await expect(guestDetails.getByText(/Browse the available options and pricing/)).toBeVisible();
  await expect(guestDetails.getByRole("button", { name: /Add to Order/ })).toHaveCount(0);
  await guestDetails.getByRole("button", { name: "Back to menu" }).click();
  await expect(guest.getByRole("button", { name: "View order cart" })).toHaveCount(0);
  await expect(guest.getByText("Sold Out", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Signature thali" }).click();
  await page.getByLabel("Sold out", { exact: true }).check();
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  await guest.reload();
  await expect(guest.getByText("Sold Out", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Publish menu", exact: true }).click();
  await page.getByRole("button", { name: "Confirm publication" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Menu published" })).toBeVisible();
  await guest.reload();
  await expect(guest.getByText("Sold Out", { exact: true })).toBeVisible();
  await page.goto("/dashboard/qr-codes");
  await page.getByRole("button", { name: "Create QR", exact: true }).click();
  const creator = page.getByRole("dialog");
  await expect(creator).toHaveAccessibleName("Create a permanent QR");
  await creator.getByRole("button", { name: /Table or counter/i }).click();
  await creator.getByRole("textbox", { name: /QR label/i }).fill("Patio menu");
  await creator.getByRole("textbox", { name: /Table \/ counter label/i }).fill("Table 4");
  await creator.getByRole("button", { name: "Review QR" }).click();
  await creator.getByRole("button", { name: "Create QR code" }).click();
  await expect(creator.getByRole("heading", { name: "Your connection is ready." })).toBeVisible();
  await creator.getByRole("button", { name: "View in library" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("QR code created");
  const rows = await (await page.request.get("/api/qr")).json();
  const q = rows.find((q: { label: string }) => q.label === "Patio menu");
  expect(q.pointLabel).toBe("Table 4");
  const patioCard = page
    .getByRole("heading", { name: "Patio menu", exact: true })
    .locator("xpath=ancestor::section");
  await expect(patioCard.locator(".qr-fallback code")).toContainText("/m/");
  await patioCard.getByRole("button", { name: "Design & Print" }).click();
  const atelier = page.getByTestId("qr-print-atelier");
  const preview = atelier.getByLabel("Table Stand print preview");
  await expect(preview).toContainText("Table 4");
  await expect(preview.locator("[data-real-qr-matrix]")).toHaveJSProperty("complete", true);
  await atelier
    .getByText("I reviewed the restaurant, table label and destination", { exact: false })
    .click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await atelier.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect(preview).toHaveAttribute("data-print-ready", "true");
  await atelier.getByRole("button", { name: "Back to QR Library" }).click();
  const download = await page.request.get(`/api/qr/${q.id}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("image/png");
  await guest.goto(`/m/${q.destinationToken}`);
  await expect(guest.getByRole("banner").getByText("Table 4", { exact: true })).toBeVisible();
  await patioCard.getByText("Manage QR identity").click();
  await patioCard.getByRole("button", { name: "Revoke QR", exact: true }).click();
  const revokeDialog = page.getByRole("dialog", { name: "Revoke this printed QR?" });
  await expect(revokeDialog.getByRole("button", { name: "Confirm revoke" })).toBeDisabled();
  await revokeDialog.getByLabel("Type REVOKE to continue").fill("REVOKE");
  await revokeDialog.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("QR code revoked");
  await page
    .getByRole("navigation", { name: "QR workspace" })
    .getByRole("button", { name: "Print Studio", exact: true })
    .click();
  await expect(page.getByLabel("Table Stand print preview")).toBeVisible();
  await expect(
    page.getByLabel("Table Stand print preview").locator('img[src*="format=svg"]')
  ).toHaveCount(1);
  expect((await guest.goto(`/m/${q.destinationToken}`))?.status()).toBe(404);
  expect((await guest.goto(`/m/${f.token}`))?.status()).toBe(200);
  await guest.screenshot({ path: info.outputPath("published-menu.png"), fullPage: true });
  await guest.close();
});
test("public menu is responsive, searchable and accessible in light/dark/system appearance", async ({
  page,
}, info) => {
  const f = await seed(true);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`/m/${f.token}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Sold Out", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("menu-dark.png"), fullPage: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.goto(`/m/${f.token}`);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: info.outputPath("menu-light.png"), fullPage: true });
  await page.getByRole("link", { name: "Skip to dishes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dishes")).toBeFocused();
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.getByLabel("Search the menu", { exact: true }).fill("not-a-real-dish");
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "Vegan" })
    .click();
  await expect(page.getByRole("heading", { name: "Signature thali" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /An intentionally long dish name/ })
  ).toBeVisible();
  await page.evaluate(() => localStorage.setItem("menuminute.appearance", "system"));
  // A same-tab localStorage write does not emit a storage event. Reload as a returning guest
  // would, verify the saved System preference, then exercise both OS media transitions.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator(".product .action")
      .evaluateAll((elements) => elements.every((e) => e.getBoundingClientRect().height >= 44))
  ).toBe(true);
});

test("Smart Composer batches autocomplete suggestions, validates prices and preserves private publication", async ({
  page,
}) => {
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  await expect(page.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
  await page.getByRole("button", { name: "New section" }).click();
  await page.getByLabel("Section name", { exact: true }).fill("Main Course");
  await page.getByRole("button", { name: "Create section" }).click();
  await page.getByRole("button", { name: "Add multiple" }).click();
  const search = page.getByLabel("Search the dish catalogue");
  await expect(search).toBeFocused();
  await search.fill("kadai");
  await expect(page.getByRole("option", { name: /Kadai Paneer/ })).toBeVisible();
  await search.press("Enter");
  await search.fill("palak");
  await search.press("Enter");
  await page.getByRole("button", { name: "Review & Add 2 dishes" }).click();
  await page.getByLabel("Quick price for Kadai Paneer").fill("3.500");
  await page.getByRole("button", { name: "Add 2 to private draft" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter every dish price" })).toBeVisible();
  await page.getByLabel("Quick price for Palak Paneer").fill("4.000");
  await page.getByRole("button", { name: "Add 2 to private draft" }).click();
  await expect(page.locator(".menu-board-dish").filter({ hasText: "Kadai Paneer" })).toBeVisible();
  await expect(page.locator(".menu-board-dish").filter({ hasText: "Palak Paneer" })).toBeVisible();
  expect((await page.request.get("/api/public-menu/" + f.token)).status()).toBe(404);
  await page.getByPlaceholder("Search dishes or sections").fill("Palak");
  await expect(page.locator(".menu-board-dish")).toHaveCount(1);
  await expect(page.locator(".menu-board-dish")).toContainText("Palak Paneer");
  await page.getByPlaceholder("Search dishes or sections").clear();
  await expect(page.locator(".menu-board-dish")).toHaveCount(2);
});

test("PR C bulk composer deduplicates pasted dishes and matches Hindi input without publishing", async ({
  page,
}) => {
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  await page.getByRole("button", { name: "New section" }).click();
  await page.getByLabel("Section name", { exact: true }).fill("Main Course");
  await page.getByRole("button", { name: "Create section" }).click();
  await page.getByRole("button", { name: "Add multiple" }).click();
  await page.getByRole("button", { name: "Paste a dish list" }).click();
  await page.getByLabel("Bulk dish names").fill("Paneer Tikka\nBiryani\npaneer-tikka");
  await page.getByRole("button", { name: "Select pasted dishes" }).click();
  await expect(page.getByRole("button", { name: "Review & Add 2 dishes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review & Add 2 dishes" }).click();
  await page.getByLabel("Quick price for Paneer Tikka").fill("9.000");
  await page.getByLabel("Quick price for Biryani").fill("10.000");
  await page.getByRole("button", { name: "Add 2 to private draft" }).click();
  await expect(page.locator(".menu-board-dish").filter({ hasText: "Paneer Tikka" })).toBeVisible();
  await expect(page.locator(".menu-board-dish").filter({ hasText: "Biryani" })).toBeVisible();
  await page.getByRole("button", { name: "Add multiple" }).click();
  await expect(page.getByText("Recently used in this menu")).toBeVisible();
  const search = page.getByLabel("Search the dish catalogue");
  await search.fill("पनीर");
  await expect(page.getByRole("option", { name: /Paneer Tikka/ })).toBeVisible();
  expect((await page.request.get("/api/public-menu/" + f.token)).status()).toBe(404);
});

test("Menu Board remains usable at 320px and hydrates private editorial descriptions", async ({
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

  await page.setViewportSize({ width: 320, height: 690 });
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add a dish" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Dish name", { exact: true }).fill("Paneer Tikka");
  await sheet.locator(".menu-board-suggestions button").filter({ hasText: "Paneer Tikka" }).click();
  await expect(sheet.getByLabel(/Public description/)).toHaveValue(/paneer cubes/i);
  await expect(sheet.getByText(/unverified suggestions/)).toBeVisible();
  await sheet.getByLabel(/Price \(/).fill("2.500");

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const sheetWidth = await sheet.evaluate((element) => element.getBoundingClientRect().width);
    expect(sheetWidth).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true
    );
  }
  await sheet.getByRole("button", { name: "Add to draft" }).click();
  await expect(page.locator(".menu-board-dish").filter({ hasText: "Paneer Tikka" })).toBeVisible();
  expect((await page.request.get("/api/public-menu/" + f.token)).status()).toBe(404);

  await page.setViewportSize({ width: 320, height: 690 });
  await page.getByRole("button", { name: "Edit Paneer Tikka" }).click();
  const editor = page.getByRole("dialog", { name: "Edit Paneer Tikka" });
  await expect(editor).toBeVisible();
  expect(
    await editor.evaluate((element) => element.getBoundingClientRect().width)
  ).toBeLessThanOrEqual(321);
  await editor.getByRole("button", { name: "Done editing" }).click();
  await expect(editor).toBeHidden();
});

test("Recipe Atelier uses the approved media, meaningful draft metrics and adaptive editor", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90000);
  const owner = await seed(true);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  const studio = page.getByTestId("recipe-atelier-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
  await expect(studio.getByLabel("Menu Studio overview")).toBeVisible();
  await expect(studio.getByLabel("Integrated private draft preview")).toHaveCount(0);
  await expect(studio.getByRole("navigation", { name: "Filter sections" })).toBeVisible();
  await studio.locator("summary[aria-label='About Sections']").click();
  await expect(studio.getByText("Active sections in the selected editable draft.")).toBeVisible();
  await studio.getByRole("button", { name: "Preview draft" }).click();
  await expect(studio.getByText("Draft preview — not public")).toBeVisible();
  await expect(
    studio.locator(".atelier-actionbuttons button").filter({ hasText: "Save draft" })
  ).toBeDisabled();
  await expect(
    studio.locator(".atelier-actionbuttons button").filter({ hasText: "Publish menu" })
  ).toBeDisabled();
  await expect(studio.getByLabel("Integrated private draft preview")).toHaveCount(0);
  await studio.getByRole("button", { name: "Back to edit" }).click();
  await expect(studio.getByLabel("Integrated private draft preview")).toHaveCount(0);
  await page.getByLabel("Menu name").fill("Kitchen seasonal menu");
  await studio.getByRole("button", { name: "Assignments", exact: true }).click();
  await expect(studio.locator(".atelier-assignment-lock")).toHaveAttribute("disabled", "");
  await expect(studio.getByRole("button", { name: "Save assignment" })).toBeDisabled();
  await expect(studio.getByRole("button", { name: "Save local override" })).toBeDisabled();
  await expect(studio.getByText(/Save your draft and review queued Composer dishes/)).toBeVisible();
  await studio.getByRole("button", { name: "Save draft" }).click();
  await expect(studio.locator(".atelier-assignment-lock")).not.toHaveAttribute("disabled");
  await expect(studio.getByRole("button", { name: "Save assignment" })).toBeEnabled();
  await studio.getByRole("button", { name: "Dishes", exact: true }).click();

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(studio.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(studio.getByRole("group", { name: "Draft and publication actions" })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("recipe-atelier-light-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: info.outputPath("recipe-atelier-dark-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: info.outputPath("recipe-atelier-dark-desktop.png"),
    fullPage: true,
  });

  for (const name of [
    "hero-desktop-light.webp",
    "hero-desktop-dark.webp",
    "hero-mobile-light.webp",
    "hero-mobile-dark.webp",
    "first-menu-empty-illustration.webp",
    "dish-workspace-illustration.webp",
    "publication-celebration.webp",
  ]) {
    const response = await request.get("/brand/menu-studio/recipe-atelier/" + name);
    expect(response.status(), name).toBe(200);
    expect(response.headers()["content-type"], name).toContain("image/webp");
  }
});

test("Menu Studio 3.1 carries curated artwork into draft and gives review and preview a clear arrival", async ({
  page,
}) => {
  const f = await seed();
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");
  await expect(page.locator(".mm-shared-topbar")).toBeVisible();
  await expect(page.locator(".mm-workspace-sidebar .mm-theme-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  const addDish = page.getByRole("dialog", { name: "Add a dish" });
  await addDish.getByLabel("Dish name", { exact: true }).fill("Butter Chicken");
  await addDish
    .locator(".menu-board-suggestions button")
    .filter({ hasText: "Butter Chicken" })
    .click();
  await expect(addDish.getByText(/Curated dish description suggested/)).toBeVisible();
  await expect(addDish.getByText(/unverified suggestions/)).toBeVisible();
  await addDish.getByLabel(/Price \(/).fill("12.500");
  await addDish.getByRole("button", { name: "Add to draft" }).click();
  const butterCard = page.locator(".menu-board-dish").filter({ hasText: "Butter Chicken" });
  await expect(butterCard.locator("img")).toHaveAttribute("src", /butter-chicken/);
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  await expect(page.getByText("Authentic profile available for")).toBeVisible();
  await page.getByRole("button", { name: "Done editing" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".menu-board-dish").filter({ hasText: "Butter Chicken" }).locator("img")
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview draft" }).click();
  await expect(page.locator(".atelier-preview-dialog")).toBeVisible();
  await expect(page.locator(".atelier-preview-viewport")).toBeVisible();
  await expect(page.getByText("Draft preview — not public", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to edit" }).click();
  await expect(page.locator(".atelier-preview-dialog")).toBeHidden();
});

test("Tabletop Press is responsive and uses real QR media for all printable formats", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90000);
  const owner = await seed(true);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/qr-codes");
  const studio = page.getByTestId("tabletop-press");
  await expect(studio.getByRole("heading", { name: /Print once/ })).toBeVisible();
  await expect(studio.getByLabel("QR inventory at a glance")).toBeVisible();
  await expect(studio.getByRole("heading", { name: "Your QR library" })).toBeVisible();
  await studio.locator('summary[aria-label="About Active codes"]').click();
  await expect(studio.getByText("Currently usable permanent destination tokens.")).toBeVisible();
  await studio
    .getByRole("navigation", { name: "QR workspace" })
    .getByRole("button", { name: "Print Studio", exact: true })
    .click();
  const atelier = studio.getByTestId("qr-print-atelier");
  const printPreview = atelier.getByLabel("Table Stand print preview");
  await expect(printPreview).toBeVisible();
  // Verify the actual CSS Modules render, not merely that print controls respond.
  // A Turbopack "*.css" rename previously erased all imported module class names.
  await expect(atelier).toHaveCSS("display", "grid");
  const printHero = atelier.locator(":scope > div").first();
  await expect(printHero).toHaveCSS("display", "flex");
  await expect(printHero).toHaveCSS("background-image", /linear-gradient/);
  await expect(atelier.getByRole("group", { name: "Physical print format" })).toHaveCSS(
    "display",
    "grid"
  );
  const printedSheet = printPreview.locator("article[data-format]");
  await expect(printedSheet).toHaveCSS("display", "flex");
  await expect(printedSheet).toHaveCSS("background-color", "rgb(255, 249, 237)");
  await expect(printPreview.locator('img[src*="format=svg"]')).toHaveCount(1);
  await expect(studio.getByRole("heading", { name: "Your QR library" })).toBeHidden();
  await atelier.getByRole("button", { name: "Classic Ember" }).click();
  await atelier.getByRole("button", { name: "Midnight Luxe" }).click();
  await expect(printPreview.locator("article")).toHaveAttribute("data-palette", "ink");
  for (const theme of [
    "Botanical Estate",
    "Citrus Pop",
    "Ruby Velvet",
    "Coastal Club",
    "Neon Diner",
    "Patisserie Pastel",
    "Modern Mono",
  ]) {
    await atelier.getByRole("button", { name: theme }).click();
  }
  await expect(printPreview.locator("article")).toHaveAttribute("data-palette", "mono");
  await atelier.getByRole("button", { name: "Use Playfair Display font" }).click();
  await expect(printPreview.locator("article")).toHaveAttribute("data-font", "playfair");
  await atelier.getByLabel("HEX").fill("#F0F0F0");
  await expect(atelier.getByText(/Too light or invalid/)).toBeVisible();
  await atelier.getByLabel("HEX").fill("#152A42");
  await expect(printPreview.locator("img[data-real-qr-matrix]")).toHaveAttribute(
    "src",
    /ink=%23152A42/
  );
  await expect(printPreview).toContainText("MenuMinute · by BabaBuilds");
  await atelier.getByRole("button", { name: /Window \/ Counter Sticker/ }).click();
  await expect(studio.getByLabel("Window / Counter Sticker print preview")).toBeVisible();
  await atelier.getByRole("button", { name: /Menu Insert/ }).click();
  await expect(studio.getByLabel("Menu Insert print preview")).toBeVisible();
  await atelier.getByLabel("Guest invitation").fill("Discover today's menu");
  await expect(atelier.getByLabel("Menu Insert print preview")).toContainText(
    "Discover today's menu"
  );
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(studio.getByRole("heading", { name: /Print once/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("tabletop-press-light-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: info.outputPath("tabletop-press-dark-mobile.png"),
    fullPage: true,
  });
  for (const name of [
    "hero-desktop-light.webp",
    "hero-desktop-dark.webp",
    "hero-mobile-light.webp",
    "hero-mobile-dark.webp",
    "first-qr-empty-illustration.webp",
    "print-studio-illustration.webp",
    "qr-creation-celebration.webp",
  ]) {
    const response = await request.get("/brand/qr-studio/tabletop-press/" + name);
    expect(response.status(), name).toBe(200);
    expect(response.headers()["content-type"], name).toContain("image/webp");
  }
});

test("unverified culinary information never creates safe-from claims in mobile dining", async ({
  page,
}, info) => {
  const owner = await seed(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/m/${owner.token}`);
  await expect(page.getByRole("heading", { name: "Signature thali" })).toBeVisible();

  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "Nut-Free" })
    .click();
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "Dairy-Free" })
    .click();
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();

  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "All dishes" })
    .click();
  await page.getByRole("button", { name: "View Signature thali details" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/allergen details have not been verified/i)).toBeVisible();
  await expect(dialog.getByText("Contains Allergens:")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("culinary-unverified-mobile.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("confirmed culinary claims show only after explicit verification and cross-contact remains visible", async ({
  page,
}) => {
  const verified = await seed(true, "verified");
  await page.goto(`/m/${verified.token}`);
  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "Nut-Free" })
    .click();
  await expect(page.getByRole("heading", { name: "Signature thali" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seasonal special" })).toHaveCount(0);
  await expect(page.getByText("400 kcal")).toBeVisible();
  await page.getByRole("button", { name: "View Signature thali details" }).click();
  await expect(page.getByRole("dialog").getByText("Ingredients:")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/not been verified/i)).toHaveCount(0);

  const crossContact = await seed(true, "cross-contact");
  await page.goto(`/m/${crossContact.token}`);
  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "Nut-Free" })
    .click();
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page
    .getByRole("group", { name: "Dietary filter" })
    .getByRole("button", { name: "All dishes" })
    .click();
  await page.getByRole("button", { name: "View Signature thali details" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Prepared beside nuts on a shared surface/)
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Contains Allergens:")).toHaveCount(0);
});

test("Menu Library stays responsive and preserves publication and accessible dialog navigation", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const fixture = await seed(true);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/menu");

  const launch = page.getByRole("button", { name: "Your menus" });
  await expect(launch).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Menu displayed in Studio" })).toBeVisible();
  await expect(page.getByLabel("Menu name")).toHaveCount(1);
  await expect(page.locator(".atelier-gallery-dialog")).toHaveCount(0);
  await expect(page.locator(".atelier-gallery-error")).toHaveCount(0);
  await expect(page.locator(".atelier-menu-bar")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 860 });
    await launch.click();
    const library = page.getByRole("dialog", { name: "Your menus" });
    await expect(library).toBeVisible();
    await expect(library.getByRole("heading", { name: "All-day kitchen" })).toBeVisible();
    await expect(library.getByText("Signature thali")).toBeVisible();
    await expect(library.getByText("Seasonal special")).toBeVisible();
    await expect(library.getByText("Sold out")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true
    );
    await page.keyboard.press("Escape");
    await expect(library).toHaveCount(0);
    // Closing the gallery must remove its inputs and alerts from the editor DOM.
    await expect(page.getByLabel("Menu name")).toHaveCount(1);
    await expect(page.locator(".atelier-gallery-error")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.getByLabel("Visual menu board")).toBeVisible();
  await page.getByRole("button", { name: "Preview draft" }).click();
  await expect(page.locator(".atelier-preview-dialog")).toBeVisible();
  await page.screenshot({ path: info.outputPath("menu-studio-dark-library.png"), fullPage: false });
});
