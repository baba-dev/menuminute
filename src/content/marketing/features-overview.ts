/**
 * Editorial /features sections. Only real UI captures already shipped in public/docs-media
 * may be used for "shot". Avoid invented dashboards, unverified commercial guarantees,
 * and dietary/allergen safety claims. All paths are public marketing or docs routes.
 */
export type FeatureSpotlight = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  paragraphs: readonly [string, string];
  points: readonly string[];
  shot: string;
  alt: string;
  caption: string;
  guideHref: string;
  guideLabel: string;
  availabilityNote: string;
};

export const featureSpotlights: readonly FeatureSpotlight[] = [
  {
    id: "guest-menu",
    eyebrow: "01 / Made for guests",
    title: "A mobile restaurant menu that makes choosing dinner a pleasure.",
    lead: "Your menu should feel like your restaurant, not like a tiny PDF.",
    paragraphs: [
      "Give guests a clean, phone-friendly digital menu with clear categories, dish photographs where you supply them, descriptions and current prices. People can open it directly from a QR code or link, without downloading an app or creating an account.",
      "The guest view brings your published dishes together in one place, with helpful navigation and filters. A change in Menu Studio can reach the same live menu without asking your team to replace every table card.",
    ],
    points: [
      "Browser-based guest menu with category navigation",
      "Dish photos, descriptions and merchant-provided dietary details",
      "Published edits appear behind your existing menu link",
    ],
    shot: "public-menu",
    alt: "Actual MenuMinute guest-facing restaurant menu showing categories and dishes",
    caption: "Live guest menu · Actual MenuMinute interface with sample restaurant content",
    guideHref: "/docs/public-menu",
    guideLabel: "See the guest menu walkthrough",
    availabilityNote: "The published QR menu is part of the free core. Guest ordering depends on the outlet's active ordering capability.",
  },
  {
    id: "dish-details",
    eyebrow: "02 / The details sell the dish",
    title: "Show the right options before a guest needs to ask.",
    lead: "A good dish description removes doubt; a thoughtful customizer makes ordering clearer.",
    paragraphs: [
      "Present dishes with their own detail view so guests can inspect portions, available variants and permitted add-ons before they send a request. The restaurant stays in control of the options, prices and descriptions shown.",
      "Spice preferences, dietary labels and other culinary information can help a diner explore, but they should only reflect details the restaurant has supplied and verified. MenuMinute does not guarantee a dish is allergen-free or infer safety from AI-generated text.",
    ],
    points: [
      "Portion variants and optional extras where configured",
      "Clear pricing and availability checked during ordering",
      "Merchant-controlled dietary and spice information",
    ],
    shot: "public-menu-dish",
    alt: "Actual MenuMinute menu item detail dialog with dish options and descriptions",
    caption: "Dish detail view · Actual interface, example dishes and values",
    guideHref: "/docs/public-menu",
    guideLabel: "Explore how a diner chooses dishes",
    availabilityNote: "Dish details are visible on the guest menu; placing an order requires eligible ordering access.",
  },
  {
    id: "qr-studio",
    eyebrow: "03 / From screen to table",
    title: "Make your QR code part of the dining experience.",
    lead: "Print a menu link once. Keep improving the menu behind it.",
    paragraphs: [
      "QR Studio helps you find and manage the restaurant's permanent menu codes. Use the print tools to prepare material for tables or counters, then test the code on your own phone before service begins.",
      "When an item sells out, a price changes or the restaurant refreshes its categories, the menu can change without forcing a reprint. A permanent code remains useful until it is deliberately revoked or removed.",
    ],
    points: [
      "Stable published menu URLs and downloadable QR codes",
      "Print-friendly tabletop and counter materials",
      "Deliberate revocation controls when a code must stop working",
    ],
    shot: "qr-studio",
    alt: "Actual MenuMinute QR Studio showing permanent menu codes and print controls",
    caption: "QR Studio · Actual MenuMinute interface",
    guideHref: "/docs/qr-studio",
    guideLabel: "Learn to publish and print QR codes",
    availabilityNote: "Permanent QR menu sharing and core QR Studio features are available with the free menu.",
  },
  {
    id: "dining-floor",
    eyebrow: "04 / Service at every table",
    title: "Know which table needs your attention.",
    lead: "Give the service team a clearer picture of the dining room.",
    paragraphs: [
      "The dining-floor workspace brings configured tables, linked orders and guest service calls into a practical view. Staff can see where activity is happening, acknowledge a guest request and resolve it after someone has helped.",
      "This is especially helpful during a busy meal service: the team can check table context without searching through disconnected messages. Guest actions and table identity still follow your configured outlet workflow.",
    ],
    points: [
      "Table-focused view of live service activity",
      "Guest service requests with acknowledgement and resolution",
      "Links between table context and open orders",
    ],
    shot: "floor",
    alt: "Actual MenuMinute dining floor showing the restaurant's table and service overview",
    caption: "Dining floor · Actual MenuMinute demo workspace",
    guideHref: "/docs/floor",
    guideLabel: "Take a tour of the dining floor",
    availabilityNote: "Table service tools require the relevant outlet setup and available operational capabilities.",
  },
  {
    id: "reports",
    eyebrow: "05 / Understand what is happening",
    title: "Restaurant reports with numbers your team can act on.",
    lead: "Go beyond checking how many orders came in.",
    paragraphs: [
      "Review recorded order counts, order value and average order value for useful date ranges, then compare performance with the preceding period. Switch to menu intelligence or kitchen views when you need more than an overall total.",
      "The reporting workspace also supports CSV exports, making it easier to review trends outside the app. Figures describe recorded activity, not guaranteed sales growth or payment settlement; what appears depends on the outlet's enabled features and available history.",
    ],
    points: [
      "Date filters, period comparisons and recorded order metrics",
      "Menu intelligence, kitchen velocity and daily order views",
      "CSV export for further analysis",
    ],
    shot: "reports",
    alt: "Actual MenuMinute reports screen with restaurant activity, metrics and chart panels",
    caption: "Reports & insights · Actual MenuMinute demo data",
    guideHref: "/docs/reports",
    guideLabel: "Explore the reporting workspace",
    availabilityNote: "Available reporting panels and POS figures depend on the plan, recorded activity and outlet capabilities.",
  },
  {
    id: "translations",
    eyebrow: "06 / More welcoming menus",
    title: "Give more guests a menu they can understand.",
    lead: "Offer reviewed menu translations without maintaining a separate printed menu.",
    paragraphs: [
      "Keep translated names and descriptions alongside your main menu, then review them before you publish. Guests can select an available language in the browser-based menu. If a particular translation is missing, the menu can fall back to its original text.",
      "Translations stay connected to a menu revision, which makes it easier to spot copy that needs another review after the original changes. Your team remains responsible for checking names, ingredients and dietary wording before publication.",
    ],
    points: [
      "Per-language dish names and descriptions",
      "Guest language selection with original-text fallback",
      "Human-reviewed publication tied to menu revisions",
    ],
    shot: "menu-studio",
    alt: "Actual MenuMinute Menu Studio where restaurant menu content and translations are maintained",
    caption: "Menu Studio · Actual editing interface (not a dedicated translation screenshot)",
    guideHref: "/docs/translations",
    guideLabel: "Read the menu translation guide",
    availabilityNote: "Translation controls and supported languages depend on the configured menu and available features.",
  },
  {
    id: "ember",
    eyebrow: "07 / Ask better questions",
    title: "Meet Ember, the assistant that understands your outlet context.",
    lead: "Get oriented in your own menu, orders and kitchen data using everyday questions.",
    paragraphs: [
      "Where enabled, Ember can help an authorized team member ask about current restaurant activity and follow the sources behind its answers. That makes it useful for quickly exploring what's happening instead of hunting through multiple screens.",
      "Ember respects the outlet data the signed-in member can access. It is not a substitute for staff decisions or official financial records, and it does not autonomously publish dishes, accept orders or alter your menu. Demo answers may be limited or use labelled examples when allowances are exhausted.",
    ],
    points: [
      "Plain-language questions about outlet activity",
      "Source-aware, permission-scoped explanations",
      "No autonomous restaurant changes or publishing",
    ],
    shot: "ember",
    alt: "Actual MenuMinute Ember assistant interface for asking questions about restaurant activity",
    caption: "Ember assistant · Actual MenuMinute demo interface",
    guideHref: "/docs/ember",
    guideLabel: "See what Ember can answer",
    availabilityNote: "Ember is optional and subject to model/provider configuration, permissions and usage limits.",
  },
  {
    id: "team-and-outlets",
    eyebrow: "08 / Built for the people running it",
    title: "Give each team member the right view of your restaurant.",
    lead: "A cashier, chef and menu editor do not need the same controls.",
    paragraphs: [
      "Organize outlets and assign the people who work with them. MenuMinute's access model lets owners and admins manage membership while service, kitchen and menu roles receive appropriate operational permissions rather than unrestricted access.",
      "That matters as a restaurant grows: changing a menu, viewing kitchen work and managing an organization are different responsibilities. Invitations and sensitive administration actions use explicit security checks, and those actions are disabled in the shared public demo.",
    ],
    points: [
      "Organization, outlet and staff role management",
      "Invitation and scope-aware access workflows",
      "Permissions designed around real restaurant responsibilities",
    ],
    shot: "organization",
    alt: "Actual MenuMinute organization dashboard showing outlet and team management",
    caption: "Organization & access · Actual interface with demo-safe restrictions",
    guideHref: "/docs/organization",
    guideLabel: "Learn how outlet access works",
    availabilityNote: "Team invitations, role management and multi-outlet limits depend on the account and plan; demo writes are disabled.",
  },
  {
    id: "daily-dashboard",
    eyebrow: "09 / One place to start service",
    title: "Open the dashboard and see what matters today.",
    lead: "Know whether your menu is live, what needs attention and where to go next.",
    paragraphs: [
      "The dashboard brings together useful outlet status, quick actions and service activity. Check menu publication, jump to dish availability or go straight to the workspace your shift needs.",
      "Different businesses have different priorities, so the workspace includes layout customization for supported panels. As your team adds ordering, kitchen and reporting capabilities, the dashboard remains a familiar starting point without turning into a second menu editor.",
    ],
    points: [
      "Live publication status and useful operational shortcuts",
      "Quick access to menu availability and active work",
      "Configurable dashboard layout for different roles",
    ],
    shot: "dashboard",
    alt: "Actual MenuMinute restaurant dashboard showing menu status, quick actions and service activity",
    caption: "Dashboard overview · Actual MenuMinute demo workspace",
    guideHref: "/docs/dashboard",
    guideLabel: "Tour the restaurant dashboard",
    availabilityNote: "Panels reflect the user's permissions, enabled services and current outlet.",
  },
];

export const featureFaqs: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "Can I create a QR menu without paying?",
    answer:
      "Yes. MenuMinute's core digital menu publishing and permanent QR menu sharing are free. Extras such as advanced ordering, Kitchen Pro and optional AI tools have their own access conditions.",
  },
  {
    question: "Do guests have to install an app or create an account?",
    answer:
      "No. Guests can scan a published QR code and browse the menu in their phone's web browser without an app or a diner account.",
  },
  {
    question: "Can I update prices or mark dishes sold out without reprinting QR codes?",
    answer:
      "Yes. Edit and publish supported menu changes in Menu Studio, or use availability controls. A permanent QR code keeps pointing to the same menu until you intentionally revoke it.",
  },
  {
    question: "Does an online order go straight to the kitchen?",
    answer:
      "Submitting a guest order is a request, not acceptance. Authorized restaurant staff accept or decline it. Kitchen routing then follows the outlet's configured and eligible workflow.",
  },
  {
    question: "Does MenuMinute collect money from my diners automatically?",
    answer:
      "Not by default. Staff-recorded payments, receipts and POS reports do not mean that MenuMinute has captured or settled a payment through a gateway. Check your configured payment and subscription options before relying on a specific checkout workflow.",
  },
  {
    question: "Can I try the real application before signing up?",
    answer:
      "Yes. The interactive public demo includes a sample guest menu and shared restaurant dashboard with orders, a kitchen and reporting. Some actions, including POS, account management and paid provider operations, are intentionally unavailable in the shared demo.",
  },
  {
    question: "Does the AI publish a photographed menu on its own?",
    answer:
      "No. Where AI Menu Import is configured, it proposes draft items to review. The merchant checks names, prices and dietary statements and approves changes before applying or publishing them.",
  },
];
