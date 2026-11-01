/**
 * Copy for "Upload. Review. Live." (home-v2 section 4). Statements describe the product's existing
 * import rules (see src/modules/menu-import/review.ts and the owner help article) and this page's
 * sample. Import is open to every outlet (confirmed by the owner), so the copy says so; the review
 * rule still applies to every import. Every `href` is checked by tests/pdf-to-menu.test.ts.
 */
export type ImportCard = { title: string; body: string; href: string; cta: string };

export const SOURCE_TITLE = "Sample Café";
export const SOURCE_SUBTITLE = "Printed menu · sample-menu.pdf";

/** Lines of the sample paper; the first four are the dishes the scanner reads, in order. */
export const SOURCE_LINES: readonly {
  name: string;
  price: string;
  smudged?: boolean;
  unclear?: boolean;
}[] = [
  { name: "Butter Chicken", price: "399" },
  { name: "Biryani", price: "279" },
  { name: "Chettinad Chicken", price: "4O9", unclear: true },
  { name: "Amritsari Fish", price: "3▒9", smudged: true },
];

export const IMPORT_CARDS: readonly ImportCard[] = [
  {
    title: "Nothing publishes by itself",
    body: "Imported items go into a private draft. You review and approve them, and only you publish.",
    href: "/help/owner/ai-menu-import",
    cta: "How the review works",
  },
  {
    title: "Every field has a source",
    body: "Each name and price is checked against the photo or PDF it was read from, and unclear ones are flagged for you.",
    href: "/docs/menu-import",
    cta: "Read the import guide",
  },
  {
    title: "Open to every outlet",
    body: "Photo and PDF import is available to every outlet. You still review everything before it goes live.",
    href: "/register",
    cta: "Get started free",
  },
];

export const IMPORT_NOTE =
  "Scripted preview with a sample menu: no file is uploaded or processed on this page, and no AI runs here. Dish details are never verified claims.";
