// Screenshot list for the User Guide. `id` is referenced from src/content/guide.
// `clip(view)` crops the capture; `marks(page, view)` returns numbered call-out targets whose boxes are
// stored in public/guide/shots/marks.json (percent of the captured area) for the PDF/web renderers.
const PUBLIC_MENU = "/m/demo-spice-route-kitchen-v2";
const click = async (page, name) => {
  const el = page.getByRole("button", { name, exact: true }).first();
  if (await el.count()) await el.click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
};
const CONTENT = (view) =>
  view === "desktop" ? { x: 216, y: 0, width: 1224, height: 700 } : undefined;
const place = async (page, loc, y) => {
  const el = loc.filter({ visible: true }).first();
  await el.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => undefined);
  const top = await el.evaluate((e) => e.getBoundingClientRect().top).catch(() => null);
  if (top !== null) await page.evaluate((d) => window.scrollBy(0, d), top - y);
  await page.waitForTimeout(500);
};
const bottom = (page) => page.evaluate(() => window.scrollTo(0, 0));

export const SHOTS = [
  {
    id: "menu-nav",
    path: "/dashboard/menu",
    auth: true,
    settle: 6000,
    clip: (v) => (v === "desktop" ? { x: 0, y: 0, width: 1440, height: 700 } : undefined),
    marks: (page, v) => [
      ...(v === "desktop"
        ? [{ n: 1, loc: page.getByRole("link", { name: "Menu Studio", exact: true }) }]
        : []),
      { n: v === "desktop" ? 2 : 1, loc: page.getByRole("link", { name: "Import from photos" }) },
    ],
  },
  {
    id: "menu-dishes",
    path: "/dashboard/menu",
    auth: true,
    settle: 6000,
    prepare: async (page, v) => {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === "Add dish"
        );
        el?.scrollIntoView({ block: "start" });
        window.scrollBy(0, -170);
      });
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByPlaceholder("Search dishes or sections") },
      { n: 2, loc: page.getByRole("button", { name: "Add dish", exact: true }) },
      {
        n: 3,
        loc: page.getByRole("button", { name: /^Edit .+/ }).filter({ hasNotText: "section" }),
      },
    ],
  },
  {
    id: "menu-add-dish",
    path: "/dashboard/menu",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await click(page, "Add dish");
    },
    marks: (page) => [
      { n: 1, loc: page.getByPlaceholder("Try Paneer Tikka, Masala Dosa...") },
      { n: 2, loc: page.getByPlaceholder("Required") },
      { n: 3, loc: page.getByRole("button", { name: "Add to draft" }) },
    ],
  },
  {
    id: "menu-import",
    path: "/dashboard/menu/import",
    auth: true,
    settle: 5000,
    clip: (v) => (v === "desktop" ? { x: 216, y: 0, width: 1224, height: 900 } : undefined),
    marks: (page) => [
      { n: 1, loc: page.getByText("Use camera", { exact: true }) },
      { n: 2, loc: page.getByText("Choose photos", { exact: true }) },
    ],
  },
  {
    id: "menu-publish",
    path: "/dashboard/menu",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await click(page, "Publish menu");
    },
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Confirm publication" }) },
      { n: 2, loc: page.getByRole("button", { name: "Cancel", exact: true }) },
    ],
  },
  { id: "public-menu", path: PUBLIC_MENU, auth: false, settle: 5000 },

  // ---- Chapter 1: Welcome ----
  {
    id: "welcome-dashboard",
    path: "/dashboard",
    auth: true,
    settle: 6000,
    clip: (v) => (v === "desktop" ? { x: 216, y: 0, width: 1224, height: 700 } : undefined),
    marks: (page) => [
      { n: 1, loc: page.getByRole("link", { name: "Open Menu Studio" }) },
      { n: 2, loc: page.getByRole("button", { name: "Dish Availability" }) },
      { n: 3, loc: page.getByRole("link", { name: "Public menu" }) },
    ],
  },
  {
    id: "welcome-nav",
    path: "/dashboard",
    auth: true,
    settle: 6000,
    clip: (v) => (v === "desktop" ? { x: 0, y: 0, width: 1440, height: 760 } : undefined),
    marks: (page, v) =>
      v === "desktop"
        ? ["Orders", "Kitchen", "Menu Studio", "QR codes", "Reports & Insights"].map((name, i) => ({
            n: i + 1,
            loc: page.getByRole("link", { name, exact: true }),
          }))
        : [],
  },
  {
    id: "welcome-glance",
    path: "/dashboard",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page.getByText("At a glance", { exact: true }).first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -80));
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText("Public menu status", { exact: true }) },
      { n: 2, loc: page.getByText("Active QR codes", { exact: true }) },
    ],
  },
  // ---- Chapter 2: Sign up and set up ----
  {
    id: "signup-register",
    path: "/register",
    auth: false,
    settle: 5000,
    prepare: async (page) => {
      await place(page, page.getByLabel("Your name"), 150);
    },
    marks: (page) => [
      { n: 1, loc: page.getByLabel("Your name") },
      { n: 2, loc: page.getByLabel("Email address") },
      { n: 3, loc: page.getByRole("button", { name: "Create free account" }) },
    ],
  },
  {
    id: "signup-login",
    path: "/login",
    auth: false,
    settle: 5000,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Sign in", exact: true }) },
      { n: 2, loc: page.getByRole("link", { name: "Forgot your password?" }) },
    ],
  },
  {
    id: "setup-profile",
    path: "/dashboard/settings",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("button,a,div,span")].find(
          (e) => e.offsetParent !== null && /^Outlet essentials/.test((e.textContent || "").trim())
        );
        el?.scrollIntoView({ block: "start" });
        window.scrollBy(0, -140);
      });
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText(/^Outlet essentials/) },
      { n: 2, loc: page.getByText(/^Restaurant profile/) },
      { n: 3, loc: page.getByText(/^Contact & location/) },
      { n: 4, loc: page.getByText(/^Brand appearance/) },
    ],
  },
  // ---- Chapter 4: QR codes ----
  {
    id: "qr-home",
    path: "/dashboard/qr-codes",
    auth: true,
    settle: 6000,
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Create QR" }) },
      { n: 2, loc: page.getByRole("button", { name: "Open Print Studio" }) },
    ],
  },
  {
    id: "qr-library",
    path: "/dashboard/qr-codes",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page.getByText("Main Menu QR").first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 160));
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText("Download PNG", { exact: true }) },
      { n: 2, loc: page.getByText("Download SVG", { exact: true }) },
      { n: 3, loc: page.getByText("Copy link", { exact: true }) },
      { n: 4, loc: page.getByText(/Design & Print/) },
    ],
  },
  {
    id: "qr-print",
    path: "/dashboard/qr-codes",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: /Print Studio/ })
        .first()
        .click({ timeout: 8000 })
        .catch(() => undefined);
      await page.waitForTimeout(2500);
      await place(page, page.getByRole("button", { name: /Print Studio/ }), 90);
    },
    clip: CONTENT,
    marks: (page) => [{ n: 1, loc: page.getByRole("button", { name: /Print Studio/ }) }],
  },
  // ---- Chapter 5: Guest experience ----
  {
    id: "guest-landing",
    path: PUBLIC_MENU,
    auth: false,
    settle: 5000,
    marks: (page) => [{ n: 1, loc: page.getByText("Explore our food", { exact: true }) }],
  },
  {
    id: "guest-filters",
    path: PUBLIC_MENU,
    auth: false,
    settle: 5000,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Vegetarian", exact: true })
        .first()
        .scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -140));
    },
    marks: (page) => [
      {
        n: 1,
        loc: page.locator('[aria-label="Search the menu"], [placeholder="Search the menu"]'),
      },
      { n: 2, loc: page.getByRole("button", { name: "Vegetarian", exact: true }) },
    ],
  },
  {
    id: "guest-dish",
    path: PUBLIC_MENU,
    auth: false,
    settle: 5000,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "View Paneer Tikka details" })
        .first()
        .click({ timeout: 8000 });
      await page.waitForTimeout(2500);
    },
    marks: (page) => [{ n: 1, loc: page.getByRole("button", { name: /Add to Order/ }) }],
  },
  // ---- Chapter 6: Orders ----
  {
    id: "orders-top",
    path: "/dashboard/orders",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page.getByText("Needs acceptance").first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -120));
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText("Needs acceptance", { exact: false }) },
      { n: 2, loc: page.getByText("In preparation", { exact: false }) },
      { n: 3, loc: page.getByText("Ready for handoff", { exact: false }) },
    ],
  },
  {
    id: "orders-board",
    path: "/dashboard/orders",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByRole("button", { name: "Accept", exact: true }), 540);
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Accept", exact: true }) },
      { n: 2, loc: page.getByRole("button", { name: "Decline", exact: true }) },
      { n: 3, loc: page.getByRole("button", { name: "Details", exact: true }) },
    ],
  },
  {
    id: "orders-ready",
    path: "/dashboard/orders",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByRole("button", { name: "Mark Collected" }), 560);
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Mark Collected" }) },
      { n: 2, loc: page.getByRole("button", { name: "Record Paid" }) },
    ],
  },
  // ---- Chapter 7: Kitchen ----
  {
    id: "kitchen-setup",
    path: "/kitchen",
    auth: true,
    settle: 6000,
    marks: (page) => [{ n: 1, loc: page.getByRole("button", { name: /^Continue/ }) }],
  },
  {
    id: "kitchen-board",
    path: "/kitchen",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      const close = page.getByRole("button", { name: /close/i }).first();
      if (await close.count()) await close.click({ timeout: 5000 }).catch(() => undefined);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      await place(page, page.getByRole("button", { name: "Start preparing" }), 520);
    },
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Start preparing" }) },
      { n: 2, loc: page.getByRole("button", { name: "Complete item" }) },
    ],
  },
  // ---- Chapter 8: Dining floor ----
  {
    id: "floor-home",
    path: "/dashboard/floor",
    auth: true,
    settle: 6000,
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Add table" }) },
      { n: 2, loc: page.getByRole("button", { name: "Add chair" }) },
      { n: 3, loc: page.getByRole("button", { name: "Reserve" }) },
    ],
  },
  {
    id: "floor-tables",
    path: "/dashboard/floor",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByRole("button", { name: /^All tables/ }), 130);
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: /^All tables/ }) },
      { n: 2, loc: page.getByRole("button", { name: /^Main Dining/ }) },
      { n: 3, loc: page.getByRole("button", { name: "More actions for Table 1" }) },
    ],
  },
  // ---- Chapter 9: Reports ----
  {
    id: "reports-dates",
    path: "/dashboard/reports",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Last 30 Days" })
        .first()
        .click({ timeout: 8000 })
        .catch(() => undefined);
      await page.waitForTimeout(3500);
      await page
        .getByRole("button", { name: "Today", exact: true })
        .first()
        .scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -140));
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Today", exact: true }) },
      { n: 2, loc: page.getByRole("button", { name: "Last 7 Days" }) },
      { n: 3, loc: page.getByRole("button", { name: "Last 30 Days" }) },
    ],
  },
  {
    id: "reports-charts",
    path: "/dashboard/reports",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await page
        .getByRole("button", { name: "Last 30 Days" })
        .first()
        .click({ timeout: 8000 })
        .catch(() => undefined);
      await page.waitForTimeout(3500);
      await place(page, page.getByText("Recorded order value"), 120);
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText("Recorded order value", { exact: false }) },
      { n: 2, loc: page.getByText("Total orders", { exact: false }) },
      { n: 3, loc: page.getByText("Average order value", { exact: false }) },
    ],
  },
  {
    id: "reports-export",
    path: "/dashboard/reports",
    auth: true,
    settle: 6000,
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "View Daily Order Summary" }) },
      { n: 2, loc: page.getByText("Export CSV", { exact: true }) },
    ],
  },
  // ---- Chapter 10: Team and settings ----
  {
    id: "team-home",
    path: "/dashboard/organization",
    auth: true,
    settle: 6000,
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByRole("link", { name: /^My account/ }) },
      { n: 2, loc: page.getByRole("link", { name: /^Outlet settings/ }) },
      { n: 3, loc: page.getByRole("link", { name: /^Organization — People/ }) },
    ],
  },
  {
    id: "team-invite",
    path: "/dashboard/organization",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByText("Invite a teammate", { exact: true }).last(), 60);
    },
    clip: CONTENT,
    marks: (page) => [
      { n: 1, loc: page.getByText("Invite a teammate", { exact: true }) },
      { n: 2, loc: page.getByRole("button", { name: "Send invitation" }) },
    ],
  },
  {
    id: "team-roles",
    path: "/dashboard/organization",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByText("Outlet roles", { exact: true }).last(), 60);
    },
    clip: CONTENT,
    marks: (page) => [{ n: 1, loc: page.getByRole("button", { name: "Save outlet roles" }) }],
  },

  {
    id: "kitchen-incoming",
    path: "/kitchen",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      const close = page.getByRole("button", { name: /close/i }).first();
      if (await close.count()) await close.click({ timeout: 5000 }).catch(() => undefined);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      await page
        .getByRole("button", { name: "Accept & route" })
        .first()
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);
      await page.evaluate(() => window.scrollBy(0, -200));
    },
    marks: (page) => [
      { n: 1, loc: page.getByRole("button", { name: "Accept & route" }) },
      { n: 2, loc: page.getByRole("button", { name: "Decline" }) },
    ],
  },
  {
    id: "floor-seat",
    path: "/dashboard/floor",
    auth: true,
    settle: 6000,
    prepare: async (page) => {
      await place(page, page.getByRole("button", { name: "Seat party" }), 330);
    },
    clip: CONTENT,
    marks: (page) => [{ n: 1, loc: page.getByRole("button", { name: "Seat party" }) }],
  },
];
