export type MarketingFeature = {
  slug: string;
  path: string;
  title: string;
  eyebrow: string;
  headline: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  availability: "free" | "paid" | "limited" | "provider";
  availabilityText: string;
  image?: string;
  heroArtwork: {
    desktopLight: string;
    desktopDark: string;
    mobileLight: string;
    mobileDark: string;
    label: string;
    alt: string;
  };
  editorial: {
    eyebrow: string;
    title: string;
    situation: string;
    approach: string;
    outcome: string;
    actionLabel: string;
    actionHref: string;
    checklist: string[];
  };
  imageAlt?: string;
  screenshotCaption?: string;
  cta: string;
  ctaHref: string;
  secondaryCta: string;
  secondaryHref: string;
  highlights: string[];
  benefits: { title: string; description: string }[];
  steps: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  guideHref: string;
  guideLabel: string;
};

export const marketingFeatures: readonly MarketingFeature[] = [
  {
    slug: "free-qr-menu",
    heroArtwork: {
      desktopLight: "/brand/qr-studio/tabletop-press/hero-desktop-light.webp",
      desktopDark: "/brand/qr-studio/tabletop-press/hero-desktop-dark.webp",
      mobileLight: "/brand/qr-studio/tabletop-press/hero-mobile-light.webp",
      mobileDark: "/brand/qr-studio/tabletop-press/hero-mobile-dark.webp",
      label: "QR Studio • The Tabletop Press",
      alt: "Branded editorial hero from the MenuMinute QR Studio",
    },
    editorial: {
      eyebrow: "From printed menus to one permanent code",
      title: "A busy table should never mean outdated information",
      situation:
        "When prices change or a dish sells out, printed menus and static PDF files can quickly become inconsistent. A QR menu gives guests a single page that can reflect the restaurant’s latest published information.",
      approach:
        "Build dish categories in Menu Studio, publish the public menu, and create a permanent QR code from QR Studio. Download it for table cards and check the guest view on your own phone.",
      outcome:
        "The same QR code can continue to work while the menu behind it evolves. Online ordering and Kitchen Pro are separate, optional capabilities.",
      actionLabel: "See the live guest menu",
      actionHref: "/m/demo-spice-route-kitchen-v2",
      checklist: [
        "Browse the sample guest menu without an account",
        "See real QR Studio controls in the walkthrough",
        "Create your own free menu and print your own code",
      ],
    },
    path: "/free-qr-menu",
    title: "Free QR Menu",
    eyebrow: "FREE FOREVER / DIGITAL MENUS",
    headline: "A beautiful restaurant QR menu. Free forever.",
    description:
      "Build your restaurant's menu, publish it online and share a permanent QR code. Guests browse dishes on their phones without an app download or an account.",
    seoTitle: "Free QR Menu Maker for Restaurants",
    seoDescription:
      "Create a free restaurant QR code menu. Add dishes, categories and prices, publish a mobile-friendly menu and download permanent QR codes.",
    availability: "free",
    availabilityText:
      "The core QR menu is free permanently. Premium ordering and kitchen features are separate.",
    image: "qr-studio",
    imageAlt: "MenuMinute QR Studio showing restaurant QR code controls",
    screenshotCaption: "QR Studio · Actual MenuMinute interface",
    cta: "Create my free menu",
    ctaHref: "/register",
    secondaryCta: "Scan the sample menu",
    secondaryHref: "/demo",
    highlights: [
      "Free QR menu publishing",
      "Permanent downloadable QR codes",
      "No diner app or login",
      "Update dishes without changing the code",
    ],
    benefits: [
      {
        title: "Publish once, update anytime",
        description:
          "Change descriptions, prices and availability in Menu Studio. Your existing QR code continues pointing to the same published menu.",
      },
      {
        title: "Bring your own restaurant identity",
        description:
          "Organize dishes into categories and add variants, descriptions and images where available. Give guests a familiar menu instead of an unstructured PDF.",
      },
      {
        title: "Easy to print and share",
        description:
          "Download your QR code in supported formats or print it for tables and counters. Test the customer view before sharing.",
      },
    ],
    steps: [
      {
        title: "Create your restaurant",
        description:
          "Register and set up your first outlet. You can complete optional details later.",
      },
      {
        title: "Add your dishes",
        description:
          "Organize your menu with categories, prices, descriptions and optional imagery.",
      },
      {
        title: "Publish and display",
        description:
          "Publish your menu and download its permanent QR code for your tables, packaging or counter.",
      },
    ],
    faqs: [
      {
        question: "Is the QR menu really free?",
        answer:
          "Yes. MenuMinute's core QR menu plan is free permanently. Ordering, Kitchen Pro and optional AI tools have different eligibility and access conditions.",
      },
      {
        question: "Will the QR code change when I update prices?",
        answer:
          "No. A permanent QR code points to your published menu. You can update the menu content without reprinting the code.",
      },
      {
        question: "Must customers install an app?",
        answer:
          "No. Guests can scan the QR code with their phone camera and view the published menu in a browser.",
      },
    ],
    guideHref: "/docs/qr-studio",
    guideLabel: "See the QR Studio guide",
  },
  {
    slug: "digital-menu-builder",
    heroArtwork: {
      desktopLight: "/brand/menu-studio/recipe-atelier/hero-desktop-light.webp",
      desktopDark: "/brand/menu-studio/recipe-atelier/hero-desktop-dark.webp",
      mobileLight: "/brand/menu-studio/recipe-atelier/hero-mobile-light.webp",
      mobileDark: "/brand/menu-studio/recipe-atelier/hero-mobile-dark.webp",
      label: "Menu Studio • Recipe Atelier",
      alt: "Branded Recipe Atelier hero artwork used inside Menu Studio",
    },
    editorial: {
      eyebrow: "Turn a list of dishes into a dining experience",
      title: "Every change deserves a place to live",
      situation:
        "Restaurant menus change throughout the week: seasonal dishes appear, portion options change and some ingredients run out. Updating one controlled menu is simpler than rebuilding a file and sending it everywhere.",
      approach:
        "Manage categories, item names, descriptions, prices and available variants in Menu Studio. Review your public menu as a guest would, then publish the right version.",
      outcome:
        "Guests get a consistent browser-based menu while your team keeps control of edits and publishing.",
      actionLabel: "Open the sample restaurant menu",
      actionHref: "/m/demo-spice-route-kitchen-v2",
      checklist: [
        "Plan categories diners recognize",
        "Use descriptions and variants to answer common questions",
        "Check availability and publication before service",
      ],
    },
    path: "/features/digital-menu-builder",
    title: "Digital Menu Builder",
    eyebrow: "MENU STUDIO / RESTAURANT CONTENT",
    headline: "Make every dish easy to discover.",
    description:
      "Arrange categories, dishes, variants and prices in one menu workspace. Keep your live restaurant menu current without redesigning printed pages.",
    seoTitle: "Digital Restaurant Menu Builder",
    seoDescription:
      "Build and manage a mobile-friendly digital restaurant menu with MenuMinute. Add dishes, categories, variants, prices and sold-out information.",
    availability: "free",
    availabilityText:
      "Core digital menu editing and publishing are included in the free QR menu plan. Some enhancements are separately enabled.",
    image: "menu-studio",
    imageAlt: "MenuMinute Menu Studio editing categories and dishes",
    screenshotCaption: "Menu Studio · Actual MenuMinute interface",
    cta: "Build a free menu",
    ctaHref: "/register",
    secondaryCta: "See a sample menu",
    secondaryHref: "/demo",
    highlights: [
      "Categories and dishes",
      "Variants and pricing",
      "Availability controls",
      "Mobile guest presentation",
    ],
    benefits: [
      {
        title: "Structure your food clearly",
        description:
          "Group menu items into sensible categories and give each dish a name, description and price so customers find what they want.",
      },
      {
        title: "Handle choices and sold-out items",
        description:
          "Configure supported variants and availability controls instead of leaving guests guessing when a dish is unavailable.",
      },
      {
        title: "Separate editing from publication",
        description:
          "Work on your restaurant menu from the dashboard and check the public menu presentation before sharing it.",
      },
    ],
    steps: [
      {
        title: "Organize categories",
        description:
          "Start with the groups your guests expect: starters, mains, drinks, desserts or your own sections.",
      },
      {
        title: "Add dish details",
        description:
          "Enter prices, descriptions and supported variants. Add photos if you have them.",
      },
      {
        title: "Publish your menu",
        description: "Open your public menu and share its QR code from the QR Studio.",
      },
    ],
    faqs: [
      {
        question: "Can I change menu prices later?",
        answer:
          "Yes. Edit menu content from Menu Studio and publish changes without making a new QR code.",
      },
      {
        question: "Can I mark a dish as unavailable?",
        answer: "Yes. Supported sold-out controls allow you to reflect availability in the menu.",
      },
      {
        question: "Does the menu work on a phone?",
        answer:
          "Yes. Published guest menus are designed to be viewed in a phone browser without customer registration.",
      },
    ],
    guideHref: "/docs/menu-studio",
    guideLabel: "Explore the Menu Studio guide",
  },
  {
    slug: "online-ordering",
    heroArtwork: {
      desktopLight: "/brand/orders/service-counter/hero-desktop-light.webp",
      desktopDark: "/brand/orders/service-counter/hero-desktop-dark.webp",
      mobileLight: "/brand/orders/service-counter/hero-mobile-light.webp",
      mobileDark: "/brand/orders/service-counter/hero-mobile-dark.webp",
      label: "Orders • The Service Counter",
      alt: "Editorial hero artwork from the restaurant Orders service counter",
    },
    editorial: {
      eyebrow: "A guest request is not yet an accepted order",
      title: "Keep the handoff between guest and restaurant clear",
      situation:
        "Guests scanning a menu may expect immediate confirmation, but a restaurant still needs to check capacity and availability. MenuMinute distinguishes submitting an order request from staff acceptance.",
      approach:
        "On the Ordering plan, a guest chooses dishes and sends a dine-in or pickup request. The restaurant accepts or declines the ticket and the guest can follow its status. Prices are calculated on the server.",
      outcome:
        "Keep ownership of acceptance and preparation decisions with the team. Payment capture, settlement and availability depend on separate configuration.",
      actionLabel: "Explore the live ordering demo",
      actionHref: "/demo",
      checklist: [
        "Guest submits an order request from the published menu",
        "Staff confirm the ticket and manage service states",
        "Guests can check tracking after submission",
      ],
    },
    path: "/ordering",
    title: "Restaurant Online Ordering",
    eyebrow: "LIVE ORDERING / ORDERING PLAN",
    headline: "From a quick scan to an organized order.",
    description:
      "Let guests browse and submit dine-in or pickup orders from your published menu. Staff review and accept each order while guests follow its status.",
    seoTitle: "Restaurant Online Ordering and Table QR Orders",
    seoDescription:
      "Explore MenuMinute dine-in QR ordering, pickup orders and guest order tracking. Included from the Ordering plan at ₹119 a month.",
    availability: "paid",
    availabilityText:
      "Online ordering comes with the Ordering plan at ₹119 a month (and every plan above it). Your free QR menu works from day one; upgrade from your billing page when you are ready to take orders.",
    image: "orders",
    imageAlt: "MenuMinute orders workspace for restaurant staff",
    screenshotCaption: "Orders · Actual MenuMinute interface",
    cta: "See ordering plans",
    ctaHref: "/pricing",
    secondaryCta: "Explore the demo",
    secondaryHref: "/demo",
    highlights: [
      "Dine-in and pickup requests",
      "Staff order acceptance",
      "Guest order tracking",
      "Outlet eligibility controls",
    ],
    benefits: [
      {
        title: "Keep guests informed",
        description:
          "When ordering is enabled, guests can submit a request and follow an order tracking page. Submission is not the same as restaurant acceptance.",
      },
      {
        title: "Put your staff in control",
        description:
          "Restaurant operators review requests and manage acceptance through authorized workflows.",
      },
      {
        title: "Use accurate prices",
        description:
          "Order prices are calculated server-side using the outlet's configured menu rather than relying on a guest's browser totals.",
      },
    ],
    steps: [
      {
        title: "Choose the Ordering plan",
        description:
          "Upgrade from your billing page. Ordering switches on for your outlet as soon as the payment is confirmed.",
      },
      {
        title: "Guest submits an order",
        description:
          "A guest chooses supported menu items and submits a dine-in or pickup request.",
      },
      {
        title: "Restaurant confirms and prepares",
        description: "Staff accept or decline the request and the guest can follow status updates.",
      },
    ],
    faqs: [
      {
        question: "Is online ordering available as soon as I sign up?",
        answer:
          "Ordering is part of the paid Ordering plan. Start free with a QR menu, then upgrade from your billing page whenever you are ready.",
      },
      {
        question: "Does placing an order mean the restaurant accepted it?",
        answer: "No. A guest submission is a request until the restaurant accepts it.",
      },
      {
        question: "Does this automatically charge the customer's card?",
        answer:
          "No. Payment availability is separate. A staff-recorded paid status is not proof of an online payment provider charge.",
      },
    ],
    guideHref: "/docs/orders",
    guideLabel: "Read the orders guide",
  },
  {
    slug: "kitchen-display-system",
    heroArtwork: {
      desktopLight: "/brand/dashboard/editorial/hero-desktop-light.webp",
      desktopDark: "/brand/dashboard/editorial/hero-desktop-dark.webp",
      mobileLight: "/brand/dashboard/editorial/hero-mobile-light.webp.png",
      mobileDark: "/brand/dashboard/editorial/hero-mobile-dark.webp.png",
      label: "Restaurant Dashboard • Editorial Collection",
      alt: "MenuMinute restaurant workspace editorial hero artwork",
    },
    editorial: {
      eyebrow: "The right dish. The right station. The right moment.",
      title: "Let the ticket lead the service",
      situation:
        "During a rush, kitchen staff need to know what to prepare, who is responsible and what is ready to pass. Unclear paper handoffs can make that harder across stations.",
      approach:
        "Kitchen Pro organizes incoming tickets for configured preparation stations and helps authorized staff move work through preparation and final release. The publicly documented kitchen screenshots show the actual interface.",
      outcome:
        "The kitchen has a coordinated view of work, set up per outlet with its own stations and staff.",
      actionLabel: "Explore the kitchen walkthrough",
      actionHref: "/docs/kitchen",
      checklist: [
        "Review the station layout before going live",
        "Understand ticket stages from preparation to release",
        "Confirm outlet, device and staff readiness",
      ],
    },
    path: "/features/kitchen-display-system",
    title: "Kitchen Display System",
    eyebrow: "KITCHEN PRO / ₹499 A MONTH",
    headline: "A calmer view of a busy kitchen.",
    description:
      "See incoming tickets and coordinate preparation across configured stations. Kitchen Pro gives your kitchen a dedicated workflow once your outlet, devices and staff are set up.",
    seoTitle: "Kitchen Display System (KDS) for Restaurants",
    seoDescription:
      "Explore Kitchen Pro, MenuMinute's restaurant kitchen display with order tickets and station routing. ₹499 a month with three outlets included.",
    availability: "paid",
    availabilityText:
      "Kitchen Pro is ₹499 a month with three outlets included (₹149 for each extra outlet, up to ten) and it includes online ordering. After you subscribe, set up stations and staff; tickets start routing once your outlet is ready. The public demo does not grant production KDS access.",
    image: "kitchen",
    imageAlt: "MenuMinute kitchen display with incoming kitchen tickets",
    screenshotCaption: "Kitchen Pro · Actual MenuMinute interface",
    cta: "See Kitchen Pro pricing",
    ctaHref: "/pricing",
    secondaryCta: "View kitchen documentation",
    secondaryHref: "/docs/kitchen",
    highlights: [
      "Station-specific tickets",
      "Preparation stages",
      "Incoming ticket alerts",
      "Kitchen device workflows",
    ],
    benefits: [
      {
        title: "Make the next task visible",
        description:
          "Give authorized kitchen staff a shared, readable view of orders that need preparation.",
      },
      {
        title: "Coordinate stations",
        description:
          "Use configured kitchen, bar and final-check routing to separate preparation responsibility.",
      },
      {
        title: "Keep service progressing",
        description:
          "Move tickets through appropriate preparation and release states rather than relying only on verbal updates.",
      },
    ],
    steps: [
      {
        title: "Prepare the outlet",
        description:
          "Kitchen Pro is enabled only after entitlement, station, staffing and readiness checks.",
      },
      {
        title: "Route a ticket",
        description: "Incoming accepted orders appear in the appropriate kitchen workflow.",
      },
      {
        title: "Prepare and release",
        description: "Staff update ticket progress as dishes move toward final check and service.",
      },
    ],
    faqs: [
      {
        question: "Can every account use Kitchen Pro?",
        answer:
          "Yes. Subscribe from your billing page, then set up stations and assign staff. Tickets start routing once your outlet is ready.",
      },
      {
        question: "Does it support multiple stations?",
        answer:
          "Supported kitchen workflows can route tickets between configured preparation stations and a final-check stage.",
      },
      {
        question: "Is Kitchen Pro part of the free QR menu?",
        answer:
          "No. Kitchen Pro is a paid plan at ₹499 a month, and it includes everything in Ordering.",
      },
    ],
    guideHref: "/docs/kitchen",
    guideLabel: "Read the Kitchen Pro guide",
  },
  {
    slug: "restaurant-pos",
    heroArtwork: {
      desktopLight: "/brand/qr-studio/tabletop-press/hero-desktop-light.webp",
      desktopDark: "/brand/qr-studio/tabletop-press/hero-desktop-dark.webp",
      mobileLight: "/brand/qr-studio/tabletop-press/hero-mobile-light.webp",
      mobileDark: "/brand/qr-studio/tabletop-press/hero-mobile-dark.webp",
      label: "Point of Sale • Shared Tabletop Editorial Artwork",
      alt: "Tabletop editorial hero artwork also used on the MenuMinute POS page",
    },
    editorial: {
      eyebrow: "From the counter to the register",
      title: "Counter work deserves clear records",
      situation:
        "A cashier may need to record menu items, mark a payment received and reprint a receipt. Those tasks should be understandable even when no online payment provider is connected.",
      approach:
        "MenuMinute’s controlled POS workspace includes supported order-entry, recording and document workflows. Staff-recorded payment status is a manual record, not a card charge or bank settlement.",
      outcome:
        "A documented cashier journey helps operators distinguish order records from regulated payments, tax calculations and fiscal invoicing. Access depends on outlet readiness.",
      actionLabel: "Read the POS capabilities guide",
      actionHref: "/docs/point-of-sale",
      checklist: [
        "Understand manual payment state versus payment collection",
        "Review order and receipt workflows",
        "Check fiscal and settlement readiness before rollout",
      ],
    },
    path: "/features/restaurant-pos",
    title: "Restaurant Point of Sale",
    eyebrow: "CASHIER WORKFLOWS / CONTROLLED ACCESS",
    headline: "A clearer counter, from order to receipt.",
    description:
      "Explore MenuMinute's cashier workspace, recorded sales and receipt workflows. Available operations depend on enabled outlet capabilities; recording payment is not automatic payment capture.",
    seoTitle: "Restaurant Point of Sale and Cashier Workflows",
    seoDescription:
      "Explore MenuMinute restaurant POS order entry, receipts, recorded payments and order history, with clear payment-processing limitations.",
    availability: "limited",
    availabilityText:
      "POS and fiscal capabilities have separate activation and jurisdictional readiness requirements. Do not assume payment processing or compliant tax invoicing is enabled.",
    cta: "Ask about POS workflows",
    ctaHref: "/contact",
    secondaryCta: "Read the POS guide",
    secondaryHref: "/docs/point-of-sale",
    highlights: [
      "Cashier order entry",
      "Order and sale records",
      "Receipt and reprint workflows",
      "Manual payment-status recording",
    ],
    benefits: [
      {
        title: "Keep counter service organized",
        description:
          "Build cashier orders with menu items and supported order operations from the authorized workspace.",
      },
      {
        title: "Find previous transactions",
        description:
          "Use the register and ledger views to review recorded sales, receipts and supported follow-up actions.",
      },
      {
        title: "Know what a paid status means",
        description:
          "Manual Mark as Paid records an operator action. It does not itself collect money or verify a payment provider settlement.",
      },
    ],
    steps: [
      {
        title: "Confirm outlet capabilities",
        description:
          "Check the outlet's available POS permissions and its configured operating mode.",
      },
      {
        title: "Record the order",
        description: "Use supported cashier actions to add items and manage the ticket.",
      },
      {
        title: "Review and reprint",
        description: "Where enabled, access recorded documents and reprint available receipts.",
      },
    ],
    faqs: [
      {
        question: "Does MenuMinute process card payments by default?",
        answer:
          "No. Recording a payment status and capturing a payment through a processor are different operations.",
      },
      {
        question: "Can operators record a payment manually?",
        answer:
          "Supported workflows include manual payment-state recording; this is a staff record and does not confirm bank settlement.",
      },
      {
        question: "Can it issue legally compliant invoices everywhere?",
        answer:
          "No universal fiscal compliance is claimed. Tax, invoicing and settlement capabilities require separate jurisdictional and operator approval.",
      },
    ],
    guideHref: "/docs/point-of-sale",
    guideLabel: "Read the POS guide",
  },
  {
    slug: "ai-menu-import",
    heroArtwork: {
      desktopLight: "/brand/menu-studio/recipe-atelier/hero-desktop-light.webp",
      desktopDark: "/brand/menu-studio/recipe-atelier/hero-desktop-dark.webp",
      mobileLight: "/brand/menu-studio/recipe-atelier/hero-mobile-light.webp",
      mobileDark: "/brand/menu-studio/recipe-atelier/hero-mobile-dark.webp",
      label: "Menu Studio • Recipe Atelier",
      alt: "Recipe Atelier artwork from the Menu Studio workspace used alongside AI import",
    },
    editorial: {
      eyebrow: "A photograph can be a starting point—not the final menu",
      title: "Read first, review always",
      situation:
        "Typing a long printed menu can be repetitive. AI-assisted extraction may help prepare candidates, but printed prices, headings and images can be misread.",
      approach:
        "Where a supported provider is configured and the feature is approved, upload a clear image, review the extracted candidates beside the original, correct each important detail and apply the approved changes to Menu Studio.",
      outcome:
        "Restaurant staff remain responsible for accuracy. No AI-generated price or dish should silently publish to the guest menu.",
      actionLabel: "Read the import review guide",
      actionHref: "/docs/menu-import",
      checklist: [
        "Capture a legible menu image",
        "Correct extracted dish names and prices",
        "Approve changes before applying or publishing",
      ],
    },
    path: "/features/ai-menu-import",
    title: "AI Menu Import",
    eyebrow: "SMART MENU IMPORT / PROVIDER-GATED",
    headline: "Turn a photographed menu into an editable starting point.",
    description:
      "Capture a printed menu, review AI-extracted suggestions and correct details before applying them. Keep a human in control of your published dishes and prices.",
    seoTitle: "AI Restaurant Menu Import from Photos",
    seoDescription:
      "Explore MenuMinute's photo-to-digital menu import workflow: capture a menu, review extracted dishes and prices and approve changes.",
    availability: "provider",
    availabilityText:
      "AI photo extraction is optional and needs a configured, supported provider and explicit approval. It is not always available on the free QR menu plan.",
    image: "menu-import",
    imageAlt: "MenuMinute menu import review workspace",
    screenshotCaption: "Menu Import · Actual MenuMinute interface",
    cta: "Explore import availability",
    ctaHref: "/contact",
    secondaryCta: "View the import guide",
    secondaryHref: "/docs/menu-import",
    highlights: [
      "Photograph or upload a menu",
      "Review extracted item suggestions",
      "Correct names and prices",
      "Approve changes before applying",
    ],
    benefits: [
      {
        title: "Get an editable starting point",
        description:
          "Where enabled, AI-assisted extraction can propose a structured menu from an image instead of requiring every item to be typed manually.",
      },
      {
        title: "Keep mistakes out of the live menu",
        description:
          "Review candidate dishes and prices against the original before you apply any changes.",
      },
      {
        title: "Preserve owner control",
        description:
          "The import workflow supports human corrections and approval; extraction is not automatic publication.",
      },
    ],
    steps: [
      {
        title: "Capture the source",
        description: "Upload a readable image or follow the capture guidance in your workspace.",
      },
      {
        title: "Review the suggestions",
        description:
          "Check dish names, descriptions and prices carefully. Fix anything the AI misunderstood.",
      },
      {
        title: "Apply approved content",
        description: "Accept reviewed changes into Menu Studio and publish when you are ready.",
      },
    ],
    faqs: [
      {
        question: "Is photo-to-menu import included in the free plan?",
        answer:
          "Not automatically. It needs a supported, configured AI provider and separate approval.",
      },
      {
        question: "Does an uploaded menu immediately change my live menu?",
        answer: "No. You review and correct the extracted candidates before applying changes.",
      },
      {
        question: "Will the AI always read every price correctly?",
        answer:
          "No. Images and printed menus vary, so the owner should confirm every item and price before applying changes.",
      },
    ],
    guideHref: "/docs/menu-import",
    guideLabel: "Read the import guide",
  },
];

export function marketingFeatureBySlug(slug: string): MarketingFeature | undefined {
  return marketingFeatures.find((feature) => feature.slug === slug);
}
