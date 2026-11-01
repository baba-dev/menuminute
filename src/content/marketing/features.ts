export type MarketingFeature = {
  slug: string;
  path: string;
  title: string;
  eyebrow: string;
  headline: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  availability: "free" | "limited" | "provider";
  availabilityText: string;
  image?: string;
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
    path: "/free-qr-menu",
    title: "Free QR Menu",
    eyebrow: "FREE FOREVER / DIGITAL MENUS",
    headline: "A beautiful restaurant QR menu. Free forever.",
    description: "Build your restaurant's menu, publish it online and share a permanent QR code. Guests browse dishes on their phones without an app download or an account.",
    seoTitle: "Free QR Menu Maker for Restaurants",
    seoDescription: "Create a free restaurant QR code menu. Add dishes, categories and prices, publish a mobile-friendly menu and download permanent QR codes.",
    availability: "free",
    availabilityText: "The core QR menu is free permanently. Premium ordering and kitchen features are separate.",
    image: "qr-studio",
    imageAlt: "MenuMinute QR Studio showing restaurant QR code controls",
    screenshotCaption: "QR Studio · Actual MenuMinute interface",
    cta: "Create my free menu",
    ctaHref: "/register",
    secondaryCta: "Scan the sample menu",
    secondaryHref: "/demo",
    highlights: ["Free QR menu publishing", "Permanent downloadable QR codes", "No diner app or login", "Update dishes without changing the code"],
    benefits: [
      { title: "Publish once, update anytime", description: "Change descriptions, prices and availability in Menu Studio. Your existing QR code continues pointing to the same published menu." },
      { title: "Bring your own restaurant identity", description: "Organize dishes into categories and add variants, descriptions and images where available. Give guests a familiar menu instead of an unstructured PDF." },
      { title: "Easy to print and share", description: "Download your QR code in supported formats or print it for tables and counters. Test the customer view before sharing." }
    ],
    steps: [
      { title: "Create your restaurant", description: "Register and set up your first outlet. You can complete optional details later." },
      { title: "Add your dishes", description: "Organize your menu with categories, prices, descriptions and optional imagery." },
      { title: "Publish and display", description: "Publish your menu and download its permanent QR code for your tables, packaging or counter." }
    ],
    faqs: [
      { question: "Is the QR menu really free?", answer: "Yes. MenuMinute's core QR menu plan is free permanently. Ordering, Kitchen Pro and optional AI tools have different eligibility and access conditions." },
      { question: "Will the QR code change when I update prices?", answer: "No. A permanent QR code points to your published menu. You can update the menu content without reprinting the code." },
      { question: "Must customers install an app?", answer: "No. Guests can scan the QR code with their phone camera and view the published menu in a browser." }
    ],
    guideHref: "/docs/qr-studio",
    guideLabel: "See the QR Studio guide"
  },
  {
    slug: "digital-menu-builder",
    path: "/features/digital-menu-builder",
    title: "Digital Menu Builder",
    eyebrow: "MENU STUDIO / RESTAURANT CONTENT",
    headline: "Make every dish easy to discover.",
    description: "Arrange categories, dishes, variants and prices in one menu workspace. Keep your live restaurant menu current without redesigning printed pages.",
    seoTitle: "Digital Restaurant Menu Builder",
    seoDescription: "Build and manage a mobile-friendly digital restaurant menu with MenuMinute. Add dishes, categories, variants, prices and sold-out information.",
    availability: "free",
    availabilityText: "Core digital menu editing and publishing are included in the free QR menu plan. Some enhancements are separately enabled.",
    image: "menu-studio",
    imageAlt: "MenuMinute Menu Studio editing categories and dishes",
    screenshotCaption: "Menu Studio · Actual MenuMinute interface",
    cta: "Build a free menu",
    ctaHref: "/register",
    secondaryCta: "See a sample menu",
    secondaryHref: "/demo",
    highlights: ["Categories and dishes", "Variants and pricing", "Availability controls", "Mobile guest presentation"],
    benefits: [
      { title: "Structure your food clearly", description: "Group menu items into sensible categories and give each dish a name, description and price so customers find what they want." },
      { title: "Handle choices and sold-out items", description: "Configure supported variants and availability controls instead of leaving guests guessing when a dish is unavailable." },
      { title: "Separate editing from publication", description: "Work on your restaurant menu from the dashboard and check the public menu presentation before sharing it." }
    ],
    steps: [
      { title: "Organize categories", description: "Start with the groups your guests expect: starters, mains, drinks, desserts or your own sections." },
      { title: "Add dish details", description: "Enter prices, descriptions and supported variants. Add photos if you have them." },
      { title: "Publish your menu", description: "Open your public menu and share its QR code from the QR Studio." }
    ],
    faqs: [
      { question: "Can I change menu prices later?", answer: "Yes. Edit menu content from Menu Studio and publish changes without making a new QR code." },
      { question: "Can I mark a dish as unavailable?", answer: "Yes. Supported sold-out controls allow you to reflect availability in the menu." },
      { question: "Does the menu work on a phone?", answer: "Yes. Published guest menus are designed to be viewed in a phone browser without customer registration." }
    ],
    guideHref: "/docs/menu-studio",
    guideLabel: "Explore the Menu Studio guide"
  },
  {
    slug: "online-ordering",
    path: "/ordering",
    title: "Restaurant Online Ordering",
    eyebrow: "LIVE ORDERING / LIMITED ROLLOUT",
    headline: "From a quick scan to an organized order.",
    description: "Let eligible restaurant guests browse and submit dine-in or pickup requests from a published menu. Staff review and accept orders while guests follow their status.",
    seoTitle: "Restaurant Online Ordering and Table QR Orders",
    seoDescription: "Explore MenuMinute dine-in QR ordering, pickup requests and guest order tracking. Ordering requires eligible outlet activation.",
    availability: "limited",
    availabilityText: "Ordering is in limited rollout. An eligible outlet must be approved and activated; registering does not automatically switch on orders.",
    image: "orders",
    imageAlt: "MenuMinute orders workspace for restaurant staff",
    screenshotCaption: "Orders · Actual MenuMinute interface",
    cta: "Ask about ordering access",
    ctaHref: "/contact",
    secondaryCta: "Explore the demo",
    secondaryHref: "/demo",
    highlights: ["Dine-in and pickup requests", "Staff order acceptance", "Guest order tracking", "Outlet eligibility controls"],
    benefits: [
      { title: "Keep guests informed", description: "When ordering is enabled, guests can submit a request and follow an order tracking page. Submission is not the same as restaurant acceptance." },
      { title: "Put your staff in control", description: "Restaurant operators review requests and manage acceptance through authorized workflows." },
      { title: "Use accurate prices", description: "Order prices are calculated server-side using the outlet's configured menu rather than relying on a guest's browser totals." }
    ],
    steps: [
      { title: "Activate an eligible outlet", description: "Ordering requires the appropriate entitlement and approval before it becomes available to guests." },
      { title: "Guest submits an order", description: "A guest chooses supported menu items and submits a dine-in or pickup request." },
      { title: "Restaurant confirms and prepares", description: "Staff accept or decline the request and the guest can follow status updates." }
    ],
    faqs: [
      { question: "Is online ordering available as soon as I sign up?", answer: "No. Ordering is feature-gated and needs an approved, activated outlet." },
      { question: "Does placing an order mean the restaurant accepted it?", answer: "No. A guest submission is a request until the restaurant accepts it." },
      { question: "Does this automatically charge the customer's card?", answer: "No. Payment availability is separate. A staff-recorded paid status is not proof of an online payment provider charge." }
    ],
    guideHref: "/docs/orders",
    guideLabel: "Read the orders guide"
  },
  {
    slug: "kitchen-display-system",
    path: "/features/kitchen-display-system",
    title: "Kitchen Display System",
    eyebrow: "KITCHEN PRO / LIMITED ROLLOUT",
    headline: "A calmer view of a busy kitchen.",
    description: "See incoming tickets and coordinate preparation across configured stations. Kitchen Pro provides a dedicated restaurant kitchen workflow when the outlet and devices are approved.",
    seoTitle: "Kitchen Display System (KDS) for Restaurants",
    seoDescription: "Explore Kitchen Pro, MenuMinute's restaurant kitchen display with order tickets and station routing. Available to approved outlets.",
    availability: "limited",
    availabilityText: "Kitchen Pro requires approved operator activation, assigned staff and readiness checks. The public demo does not grant production KDS access.",
    image: "kitchen",
    imageAlt: "MenuMinute kitchen display with incoming kitchen tickets",
    screenshotCaption: "Kitchen Pro · Actual MenuMinute interface",
    cta: "Ask about Kitchen Pro",
    ctaHref: "/contact",
    secondaryCta: "View kitchen documentation",
    secondaryHref: "/docs/kitchen",
    highlights: ["Station-specific tickets", "Preparation stages", "Incoming ticket alerts", "Kitchen device workflows"],
    benefits: [
      { title: "Make the next task visible", description: "Give authorized kitchen staff a shared, readable view of orders that need preparation." },
      { title: "Coordinate stations", description: "Use configured kitchen, bar and final-check routing to separate preparation responsibility." },
      { title: "Keep service progressing", description: "Move tickets through appropriate preparation and release states rather than relying only on verbal updates." }
    ],
    steps: [
      { title: "Prepare the outlet", description: "Kitchen Pro is enabled only after entitlement, station, staffing and readiness checks." },
      { title: "Route a ticket", description: "Incoming accepted orders appear in the appropriate kitchen workflow." },
      { title: "Prepare and release", description: "Staff update ticket progress as dishes move toward final check and service." }
    ],
    faqs: [
      { question: "Can every account enable Kitchen Pro?", answer: "Not immediately. Kitchen Pro is limited to eligible outlets with approved activation and configured staff." },
      { question: "Does it support multiple stations?", answer: "Supported kitchen workflows can route tickets between configured preparation stations and a final-check stage." },
      { question: "Is Kitchen Pro part of the free QR menu?", answer: "No. Kitchen Pro is a separate premium capability with its own rollout and access requirements." }
    ],
    guideHref: "/docs/kitchen",
    guideLabel: "Read the Kitchen Pro guide"
  },
  {
    slug: "restaurant-pos",
    path: "/features/restaurant-pos",
    title: "Restaurant Point of Sale",
    eyebrow: "CASHIER WORKFLOWS / CONTROLLED ACCESS",
    headline: "A clearer counter, from order to receipt.",
    description: "Explore MenuMinute's cashier workspace, recorded sales and receipt workflows. Available operations depend on enabled outlet capabilities; recording payment is not automatic payment capture.",
    seoTitle: "Restaurant Point of Sale and Cashier Workflows",
    seoDescription: "Explore MenuMinute restaurant POS order entry, receipts, recorded payments and order history, with clear payment-processing limitations.",
    availability: "limited",
    availabilityText: "POS and fiscal capabilities have separate activation and jurisdictional readiness requirements. Do not assume payment processing or compliant tax invoicing is enabled.",
    cta: "Ask about POS workflows",
    ctaHref: "/contact",
    secondaryCta: "Read the POS guide",
    secondaryHref: "/docs/point-of-sale",
    highlights: ["Cashier order entry", "Order and sale records", "Receipt and reprint workflows", "Manual payment-status recording"],
    benefits: [
      { title: "Keep counter service organized", description: "Build cashier orders with menu items and supported order operations from the authorized workspace." },
      { title: "Find previous transactions", description: "Use the register and ledger views to review recorded sales, receipts and supported follow-up actions." },
      { title: "Know what a paid status means", description: "Manual Mark as Paid records an operator action. It does not itself collect money or verify a payment provider settlement." }
    ],
    steps: [
      { title: "Confirm outlet capabilities", description: "Check the outlet's available POS permissions and its configured operating mode." },
      { title: "Record the order", description: "Use supported cashier actions to add items and manage the ticket." },
      { title: "Review and reprint", description: "Where enabled, access recorded documents and reprint available receipts." }
    ],
    faqs: [
      { question: "Does MenuMinute process card payments by default?", answer: "No. Recording a payment status and capturing a payment through a processor are different operations." },
      { question: "Can operators record a payment manually?", answer: "Supported workflows include manual payment-state recording; this is a staff record and does not confirm bank settlement." },
      { question: "Can it issue legally compliant invoices everywhere?", answer: "No universal fiscal compliance is claimed. Tax, invoicing and settlement capabilities require separate jurisdictional and operator approval." }
    ],
    guideHref: "/docs/point-of-sale",
    guideLabel: "Read the POS guide"
  },
  {
    slug: "ai-menu-import",
    path: "/features/ai-menu-import",
    title: "AI Menu Import",
    eyebrow: "SMART MENU IMPORT / PROVIDER-GATED",
    headline: "Turn a photographed menu into an editable starting point.",
    description: "Capture a printed menu, review AI-extracted suggestions and correct details before applying them. Keep a human in control of your published dishes and prices.",
    seoTitle: "AI Restaurant Menu Import from Photos",
    seoDescription: "Explore MenuMinute's photo-to-digital menu import workflow: capture a menu, review extracted dishes and prices and approve changes.",
    availability: "provider",
    availabilityText: "AI photo extraction is optional and needs a configured, supported provider and explicit approval. It is not always available on the free QR menu plan.",
    image: "menu-import",
    imageAlt: "MenuMinute menu import review workspace",
    screenshotCaption: "Menu Import · Actual MenuMinute interface",
    cta: "Explore import availability",
    ctaHref: "/contact",
    secondaryCta: "View the import guide",
    secondaryHref: "/docs/menu-import",
    highlights: ["Photograph or upload a menu", "Review extracted item suggestions", "Correct names and prices", "Approve changes before applying"],
    benefits: [
      { title: "Get an editable starting point", description: "Where enabled, AI-assisted extraction can propose a structured menu from an image instead of requiring every item to be typed manually." },
      { title: "Keep mistakes out of the live menu", description: "Review candidate dishes and prices against the original before you apply any changes." },
      { title: "Preserve owner control", description: "The import workflow supports human corrections and approval; extraction is not automatic publication." }
    ],
    steps: [
      { title: "Capture the source", description: "Upload a readable image or follow the capture guidance in your workspace." },
      { title: "Review the suggestions", description: "Check dish names, descriptions and prices carefully. Fix anything the AI misunderstood." },
      { title: "Apply approved content", description: "Accept reviewed changes into Menu Studio and publish when you are ready." }
    ],
    faqs: [
      { question: "Is photo-to-menu import included in the free plan?", answer: "Not automatically. It needs a supported, configured AI provider and separate approval." },
      { question: "Does an uploaded menu immediately change my live menu?", answer: "No. You review and correct the extracted candidates before applying changes." },
      { question: "Will the AI always read every price correctly?", answer: "No. Images and printed menus vary, so the owner should confirm every item and price before applying changes." }
    ],
    guideHref: "/docs/menu-import",
    guideLabel: "Read the import guide"
  }
];

export function marketingFeatureBySlug(slug: string): MarketingFeature | undefined {
  return marketingFeatures.find((feature) => feature.slug === slug);
}
