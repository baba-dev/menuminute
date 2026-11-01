/**
 * Public, non-personalized industry examples. These are illustrative workflows,
 * not customer case studies or evidence of measured business results.
 */
export type IndustrySolution = {
  slug: string;
  title: string;
  audience: string;
  eyebrow: string;
  headline: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
  cover: string;
  coverAlt: string;
  artBase: string;
  artCaption: string;
  primaryShot: string;
  primaryShotAlt: string;
  secondaryShot: string;
  secondaryShotAlt: string;
  scenario: {
    title: string;
    intro: string;
    stages: { time: string; title: string; detail: string }[];
  };
  needs: { title: string; detail: string; featurePath: string; featureLabel: string }[];
  steps: { title: string; detail: string }[];
  facts: string[];
  premiumNote: string;
  faqs: { question: string; answer: string }[];
};

export const industrySolutions: readonly IndustrySolution[] = [
  {
    slug: "restaurants",
    title: "Restaurants",
    audience: "Full-service restaurants and casual dining",
    eyebrow: "For restaurants / table service",
    headline: "Make every table feel looked after.",
    intro:
      "From the first scan to the last course, MenuMinute helps you present a clear menu, keep dish availability up to date and explore connected table-service workflows.",
    seoTitle: "QR Code Menus for Restaurants | MenuMinute",
    seoDescription:
      "Create a free restaurant QR code menu with categories, prices and instant published updates. Explore table ordering and kitchen workflows for eligible restaurants.",
    cover: "/assets/public-menu/covers/indian-restaurant.webp",
    coverAlt: "Illustrative Indian restaurant food served at a table",
    artBase: "/brand/qr-studio/tabletop-press",
    artCaption: "QR Studio — artwork from the real MenuMinute restaurant workspace",
    primaryShot: "public-menu",
    primaryShotAlt: "MenuMinute published guest menu as diners would browse it",
    secondaryShot: "qr-studio",
    secondaryShotAlt: "MenuMinute QR Studio showing permanent restaurant QR codes",
    scenario: {
      title: "One table. A changing dinner service.",
      intro:
        "Illustrative example: a neighborhood restaurant revises specials while guests are already seated.",
      stages: [
        {
          time: "Before the doors open",
          title: "Prepare the menu",
          detail:
            "Publish clear starters, mains, drinks and desserts, including any verified dietary information and current prices.",
        },
        {
          time: "During the rush",
          title: "Update availability",
          detail:
            "Mark an item sold out through the supported availability controls, so guests do not keep choosing a dish you cannot serve.",
        },
        {
          time: "At the table",
          title: "Keep the guest informed",
          detail:
            "Guests scan a permanent QR code and browse the live menu. Approved outlets can separately enable order requests and tracking.",
        },
      ],
    },
    needs: [
      {
        title: "Menu that stays current",
        detail:
          "Edit descriptions, categories, prices and supported variants in Menu Studio, then publish the reviewed changes.",
        featurePath: "/features/digital-menu-builder",
        featureLabel: "Explore Menu Studio",
      },
      {
        title: "QR codes for each table",
        detail:
          "Create lasting codes and design table-ready print materials without replacing the code whenever a dish changes.",
        featurePath: "/free-qr-menu",
        featureLabel: "See free QR menus",
      },
      {
        title: "More controlled service",
        detail:
          "Where approved, receive dine-in requests through a separate ordering workflow, then coordinate staff acceptance and preparation.",
        featurePath: "/ordering",
        featureLabel: "Explore ordering access",
      },
    ],
    steps: [
      {
        title: "Set up your dining outlet",
        detail: "Create an account, name your restaurant and add the categories guests expect.",
      },
      {
        title: "Publish a guest-friendly menu",
        detail:
          "Verify descriptions, prices and allergen declarations. Open the live menu on a phone before printing.",
      },
      {
        title: "Print your codes",
        detail:
          "Download the QR artwork and place it on tables, menus or counter displays. Ask about gated service tools only if you need them.",
      },
    ],
    facts: [
      "Guest menus open in a browser without a download",
      "Permanent QR codes point to the published menu",
      "Ordering and Kitchen Pro require separate activation",
    ],
    premiumNote:
      "Free QR menus do not automatically include live order acceptance, online payments or Kitchen Pro. Those capabilities depend on approval and outlet setup.",
    faqs: [
      {
        question: "Can I replace printed menus for my restaurant?",
        answer:
          "You can publish a mobile-friendly QR menu and provide the code on each table. You can still offer printed alternatives if guests prefer them.",
      },
      {
        question: "What happens when a dish sells out?",
        answer:
          "You can use supported dish-availability controls to reflect an unavailable item. Review the public guest view after changing the status.",
      },
      {
        question: "Can guests order from their table?",
        answer:
          "Only if the outlet has the separate online-ordering capability enabled. The free QR menu by itself is for browsing.",
      },
    ],
  },
  {
    slug: "cafes",
    title: "Cafés",
    audience: "Coffee shops, tea rooms and small cafés",
    eyebrow: "For cafés / daily menus",
    headline: "Give the morning rush a smoother start.",
    intro:
      "Show the flat white, the iced drinks, the pastries and today's specials in a menu that is easy to scan, edit and share from the counter.",
    seoTitle: "Digital QR Menus for Cafés & Coffee Shops | MenuMinute",
    seoDescription:
      "Build a free café QR menu for coffee, tea, pastries, sizes and optional add-ons. Update daily specials and let guests browse on their phones.",
    cover: "/assets/public-menu/covers/cafe-coffee.webp",
    coverAlt: "Illustrative café coffee and pastry display",
    artBase: "/brand/menu-studio/recipe-atelier",
    artCaption: "Menu Studio — artwork used by MenuMinute's Recipe Atelier",
    primaryShot: "menu-studio",
    primaryShotAlt: "MenuMinute Menu Studio editing dishes and categories",
    secondaryShot: "public-menu",
    secondaryShotAlt: "Example customer-facing menu on a mobile-friendly webpage",
    scenario: {
      title: "The same counter. A different menu by noon.",
      intro:
        "Illustrative example: a café starts with breakfast pastries and switches attention to cold drinks later.",
      stages: [
        {
          time: "Opening shift",
          title: "Show the morning range",
          detail:
            "Arrange espresso, tea, cold coffee and bakery items into recognizable groups. Add sizes or supported add-on choices where configured.",
        },
        {
          time: "Mid-morning",
          title: "Adjust what is available",
          detail:
            "If a limited pastry sells out, update its availability rather than leaving guests with an out-of-date counter menu.",
        },
        {
          time: "After lunch",
          title: "Highlight the next special",
          detail:
            "Update seasonal drinks and descriptions in the editor, review the draft and publish the approved menu.",
        },
      ],
    },
    needs: [
      {
        title: "Sizes, choices and descriptions",
        detail:
          "Use supported dish variants and add-on groups for menu options, with owner-confirmed details and prices.",
        featurePath: "/features/digital-menu-builder",
        featureLabel: "Explore menu editing",
      },
      {
        title: "One shareable counter code",
        detail:
          "A permanent QR code links visitors to the menu without asking them to install an application.",
        featurePath: "/free-qr-menu",
        featureLabel: "Design a free QR menu",
      },
      {
        title: "A simple digital first impression",
        detail:
          "A responsive guest menu presents all-day drinks, bakery items and any published specials in one place.",
        featurePath: "/features/digital-menu-builder",
        featureLabel: "See the digital menu builder",
      },
    ],
    steps: [
      {
        title: "Build your drinks sections",
        detail:
          "Start with hot coffee, iced drinks, teas and food. Use plain names and clear pricing.",
      },
      {
        title: "Add optional choices",
        detail:
          "Where supported, set size variants or add-ons, then check the choices in the guest preview.",
      },
      {
        title: "Put QR artwork on the counter",
        detail: "Keep your printed sign in place while you update the published menu behind it.",
      },
    ],
    facts: [
      "Separate hot and iced drink categories",
      "Supported variants help describe sizes and choices",
      "Public QR menu browsing does not require customer sign-in",
    ],
    premiumNote:
      "A published café menu is not automatically a checkout or payment system. Ordering, payment and other premium tools remain separately configured and gated.",
    faqs: [
      {
        question: "Can I list different drink sizes?",
        answer:
          "Menu Studio supports dish variants, such as Small and Large, and supported add-on groups. Confirm the prices before publishing.",
      },
      {
        question: "Can I update specials in the afternoon?",
        answer:
          "Yes. Edit the menu, review the changes and publish the updated guest view without changing your permanent QR code.",
      },
      {
        question: "Does the café QR menu take payments?",
        answer:
          "Not by itself. QR menu browsing is separate from activated ordering and any payment processing integration.",
      },
    ],
  },
  {
    slug: "bakeries",
    title: "Bakeries",
    audience: "Bakeries, patisseries and dessert counters",
    eyebrow: "For bakeries / changing displays",
    headline: "Fresh from the oven. Clear on the menu.",
    intro:
      "Make it easy to discover today's bread, cakes, pastries and treats, even when the display changes faster than the printed price list.",
    seoTitle: "QR Code Menus for Bakeries & Cake Shops | MenuMinute",
    seoDescription:
      "Create a free digital bakery menu for breads, cakes, pastries, seasonal selections and sold-out items. Publish updates without replacing your QR code.",
    cover: "/assets/public-menu/covers/artisan-bakery.webp",
    coverAlt: "Illustrative artisan bakery bread and baked goods",
    artBase: "/brand/qr-studio/tabletop-press",
    artCaption: "Tabletop Press — printed QR artwork from the real QR Studio",
    primaryShot: "qr-studio",
    primaryShotAlt: "MenuMinute QR Studio ready to create bakery counter codes",
    secondaryShot: "menu-studio",
    secondaryShotAlt: "MenuMinute menu editor with dish details and prices",
    scenario: {
      title: "The display case changes. The code stays.",
      intro:
        "Illustrative example: an artisan bakery starts with croissants, sells out of one item and adds an afternoon batch.",
      stages: [
        {
          time: "Morning bake",
          title: "Publish the fresh selection",
          detail:
            "Group bread, pastries, cakes and savoury bakes so guests can see what is offered today.",
        },
        {
          time: "After the first rush",
          title: "Mark sell-outs clearly",
          detail:
            "Use the available sold-out controls for items that have run out, instead of promising stock you do not have.",
        },
        {
          time: "The next batch",
          title: "Refresh the details",
          detail:
            "Edit the menu and publish verified prices or seasonal descriptions. The permanent counter QR still leads to your menu.",
        },
      ],
    },
    needs: [
      {
        title: "An organized pastry display",
        detail:
          "Make simple categories for bread, slices, whole cakes and drinks, with optional photos and short descriptions.",
        featurePath: "/features/digital-menu-builder",
        featureLabel: "See menu categories",
      },
      {
        title: "Current availability information",
        detail: "Reflect sold-out dishes without deleting them from your menu library.",
        featurePath: "/features/digital-menu-builder",
        featureLabel: "Explore availability controls",
      },
      {
        title: "Counter and packaging QR codes",
        detail: "Generate codes that customers can scan at the display or from a takeaway bag.",
        featurePath: "/free-qr-menu",
        featureLabel: "Explore QR Studio",
      },
    ],
    steps: [
      {
        title: "Add bakery categories",
        detail:
          "Enter products and prices, including optional seasonal items and supported variants.",
      },
      {
        title: "Check product details",
        detail:
          "Verify ingredient and allergen information from actual recipes before publishing any dietary claims.",
      },
      {
        title: "Share the live selection",
        detail:
          "Display the permanent QR code and keep the published menu current as stock changes.",
      },
    ],
    facts: [
      "Categories make seasonal products easier to browse",
      "Sold-out settings help avoid outdated listings",
      "Allergen claims must be supplied and verified by the bakery",
    ],
    premiumNote:
      "MenuMinute's free QR menu is not inventory management, a stock reservation system or an automatic preorder promise. Separately activated service features have additional requirements.",
    faqs: [
      {
        question: "Can I hide sold-out pastries?",
        answer:
          "Supported availability controls let you show when an item is sold out. MenuMinute does not infer stock levels from your oven or cash register.",
      },
      {
        question: "Can I show photos of cakes?",
        answer:
          "Yes. Menu Studio can display approved product images, where provided, alongside menu descriptions and prices.",
      },
      {
        question: "Does the free menu support advance cake orders?",
        answer:
          "Do not assume so. The free plan provides public menu browsing; order acceptance and any scheduling require a separately supported, activated workflow.",
      },
    ],
  },
  {
    slug: "cloud-kitchens",
    title: "Cloud Kitchens",
    audience: "Delivery-first and pickup-first kitchens",
    eyebrow: "For cloud kitchens / pickup operations",
    headline: "Put your menu first. Keep handoffs clear.",
    intro:
      "Publish a mobile-friendly menu for your delivery-first brand today, and explore controlled order acceptance and preparation stations when your outlet is eligible.",
    seoTitle: "Digital QR Menus for Cloud Kitchens | MenuMinute",
    seoDescription:
      "Build a free digital menu for cloud kitchens and delivery-first brands. Explore pickup requests, order queues and Kitchen Pro for eligible outlets.",
    cover: "/assets/public-menu/covers/street-food-cloud-kitchen.webp",
    coverAlt: "Illustrative takeaway meals prepared by a cloud kitchen",
    artBase: "/brand/orders/service-counter",
    artCaption: "Service Counter — editorial artwork from MenuMinute Orders",
    primaryShot: "orders",
    primaryShotAlt: "MenuMinute Orders dashboard showing restaurant tickets and states",
    secondaryShot: "kitchen",
    secondaryShotAlt: "MenuMinute Kitchen Pro with station-specific tickets",
    scenario: {
      title: "From an online menu to a reliable handoff.",
      intro:
        "Illustrative example: a pickup-first kitchen offers a short menu and receives orders during a busy evening.",
      stages: [
        {
          time: "Before service",
          title: "Publish the right options",
          detail:
            "Keep a clear menu with prices, portions, spicy options and supported add-ons. Confirm packaging-friendly descriptions.",
        },
        {
          time: "When an order arrives",
          title: "Accept deliberately",
          detail:
            "With ordering separately approved, staff review an incoming pickup request rather than treating submission as instant acceptance.",
        },
        {
          time: "At preparation and handoff",
          title: "Coordinate the team",
          detail:
            "Where Kitchen Pro is activated, assigned stations can prepare and release items. Guest tracking reflects the order's progress.",
        },
      ],
    },
    needs: [
      {
        title: "A menu your guests can browse",
        detail:
          "Create one published menu for the brand and update dishes, variants and prices as the offering changes.",
        featurePath: "/free-qr-menu",
        featureLabel: "Start with a free menu",
      },
      {
        title: "A controlled pickup request flow",
        detail:
          "Eligible outlets can let guests submit pickup requests and have staff accept or decline them in the Orders workflow.",
        featurePath: "/ordering",
        featureLabel: "Understand online ordering",
      },
      {
        title: "Tickets by kitchen station",
        detail:
          "Where separately enabled, Kitchen Pro shows tickets at assigned stations and supports final checks before release.",
        featurePath: "/features/kitchen-display-system",
        featureLabel: "See Kitchen Pro",
      },
    ],
    steps: [
      {
        title: "Launch the public menu",
        detail:
          "Organize the cloud kitchen's dishes, prices and supported choices, then verify the published customer view.",
      },
      {
        title: "Share your menu link",
        detail:
          "Use the permanent QR or browser link on your own permitted touchpoints. The free menu does not handle marketplace integrations.",
      },
      {
        title: "Request advanced operations",
        detail:
          "Contact the team about approval for pickup ordering and station-based kitchen coordination.",
      },
    ],
    facts: [
      "Free QR menu publishing is the starting point",
      "Pickup order acceptance requires explicit outlet activation",
      "Kitchen station routing and release require approved Kitchen Pro setup",
    ],
    premiumNote:
      "This is not an automatic integration with food delivery marketplaces, a payment gateway or third-party couriers. Ordering and Kitchen Pro must be activated and configured separately.",
    faqs: [
      {
        question: "Can I create a cloud kitchen menu without a dining room?",
        answer:
          "Yes. The public digital menu can present a delivery-first or pickup-first brand; physical dining tables are not required just to publish it.",
      },
      {
        question: "Can my team accept pickup requests?",
        answer:
          "Only when the outlet has separately approved online-ordering access. Guest submission alone does not mean an order is accepted.",
      },
      {
        question: "Does MenuMinute connect automatically to delivery platforms?",
        answer:
          "No marketplace integration is promised on this page. MenuMinute's own menu, ordering and kitchen workflows have distinct availability.",
      },
    ],
  },
];

export function industrySolutionBySlug(slug: string): IndustrySolution | undefined {
  return industrySolutions.find((entry) => entry.slug === slug);
}
