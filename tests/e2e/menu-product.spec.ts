import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";
import { menuDocumentSchema } from "../../src/modules/menu-product/contracts";
async function seed(publish = false) {
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
  await page.getByRole("button", { name: "Find in menu" }).click();
  await page.getByLabel("Find a dish or section").fill("nonexistent-dish-search");
  await expect(page.getByLabel("Find a dish or section")).toHaveValue("nonexistent-dish-search");
  await page.getByLabel("Find a dish or section").clear();
  await expect(page.getByLabel("Integrated private draft preview")).toBeVisible();
  await page.getByRole("button", { name: "+ Add dishes" }).click();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name 1", { exact: true }).fill("Chef’s specials");
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  await expect(page.getByLabel("Search the dish catalogue")).toBeFocused();
  await page.getByLabel("Search the dish catalogue").fill("Signature thali");
  await page.getByRole("button", { name: /Create custom dish: Signature thali/ }).click();
  await page.getByRole("button", { name: "Review & Add 1 dish" }).click();
  await page.getByLabel("Quick price for Signature thali").fill("12.500");
  await page.getByRole("button", { name: "Add 1 to private draft" }).click();
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
  await page
    .getByLabel("Dish photo 1.1", { exact: true })
    .selectOption({ label: "Approved photo 1" });
  await expect(
    page.getByRole("img", { name: "Uploaded photograph for Signature thali" })
  ).toBeVisible();
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
  // The QR-only tier displays variants and add-ons read-only, without paid checkout.
  await expect(guest.getByText("Variants & add-ons", { exact: true })).toBeVisible();
  await expect(guest.getByText(/Regular.*15/)).toBeVisible();
  await expect(guest.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  await expect(guest.getByText("Sold Out", { exact: true })).toHaveCount(0);
  await page.getByLabel("Sold out", { exact: true }).check();
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
  await page.getByLabel("QR label", { exact: true }).fill("Patio menu");
  await page.getByLabel("Table / counter label (optional)", { exact: true }).fill("Table 4");
  await page.getByRole("button", { name: "Create QR code", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("QR code created");
  const rows = await (await page.request.get("/api/qr")).json();
  const q = rows.find((q: { label: string }) => q.label === "Patio menu");
  const patioCard = page
    .getByRole("heading", { name: "Patio menu", exact: true })
    .locator("xpath=ancestor::section");
  await page.evaluate(() => {
    window.print = () => {};
  });
  await patioCard.getByRole("button", { name: "Print", exact: true }).click();
  await expect(patioCard).toHaveAttribute("data-print-target", "true");
  await expect(patioCard.locator("xpath=..")).toHaveAttribute("data-print-selected", "true");
  await expect(patioCard.locator("code")).toContainText("/m/");
  const download = await page.request.get(`/api/qr/${q.id}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("image/png");
  await guest.goto(`/m/${q.destinationToken}`);
  await expect(guest.getByText("Table 4", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("heading", { name: "Patio menu", exact: true })
    .locator("xpath=ancestor::section")
    .getByRole("button", { name: "Revoke QR", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("QR code revoked");
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
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  }
  await page.getByLabel("Search the menu", { exact: true }).fill("not-a-real-dish");
  await expect(page.getByRole("heading", { name: "No matching dishes" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Dietary filter", { exact: true }).selectOption("vegan");
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
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name 1", { exact: true }).fill("Main Course");
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
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
  await expect(page.getByLabel("Dish name 1.1")).toHaveValue("Kadai Paneer");
  await expect(page.getByLabel("Dish name 1.2")).toHaveValue("Palak Paneer");
  expect((await page.request.get("/api/public-menu/" + f.token)).status()).toBe(404);
  await page.getByRole("button", { name: "Find in menu" }).click();
  await page.getByLabel("Find a dish or section").fill("Palak");
  await expect(page.getByLabel("Dish name 1.1")).toHaveCount(0);
  await expect(page.getByLabel("Dish name 1.2")).toBeVisible();
  await page.getByRole("button", { name: "+ Add dishes" }).click();
  await expect(page.getByLabel("Dish name 1.1")).toBeVisible();
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
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name 1", { exact: true }).fill("Main Course");
  await page.getByRole("button", { name: "Add dish", exact: true }).click();
  await page.getByRole("button", { name: "Paste a dish list" }).click();
  await page.getByLabel("Bulk dish names").fill("Paneer Tikka\nBiryani\npaneer-tikka");
  await page.getByRole("button", { name: "Select pasted dishes" }).click();
  await expect(page.getByRole("button", { name: "Review & Add 2 dishes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review & Add 2 dishes" }).click();
  await page.getByLabel("Quick price for Paneer Tikka").fill("9.000");
  await page.getByLabel("Quick price for Biryani").fill("10.000");
  await page.getByRole("button", { name: "Add 2 to private draft" }).click();
  await expect(page.getByLabel("Dish name 1.1")).toHaveValue("Paneer Tikka");
  await expect(page.getByLabel("Dish name 1.2")).toHaveValue("Biryani");
  await expect(page.getByText("Recently used in this menu")).toBeVisible();
  const search = page.getByLabel("Search the dish catalogue");
  await search.fill("पनीर");
  await expect(page.getByRole("option", { name: /Paneer Tikka/ })).toBeVisible();
  expect((await page.request.get("/api/public-menu/" + f.token)).status()).toBe(404);
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
  await page.goto("/dashboard/menu");
  const studio = page.getByTestId("recipe-atelier-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("heading", { name: "Menu Studio" })).toBeVisible();
  await expect(studio.getByLabel("Menu Studio overview")).toBeVisible();
  await expect(studio.getByLabel("Integrated private draft preview")).toBeVisible();
  await expect(studio.getByRole("navigation", { name: "Filter menu sections" })).toBeVisible();
  await studio.locator("summary[aria-label='About Sections']").click();
  await expect(studio.getByText("Active sections in the selected editable draft.")).toBeVisible();
  await studio.getByRole("button", { name: "Preview draft" }).click();
  await expect(studio.getByText("Draft preview — not public")).toBeVisible();
  await expect(studio.getByRole("button", { name: "Save draft" })).toBeDisabled();
  await expect(studio.getByRole("button", { name: "Publish menu" })).toBeDisabled();
  await expect(studio.getByLabel("Integrated private draft preview")).toHaveCount(0);
  await studio.getByRole("button", { name: "Back to edit" }).click();
  await expect(studio.getByLabel("Integrated private draft preview")).toBeVisible();

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
