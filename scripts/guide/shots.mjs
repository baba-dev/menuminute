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
];
