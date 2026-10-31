/**
 * Product documentation. Every screenshot id must exist in scripts/demo/docs-shots.mjs and public/docs-media
 * (tests/docs-content.test.ts enforces both). Copy describes what the product does today; anything the
 * public demo deliberately cannot do is flagged with `inDemo: false`.
 */
export type GuideGroup = "Get started" | "Menu" | "Run service" | "Insights & AI" | "Business";

export type Guide = {
  slug: string;
  title: string;
  group: GuideGroup;
  summary: string;
  /** Screenshot id (see scripts/demo/docs-shots.mjs), or null when the demo cannot show the feature. */
  shot: string | null;
  /** Additional screenshots shown under the hero. */
  moreShots?: string[];
  /** Where to try it. Dashboard links require entering the demo first (/demo). */
  tryIt: { label: string; href: string } | null;
  inDemo: boolean;
  whatItDoes: string[];
  steps: string[];
  tips: string[];
  related: string[];
};

export const GROUP_ORDER: GuideGroup[] = [
  "Get started",
  "Menu",
  "Run service",
  "Insights & AI",
  "Business",
];

export const GUIDES: Guide[] = [
  {
    slug: "try-the-demo",
    title: "Try the live demo",
    group: "Get started",
    summary:
      "A shared sample restaurant with 236 dishes, live orders and a working kitchen. Everything resets every 30 minutes.",
    shot: "demo-hub",
    tryIt: { label: "Open the demo", href: "/demo" },
    inDemo: true,
    whatItDoes: [
      "Spice Route Kitchen is a sample outlet with a full 236-dish menu, 12 tables, a staffed kitchen with four stations and a month of order history.",
      "You can scan the guest QR code, place an order, accept it as the restaurant, watch it appear on the kitchen display and see reports update.",
      "The account is shared by all visitors and returns to its starting state every 30 minutes, so you can experiment freely.",
    ],
    steps: [
      "Open the demo page and choose Enter the Demo Dashboard. No sign-up or password is needed.",
      "Open the customer menu in another tab (or scan the QR code with your phone) and place an order.",
      "Back in the dashboard open Orders, accept the order, then move it through the kitchen.",
      "Ask Ember a question about the orders you just created, if Ember is switched on for the demo.",
    ],
    tips: [
      "Point of Sale, billing, team invitations, uploads and the outlet profile are switched off in the demo so the shared account stays safe.",
      "All dish details, prices, allergens and nutrition in the demo are sample data and are not verified. Never rely on them for real dietary advice.",
    ],
    related: ["public-menu", "orders", "kitchen"],
  },
  {
    slug: "dashboard",
    title: "Dashboard overview",
    group: "Get started",
    summary: "Your outlet at a glance: live menu status, today's priorities and quick actions.",
    shot: "dashboard",
    tryIt: { label: "Open the dashboard", href: "/dashboard" },
    inDemo: true,
    whatItDoes: [
      "The overview shows how many menus, categories and dishes are live, how many QR codes are active and whether the public menu is available to guests.",
      "Quick actions take you to Menu Studio and dish availability, and a command bar (Ctrl K) jumps anywhere in the workspace.",
      "A service activity panel summarises what needs attention now from your live order ledger.",
    ],
    steps: [
      "Check the Public menu status tile reads Live before a service.",
      "Use Open Menu Studio to change dishes or Dish Availability to mark something sold out.",
      "Press Ctrl K to search for a page or action.",
    ],
    tips: [
      "Use Customize layout to hide panels you do not need and re-order the rest.",
      "The outlet switcher in the left column changes which outlet every page shows.",
    ],
    related: ["menu-studio", "orders"],
  },
  {
    slug: "menu-studio",
    title: "Menu Studio",
    group: "Menu",
    summary:
      "Build and publish your menu: categories, dishes, prices, variants, add-ons, dietary flags and images.",
    shot: "menu-studio",
    tryIt: { label: "Open Menu Studio", href: "/dashboard/menu" },
    inDemo: true,
    whatItDoes: [
      "Menu Studio keeps a private draft separate from what guests see. Nothing changes on the public menu until you publish.",
      "Each dish can have a description, price, variants such as Half and Full, add-on groups with minimum and maximum choices, dietary flags, spice level, a weekly schedule and an image.",
      "Images can be your own approved photograph or one of the bundled illustrations. Dishes without either show a neutral plate placeholder.",
      "Smart Composer helps you add many dishes at once from a catalogue of known dish names. Prices and sections are always confirmed by you.",
    ],
    steps: [
      "Open Menu Studio and pick a category or use search to find a dish.",
      "Edit the dish details and add variants or add-on groups if needed.",
      "Review the preview, then publish. Guests see the new menu straight away.",
    ],
    tips: [
      "Mark allergens and dietary information only from verified ingredient information. MenuMinute never invents allergen safety claims.",
      "Use quick availability for a one-tap sold-out toggle during service instead of editing the menu.",
    ],
    related: ["translations", "public-menu", "menu-import"],
  },
  {
    slug: "translations",
    title: "Menu translations",
    group: "Menu",
    summary: "Offer the public menu in more than one language and keep each translation reviewed.",
    shot: "menu-studio",
    tryIt: { label: "Open Menu Studio", href: "/dashboard/menu" },
    inDemo: true,
    whatItDoes: [
      "Translations are stored per language alongside the published menu, tied to the revision they were written for.",
      "Guests choose a language on the public menu. Dishes without a translation fall back to the original text.",
    ],
    steps: [
      "Open Menu Studio and choose Translations for the menu.",
      "Add a language, enter or paste the translated names and descriptions and review them.",
      "Publish the menu so the translation goes live with the matching revision.",
    ],
    tips: [
      "Re-review translations after you change prices or descriptions; a translation is linked to the revision it was written for.",
    ],
    related: ["menu-studio", "public-menu"],
  },
  {
    slug: "menu-import",
    title: "Import a menu",
    group: "Menu",
    summary:
      "Start from an existing menu photo or document and review every suggestion before it is applied.",
    shot: "menu-import",
    tryIt: { label: "Open Menu Import", href: "/dashboard/menu/import" },
    inDemo: false,
    whatItDoes: [
      "Upload photos or documents of an existing menu. AI reads them and proposes categories, dishes and prices.",
      "Nothing is applied automatically. You review each candidate, correct it and then apply the reviewed result in one transaction.",
    ],
    steps: [
      "Open Menu Import and add one or more source images.",
      "Start processing and wait for the review state.",
      "Check each dish, fix names or prices and apply the reviewed menu.",
    ],
    tips: [
      "The public demo shows this screen but does not run imports, because they use a paid AI provider and uploads are disabled.",
    ],
    related: ["menu-studio"],
  },
  {
    slug: "qr-studio",
    title: "QR Studio",
    group: "Menu",
    summary: "Create permanent QR codes for your menu and design materials to print.",
    shot: "qr-studio",
    tryIt: { label: "Open QR Studio", href: "/dashboard/qr-codes" },
    inDemo: true,
    whatItDoes: [
      "QR Library lists the QR codes for your outlet. Each code points at a permanent link, so printed materials keep working when the menu changes.",
      "Print Studio lays out printable materials, such as table cards, around a scannable code for your outlet.",
      "You can revoke a code deliberately if it is ever misused.",
    ],
    steps: [
      "Open QR Studio and select the code you want to print.",
      "Choose a design in Print Studio and download it.",
      "Test the printed code with a phone before putting it on tables.",
    ],
    tips: [
      "Copied QR codes are public. Orders are accepted by staff, not by table position alone.",
    ],
    related: ["public-menu", "floor"],
  },
  {
    slug: "public-menu",
    title: "Guest menu and ordering",
    group: "Run service",
    summary:
      "The page your guests see after scanning: browse, filter, choose options and send an order.",
    shot: "public-menu",
    moreShots: ["public-menu-dish"],
    tryIt: { label: "Open the guest menu", href: "/m/demo-spice-route-kitchen-v2" },
    inDemo: true,
    whatItDoes: [
      "A food-first cover, a sticky category navigator and responsive dish cards present your menu on any phone.",
      "Guests filter by dietary flags, open a dish for variants and add-ons, and see availability checked before they order.",
      "Prices are always calculated on the server, never trusted from the phone. Submitting an order is a request: the restaurant accepts it, and the guest follows its status on a tracking page.",
    ],
    steps: [
      "Scan the QR code or open the menu link.",
      "Pick dishes and choose any required options.",
      "Review the cart and submit. Keep the tracking page open to follow the order.",
    ],
    tips: [
      "Guests can order only while an Online Ordering entitlement is active for the outlet. The free QR menu works without it.",
      "Allergen and nutrition details in the demo are sample data.",
    ],
    related: ["orders", "qr-studio"],
  },
  {
    slug: "orders",
    title: "Orders",
    group: "Run service",
    summary: "Accept, prepare and complete guest orders from one live queue.",
    shot: "orders",
    tryIt: { label: "Open Orders", href: "/dashboard/orders" },
    inDemo: true,
    whatItDoes: [
      "The Service Rail lists tickets by state: pending, accepted, preparing, ready and finished. The Service Pulse summarises the queue.",
      "Each action checks that you are looking at the latest version of the ticket, so two people cannot overwrite each other.",
      "A pending order that is not accepted in time expires automatically and shows as expired.",
    ],
    steps: [
      "Open Orders and accept or reject each pending ticket.",
      "Move accepted tickets to preparing, then ready, then served or collected.",
      "Open a ticket to see its items, add-ons and history.",
    ],
    tips: [
      "If the queue cannot refresh, the last verified tickets stay visible and read-only instead of showing an empty queue.",
    ],
    related: ["kitchen", "floor"],
  },
  {
    slug: "kitchen",
    title: "Kitchen display",
    group: "Run service",
    summary: "Route each dish to a station and track preparation from queued to ready.",
    shot: "kitchen",
    tryIt: { label: "Open the kitchen", href: "/kitchen" },
    inDemo: true,
    whatItDoes: [
      "Kitchen Pro splits an accepted order into station tickets (for example Tandoor & Grill, Wok & Fry, Curry & Rice and Cold & Sweet).",
      "Cooks move their station's items through queued, preparing and complete. An expeditor releases the finished order so the whole ticket leaves together.",
      "Updates stream to every device, and staff only see the stations and outlets they are assigned to.",
    ],
    steps: [
      "Accept an order in Orders. Its items appear on the matching stations.",
      "Start and finish items on the station screen.",
      "Release the order from the expeditor view.",
    ],
    tips: [
      "Every published dish must be routed to a staffed station before Kitchen Pro can accept orders. The demo is pre-configured.",
    ],
    related: ["orders", "floor"],
  },
  {
    slug: "floor",
    title: "Dining floor",
    group: "Run service",
    summary: "See every table, its open orders and guest service requests.",
    shot: "floor",
    tryIt: { label: "Open the floor", href: "/dashboard/floor" },
    inDemo: true,
    whatItDoes: [
      "The floor view shows the outlet's tables with the activity attached to each one.",
      "Guests who scan a table QR can ask for service; staff acknowledge and resolve those requests here.",
    ],
    steps: [
      "Open the floor to see which tables have open orders.",
      "Acknowledge a service request and resolve it when done.",
    ],
    tips: ["Table numbers and labels are managed with the outlet's dining layout."],
    related: ["orders", "qr-studio"],
  },
  {
    slug: "point-of-sale",
    title: "Point of Sale",
    group: "Run service",
    summary: "Take counter orders, record payment, print receipts and close the till.",
    shot: null,
    tryIt: null,
    inDemo: false,
    whatItDoes: [
      "The counter lets staff build an order from the published menu, record how it was paid and issue a receipt.",
      "Ledger, receipts and closing keep a permanent, immutable financial record, and the Z-report summarises a closed session.",
    ],
    steps: [
      "Enable Point of Sale for the outlet and open the counter.",
      "Add dishes, take payment and issue the receipt.",
      "Close the till at the end of the shift and review the Z-report.",
    ],
    tips: [
      "Point of Sale is not available in the public demo. Its ledger is intentionally permanent and cannot be reset, so the shared demo account never enables it.",
    ],
    related: ["reports", "orders"],
  },
  {
    slug: "reports",
    title: "Reports and insights",
    group: "Insights & AI",
    summary:
      "Order value, order counts and dish and kitchen insights for any date range, with CSV export.",
    shot: "reports",
    tryIt: { label: "Open Reports", href: "/dashboard/reports" },
    inDemo: true,
    whatItDoes: [
      "Reports summarise recorded order value, order counts and average order value for Today, Yesterday, the last 7 or 30 days, this month or a custom range, with a comparison against the previous period.",
      "Separate tabs cover Menu Intelligence, Point of Sale and shifts, Kitchen Velocity and a Daily Order Summary. Export CSV downloads the data.",
    ],
    steps: [
      "Open Reports and choose a date range such as Last 30 Days.",
      "Switch between Overview & Orders, Menu Intelligence and Kitchen Velocity.",
      "Use Export CSV for the data you need.",
    ],
    tips: ["The demo contains 30 days of sample order history so charts are never empty."],
    related: ["orders", "ember"],
  },
  {
    slug: "ember",
    title: "Ember assistant",
    group: "Insights & AI",
    summary:
      "Ask plain-language questions about your orders, menu and kitchen. Answers cite their sources.",
    shot: "ember",
    tryIt: { label: "Open the dashboard", href: "/dashboard" },
    inDemo: true,
    whatItDoes: [
      "Ember reads your current outlet data using only the permissions you already have and labels where each answer came from.",
      "It is read-only: it never changes the menu or orders on its own, and AI-written content is always a draft for you to review.",
      "In the public demo Ember has a small daily allowance shared by all visitors; when it is used up you will see clearly labelled sample answers instead.",
    ],
    steps: [
      "Open Ember from the top bar.",
      "Ask a question such as How is my order queue looking?",
      "Check the sources shown beneath the answer.",
    ],
    tips: [
      "Questions in the demo are limited to 280 characters. Do not enter personal information.",
    ],
    related: ["reports", "orders"],
  },
  {
    slug: "organization",
    title: "Organization and access",
    group: "Business",
    summary: "Manage outlets, team members and what each person is allowed to do.",
    shot: "organization",
    tryIt: { label: "Open Organization", href: "/dashboard/organization" },
    inDemo: true,
    whatItDoes: [
      "An organization owns one or more outlets. Owners and admins manage members; outlet roles such as manager, service, kitchen and menu editor limit what each person can see and do.",
      "Invitations bring people in by email and they accept before getting access. Sensitive actions ask for a recent second-factor confirmation.",
    ],
    steps: [
      "Open Organization and review members and outlet roles.",
      "Invite a colleague and choose their role.",
      "Review access whenever someone changes role.",
    ],
    tips: ["Inviting people and changing billing are disabled in the public demo."],
    related: ["settings"],
  },
  {
    slug: "settings",
    title: "Outlet settings",
    group: "Business",
    summary: "Outlet profile, hours, currency and ordering options in one place.",
    shot: "settings",
    tryIt: { label: "Open Settings", href: "/dashboard/settings" },
    inDemo: true,
    whatItDoes: [
      "Settings holds the outlet's public profile, service hours, timezone, currency and fulfilment options such as dine-in and scheduled pickup.",
    ],
    steps: [
      "Open Settings and review each section.",
      "Save changes; the public menu uses them immediately.",
    ],
    tips: ["Outlet profile changes are disabled in the public demo."],
    related: ["organization", "public-menu"],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
export function guidesByGroup(): Array<{ group: GuideGroup; guides: Guide[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    guides: GUIDES.filter((g) => g.group === group),
  })).filter((entry) => entry.guides.length);
}
