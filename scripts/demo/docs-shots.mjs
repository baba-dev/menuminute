// Single source of truth for documentation screenshots. `id` is referenced by src/content/docs.
export const VARIANTS = [
  {
    key: "desktop-light",
    theme: "light",
    viewport: { width: 1440, height: 900 },
    width: 1200,
    only: "all",
  },
  {
    key: "desktop-dark",
    theme: "dark",
    viewport: { width: 1440, height: 900 },
    width: 1200,
    only: "all",
  },
  {
    key: "mobile-light",
    theme: "light",
    viewport: { width: 390, height: 844 },
    width: 390,
    only: "all",
  },
];

const PUBLIC_MENU = "/m/demo-spice-route-kitchen-v2";
export const SHOTS = [
  { id: "demo-hub", path: "/demo", auth: false },
  { id: "public-menu", path: PUBLIC_MENU, auth: false, settle: 4500 },
  {
    id: "public-menu-dish",
    path: PUBLIC_MENU,
    auth: false,
    settle: 4500,
    // Scroll past the cover to the dish grid so the screenshot shows real dish cards.
    prepare: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 1050));
      await page.waitForTimeout(2500);
    },
  },
  { id: "dashboard", path: "/dashboard", auth: true, settle: 5000 },
  { id: "menu-studio", path: "/dashboard/menu", auth: true, settle: 6000 },
  { id: "qr-studio", path: "/dashboard/qr-codes", auth: true, settle: 5000 },
  { id: "orders", path: "/dashboard/orders", auth: true, settle: 6000 },
  { id: "kitchen", path: "/kitchen", auth: true, settle: 6000 },
  { id: "floor", path: "/dashboard/floor", auth: true, settle: 5000 },
  {
    id: "reports",
    path: "/dashboard/reports",
    auth: true,
    settle: 5000,
    prepare: async (page) => {
      const range = page.getByRole("button", { name: "Last 30 Days" });
      if (await range.count())
        await range
          .first()
          .click({ timeout: 8000 })
          .catch(() => undefined);
      await page.waitForTimeout(3500);
    },
  },
  { id: "menu-import", path: "/dashboard/menu/import", auth: true, settle: 4500 },
  { id: "organization", path: "/dashboard/organization", auth: true, settle: 4500 },
  { id: "settings", path: "/dashboard/settings", auth: true, settle: 4500 },
  {
    id: "ember",
    path: "/dashboard",
    auth: true,
    settle: 5000,
    prepare: async (page) => {
      const open = page.getByLabel("Open Ember assistant");
      if (await open.count())
        await open
          .first()
          .click({ timeout: 8000 })
          .catch(() => undefined);
      await page.waitForTimeout(1500);
    },
  },
];
