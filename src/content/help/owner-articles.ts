import type { HelpArticle } from "./contracts";

export const ownerArticles: HelpArticle[] = [
  {
    id: "getting-started",
    slug: "getting-started",
    audience: "owner",
    category: "Restaurant Setup",
    title: "Getting Started with MenuMinute in 5 Minutes",
    subtitle:
      "A quick, step-by-step walkthrough to setting up your restaurant and publishing your first digital menu.",
    summary:
      "Welcome to MenuMinute! Setting up your dining room takes just five minutes. You do not need any special technical knowledge—just your restaurant name, your logo, and your love for great food.",
    readTimeMinutes: 4,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: [
      "getting started",
      "setup",
      "onboarding",
      "register",
      "currency",
      "hours",
      "profile",
    ],
    heroImage: {
      src: "/brand/onboarding-wizard/welcome-hero-desktop-light.webp",
      alt: "MenuMinute permanent tabletop QR system and digital menu presentation",
      caption:
        "Your digital dining room comes to life with permanent tabletop QR codes and instant live updates.",
    },
    quickSteps: [
      "Sign in to your restaurant workspace from any phone, tablet, or laptop.",
      "Enter your restaurant name, upload your brand logo, and select your local currency.",
      "Save your weekly opening and closing hours so diners know when you are open.",
      "Open Menu Studio to add your very first dishes and appetizers.",
      "Download and print your permanent tabletop QR stickers.",
    ],
    visualMockup: {
      type: "dish-card",
      caption: "Your digital storefront comes to life within minutes of signing up.",
      altText: "Preview of initial restaurant setup with dish card and branding",
    },
    sections: [
      {
        id: "profile-and-currency",
        title: "1. Create Your Restaurant Profile & Select Currency",
        content: [
          "When you first log in, you will be invited to enter your restaurant name, location, and upload your brand logo. Your logo appears prominently at the top of every diner's phone screen when they scan your tables.",
          "Choosing your currency: Select your local currency (such as INR, USD, EUR, GBP, AUD, or AED) during setup. MenuMinute handles all prices in your restaurant's native currency with clean, accurate decimal formatting.",
        ],
        steps: [
          {
            stepNumber: 1,
            title: "Open Outlet Settings",
            description:
              "Click on 'Settings' in your left sidebar or press Ctrl+K and choose 'Outlet Profile'.",
            highlightAction: "Settings > Outlet Profile",
          },
          {
            stepNumber: 2,
            title: "Upload Your Restaurant Logo",
            description:
              "Choose a crisp square or circular image of your logo. High-contrast logos look gorgeous on mobile screens.",
          },
          {
            stepNumber: 3,
            title: "Set Business Hours",
            description:
              "Specify your opening and closing times for each day of the week so guests see your active service schedule.",
          },
        ],
        callout: {
          type: "hospitality",
          title: "First Impressions Matter",
          text: "A bright, high-resolution logo helps diners immediately recognize your brand the moment they sit down and scan the table.",
        },
      },
      {
        id: "workspace-tour",
        title: "2. Your Workspace Tour",
        content: [
          "The MenuMinute dashboard is designed to be calm, clean, and distraction-free, especially during a packed Friday dinner rush.",
          "On the left navigation bar, you have instant access to: Menu Studio (for drafting dishes), QR Codes (for printing table stickers), Live Orders (for tracking incoming requests), Kitchen Display (for kitchen prep staff), and Reports (for your daily shift sales).",
          "You can press Ctrl+K at any moment to open the Command Palette and jump directly to any page in seconds.",
        ],
        callout: {
          type: "delight",
          title: "Keyboard Shortcuts for Busy Shifts",
          text: "Pressing Ctrl+K lets floor managers find orders, toggle sold-out items, or ask questions in a single keystroke.",
        },
      },
    ],
    faqs: [
      {
        question: "Can I run multiple restaurant locations from one account?",
        answer:
          "Yes! You can manage multiple outlets under your organization account. Each location can have its own independent menu, currency, operating hours, and staff.",
      },
      {
        question: "Do I need special hardware to run MenuMinute?",
        answer:
          "Not at all. MenuMinute works beautifully on any modern device you already have—iPads, Android tablets, laptops, or even your smartphone.",
      },
    ],
    dashboardLink: {
      label: "Open Restaurant Settings",
      href: "/dashboard/settings",
    },
    relatedArticleSlugs: ["menu-studio", "qr-codes-and-tables", "ai-menu-import"],
  },
  {
    id: "menu-studio",
    slug: "menu-studio",
    audience: "owner",
    category: "Menu Creation",
    title: "Menu Studio: Crafting & Publishing Digital Menus",
    subtitle:
      "Design mouthwatering digital menus with categories, modifiers, dietary badges, and one-click publishing.",
    summary:
      "Menu Studio gives you total creative control over your dishes. Organize your items into categories, add mouthwatering photos, configure add-ons, and publish updates instantly without ever re-printing paper menus.",
    readTimeMinutes: 6,
    difficulty: "Comprehensive",
    lastUpdated: "2026-10-31",
    keywords: [
      "menu studio",
      "dishes",
      "categories",
      "pricing",
      "modifiers",
      "allergens",
      "vegan",
      "halal",
      "publish",
    ],
    heroImage: {
      src: "/brand/menu-studio/recipe-atelier/hero-desktop-light.webp",
      alt: "Menu Studio dish crafting workspace",
      caption:
        "Craft appetizing dishes with portion sizes, preparation choices, and dietary badges.",
    },
    quickSteps: [
      "Click '+ New Category' (e.g., Starters, Wood-Fired Pizzas, Signature Drinks, Desserts).",
      "Click '+ Add Dish' inside any category and write an inviting, sensory description.",
      "Add variations (e.g., Regular, Large) and optional add-ons (e.g., Extra Truffle Glaze).",
      "Tag dietary highlights (Vegetarian, Vegan, Halal, Gluten-Free) and flag common allergens.",
      "Review your changes in the Live Preview and hit 'Publish Menu'.",
    ],
    visualMockup: {
      type: "dish-card",
      caption:
        "Interactive dish cards show appetizing imagery, dietary icons, and portion pricing.",
      altText: "Dish card showing title, description, price, and dietary tags",
    },
    sections: [
      {
        id: "organizing-categories",
        title: "1. Organizing Categories & Dishes",
        content: [
          "Great menus are effortless for hungry guests to navigate. Group your dishes into logical categories such as 'Appetizers', 'Wood-Fired Pizzas', 'Signature Drinks', or 'Chef Specials'.",
          "You can drag and reorder categories and dishes to arrange them in the exact order you want diners to explore them on their phones.",
        ],
        steps: [
          {
            stepNumber: 1,
            title: "Create Categories",
            description:
              "Click '+ New Category' at the top of Menu Studio and give it a clear, appetizing name.",
            highlightAction: "Menu Studio > + New Category",
          },
          {
            stepNumber: 2,
            title: "Add Dish Details",
            description:
              "Enter the dish title, an inviting description of fresh ingredients, and the price.",
          },
          {
            stepNumber: 3,
            title: "Upload Food Photos",
            description:
              "Attach a delicious photo. Dishes with vibrant photography consistently see higher customer orders!",
          },
        ],
        callout: {
          type: "hospitality",
          title: "Sensory Descriptions Sell",
          text: "Highlight textures and cooking techniques like 'slow-braised', 'crisp wood-fired crust', or 'hand-whipped ricotta'.",
        },
      },
      {
        id: "modifiers-and-addons",
        title: "2. Variations, Modifiers & Add-ons",
        content: [
          "Give your diners the freedom to customize their meals without burdening your servers with messy handwritten notes.",
          "Required Choices (Variations): Use these when a customer must choose one option (e.g. Portion Size: Small / Medium / Large, or Pasta Type: Penne / Spaghetti / Rigatoni).",
          "Optional Extras (Add-ons): Use these for delicious extras that increase your average order value (e.g. Extra Avocado +$2.50, Add Truffle Butter +$3.00, House Hot Sauce on the side).",
        ],
      },
      {
        id: "dietary-and-allergens",
        title: "3. Dietary Badges & Allergen Safety",
        content: [
          "Customers with dietary requirements love digital menus! You can highlight items with clean, verified badges: Vegetarian, Vegan, Halal, Gluten-Free, and Dairy-Free.",
          "You can also flag common allergens (such as Peanuts, Tree Nuts, Shellfish, Soy, or Eggs) so guests can dine with total confidence.",
        ],
        callout: {
          type: "pitfall",
          title: "Kitchen Safety Priority",
          text: "Never guess allergen flags. Always verify ingredients with your head chef before tagging a dish allergen-free.",
        },
      },
      {
        id: "draft-vs-published",
        title: "4. The Safety of Draft vs Published Menus",
        content: [
          "In MenuMinute, your edits are saved as a private Draft first. Think of this as your private chef notebook: you can tweak prices, prepare seasonal dishes, or adjust descriptions during service without altering what active diners see on their phones.",
          "When you are ready, simply click 'Publish Changes'. Guests opening or refreshing your menu will see the published changes when their connection is available.",
        ],
      },
    ],
    faqs: [
      {
        question: "If I change a price or add a dish, do I have to re-print my QR codes?",
        answer:
          "Usually not. A QR for an active menu connection continues to work after menu updates; allow for normal network and browser refresh times.",
      },
      {
        question: "Can I temporarily hide a dish that is out of ingredients?",
        answer:
          "Yes! Use the 86 Board on your Live Orders page or toggle availability right inside Menu Studio to mark any dish 'Sold Out' instantly.",
      },
    ],
    dashboardLink: {
      label: "Open Menu Studio",
      href: "/dashboard/menu",
    },
    relatedArticleSlugs: ["ai-menu-import", "qr-codes-and-tables", "live-orders-and-service"],
  },
  {
    id: "ai-menu-import",
    slug: "ai-menu-import",
    audience: "owner",
    category: "Menu Creation",
    title: "AI Menu Import: Turn Paper Menus into Digital Catalogs",
    subtitle:
      "Snap a photo of your existing paper menu or upload a PDF to create your digital menu automatically.",
    summary:
      "Save hours of typing! Upload clear pictures of your existing printed menu or a PDF design file. MenuMinute's intelligent scanner reads your categories, dishes, descriptions, and prices into a draft for you to review and approve.",
    readTimeMinutes: 5,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: ["ai import", "ocr", "scan menu", "pdf import", "photo upload", "menu digitizer"],
    heroImage: {
      src: "/brand/menu-studio/recipe-atelier/dish-workspace-illustration.webp",
      alt: "AI Menu Import scanning workflow",
      caption: "Review extracted menu items before adding them to your private draft.",
    },
    quickSteps: [
      "Navigate to Menu Studio and click 'Import Menu'.",
      "Upload high-quality photos or a PDF of your existing paper menu.",
      "Wait for the import to finish. Larger or harder-to-read menus may take longer.",
      "Review the parsed items in the visual side-by-side editor.",
      "Accept and merge the items into your draft menu with one click.",
    ],
    visualMockup: {
      type: "dish-card",
      caption: "Turn physical paper menus into clean, organized digital dishes in seconds.",
      altText: "Visual of scanned paper menu being transformed into digital cards",
    },
    sections: [
      {
        id: "capturing-menu-photos",
        title: "1. Taking Great Menu Photos for Best Results",
        content: [
          "The clearer your photograph, the more accurately our scanner can read prices and dish names.",
          "Ensure bright, even lighting without harsh reflections or heavy shadows falling across the page.",
          "Keep the camera steady and parallel to the menu surface to avoid angled distortion.",
          "If your paper menu has multiple folds or pages, take a separate photo of each page.",
        ],
        callout: {
          type: "hospitality",
          title: "Have the Designer PDF?",
          text: "If your menu was created by a graphic designer, uploading their original PDF file yields the cleanest, fastest import results!",
        },
      },
      {
        id: "reviewing-candidates",
        title: "2. Reviewing the Parsed Candidate Draft",
        content: [
          "MenuMinute never publishes imported items automatically. Your restaurant reputation is paramount, so the scanner always prepares a private Candidate Draft for your review.",
          "In the review screen, you can verify dish names, adjust any prices, reassign categories, and confirm dietary tags.",
          "Once you are satisfied, click 'Accept Items' to import them directly into your Menu Studio draft.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does the AI scanner understand multi-column menus and handwritten specials?",
        answer:
          "It handles multi-column layouts very well. For handwritten specials, neat handwriting is usually recognized, but you can easily correct any unrecognized words in the review screen.",
      },
      {
        question: "Can I import a menu in a non-English language?",
        answer:
          "Yes! The scanner supports menus in numerous languages including Spanish, French, German, Italian, Arabic, Hindi, Japanese, and more.",
      },
    ],
    dashboardLink: {
      label: "Try Menu Import",
      href: "/dashboard/menu",
    },
    relatedArticleSlugs: ["menu-studio", "qr-codes-and-tables"],
  },
  {
    id: "qr-codes-and-tables",
    slug: "qr-codes-and-tables",
    audience: "owner",
    category: "Table Setup",
    title: "QR Studio & Tabletop Press: Printing Permanent QR Codes",
    subtitle:
      "Generate beautiful, branded tabletop QR codes and stickers that never expire or need re-printing.",
    summary:
      "MenuMinute's QR Studio lets you create table-specific or whole-restaurant QR codes. Customize colors, add your restaurant name, and download print-ready sheets for table tents, stickers, or acrylic standees.",
    readTimeMinutes: 5,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: [
      "qr codes",
      "table qr",
      "table stickers",
      "tabletop press",
      "print menu",
      "permanent qr",
    ],
    heroImage: {
      src: "/brand/qr-studio/tabletop-press/hero-desktop-light.webp",
      alt: "Permanent tabletop QR codes and print templates",
      caption:
        "Permanent tabletop QR stickers ensure your dining room never has to re-print codes when prices change.",
    },
    quickSteps: [
      "Open 'QR Codes' from your dashboard sidebar.",
      "Select your QR type: Table-Specific (e.g. Table 1, Table 2) or General Entrance.",
      "Choose a print design, QR color and typography using the available QR Studio controls.",
      "Preview the standee layout on screen.",
      "Click 'Download Print Sheet' (PDF or high-res PNG) and print for your tables.",
    ],
    visualMockup: {
      type: "qr-card",
      caption: "Branded tabletop standee cards guide diners to scan with their camera.",
      altText: "Preview of tabletop QR standee with table number and instructions",
    },
    sections: [
      {
        id: "why-permanent-qr",
        title: "1. Why MenuMinute QR Codes are Permanent",
        content: [
          "A MenuMinute QR points to a saved menu connection, rather than a fixed list of dishes. Updating the menu does not change the QR while that connection remains active.",
          "Menu changes do not require a new QR print while the same QR destination remains active. Replacing or deleting a table QR may require a new print.",
        ],
      },
      {
        id: "table-vs-entrance",
        title: "2. Table-Specific vs General Entrance QR Codes",
        content: [
          "Table-Specific QRs (Recommended for Dine-in): When a diner scans 'Table 4', the menu automatically knows their table number. When they place an order or request assistance, your kitchen and waitstaff see 'Table 4' immediately.",
          "General QRs (Ideal for Entrance & Counter Pickup): Perfect for window displays, bar counters, or takeout counters where guests pick up orders themselves.",
        ],
        steps: [
          {
            stepNumber: 1,
            title: "Choose Table Range",
            description: "Enter your starting and ending table numbers (e.g. Tables 1 to 25).",
            highlightAction: "QR Studio > Table Numbers",
          },
          {
            stepNumber: 2,
            title: "Select Theme & Typography",
            description: "Choose a design that complements your dining room aesthetic.",
          },
          {
            stepNumber: 3,
            title: "Export Print Sheet",
            description: "Preview your print layout and choose an available export format before printing.",
          },
        ],
        callout: {
          type: "hospitality",
          title: "Matte Lamination Tip",
          text: "Apply a matte lamination coating to your table stickers. Matte surfaces prevent annoying glare under bright restaurant lighting, making camera scanning instantaneous.",
        },
      },
    ],
    faqs: [
      {
        question: "What size should I print the QR stickers?",
        answer:
          "For dining tables, a square sticker between 6 cm x 6 cm (2.5 inches) and 9 cm x 9 cm (3.5 inches) is ideal. Diners can comfortably scan it from their seats without standing up.",
      },
      {
        question: "What if a customer accidentally spills liquid on the sticker?",
        answer:
          "If you use waterproof synthetic vinyl stickers or acrylic table tents, spills wipe right off! Even if slightly scratched, high error-correction QR codes remain fully readable.",
      },
    ],
    dashboardLink: {
      label: "Open QR Studio",
      href: "/dashboard/qr-codes",
    },
    relatedArticleSlugs: ["getting-started", "menu-studio", "table-floor-matrix"],
  },
  {
    id: "kitchen-display-system",
    slug: "kitchen-display-system",
    audience: "owner",
    category: "Kitchen Operations",
    title: "Kitchen Pro: Real-Time Kitchen Display System (KDS)",
    subtitle:
      "Streamline your kitchen ticket workflow, reduce wait times, and eliminate messy paper order slips.",
    summary:
      "Kitchen Pro is a paperless Kitchen Display System that organizes incoming tickets on any tablet or screen in your kitchen. Track prep times, filter tickets by cook station, and bump orders when ready.",
    readTimeMinutes: 6,
    difficulty: "Comprehensive",
    lastUpdated: "2026-10-31",
    keywords: [
      "kitchen display",
      "kds",
      "kitchen pro",
      "tickets",
      "bump bar",
      "cook station",
      "prep timer",
    ],
    heroImage: {
      src: "/brand/orders/service-counter/ticket-stack.webp",
      alt: "Kitchen Pro KDS display workflow",
      caption: "Paperless station tickets with preparation timers and instant order bumping.",
    },
    quickSteps: [
      "Open `/kitchen` on any kitchen tablet, monitor, or screen.",
      "Select your kitchen station (e.g., Grill, Fryer, Salad & Cold, Bar, or All).",
      "Watch new orders arrive with an audible chime and clean ticket cards.",
      "Check item modifiers, special guest notes, and real-time elapsed prep timers.",
      "Start preparation for your station, then mark its tasks complete. The expeditor releases the full order when all stations finish.",
    ],
    visualMockup: {
      type: "kds-ticket",
      caption: "Kitchen tickets feature high-contrast timers, item lists, and stage bump buttons.",
      altText: "KDS ticket mockup showing order number, station, timer, and bump button",
    },
    sections: [
      {
        id: "station-routing",
        title: "1. Station Routing & Kitchen Layout",
        content: [
          "In a busy restaurant, the grill chef does not need to see beverage orders, and the bartender does not need to see steaks. Kitchen Pro allows you to filter display screens by station:",
          "Hot Kitchen / Grill: Steaks, burgers, pizzas, hot entrees.",
          "Cold Station / Pantry: Fresh salads, raw bar, appetizers, desserts.",
          "Bar / Beverage: Cocktails, draft beer, wines, coffee, cold beverages.",
          "Expo / Expeditor: Shows the complete order across all stations so the kitchen pass coordinator can assemble final plates together.",
        ],
        callout: {
          type: "hospitality",
          title: "Protecting Kitchen Tablets",
          text: "Mount kitchen tablets at eye level using sturdy silicone wall mounts. This keeps screens free from heat, steam, and spills during dinner rushes.",
        },
      },
      {
        id: "timers-and-bumping",
        title: "2. Color-Coded Timers & Ticket Stages",
        content: [
          "Every ticket displays an active elapsed timer so your kitchen line knows exactly how long diners have been waiting:",
          "Green (< 10 minutes): Fresh ticket, normal prep window.",
          "Amber (10–20 minutes): Approaching target prep threshold.",
          "Red (> 20 minutes): Priority order needing immediate line attention.",
          "Each station marks its own work complete. Once all assigned stations finish, an authorized expeditor checks the whole order and releases it as Ready.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can multiple kitchen staff view and bump tickets at the same time?",
        answer:
          "Yes! Kitchen Pro synchronizes across all screens in real time. If the grill chef finishes their burger and bumps it, the expeditor screen updates immediately.",
      },
      {
        question: "Does Kitchen Pro work on affordable Android tablets?",
        answer:
          "Absolutely. Kitchen Pro runs in any web browser and is fully optimized for standard 10-inch Android tablets, iPads, and commercial touch monitors.",
      },
    ],
    dashboardLink: {
      label: "Open Kitchen Display",
      href: "/kitchen",
    },
    relatedArticleSlugs: ["live-orders-and-service", "table-floor-matrix", "reports-and-analytics"],
  },
  {
    id: "live-orders-and-service",
    slug: "live-orders-and-service",
    audience: "owner",
    category: "Front of House",
    title: "Live Orders, Service Counter & The 86 Board",
    subtitle:
      "Accept customer dine-in orders, manage waiter call requests, and toggle sold-out dishes in one click.",
    summary:
      "Manage all incoming front-of-house activity from a single dashboard screen. Acknowledge pending dine-in and pickup tickets, attend to guest waiter calls, and instantly mark dishes sold out on the 86 Board.",
    readTimeMinutes: 5,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: [
      "live orders",
      "order management",
      "service counter",
      "86 board",
      "sold out",
      "call waiter",
      "pickup",
    ],
    heroImage: {
      src: "/brand/orders/service-counter/hero-desktop-light.webp",
      alt: "Live service counter and front of house ordering",
      caption:
        "Accept orders, attend to guest requests, and manage 86 sold-out items from one calm screen.",
    },
    quickSteps: [
      "Open 'Live Orders' to see tickets sorted by newest arrival.",
      "Click 'Accept Order' to confirm a dine-in ticket and send it to the kitchen.",
      "Check the 'Service Requests' panel for guest calls (e.g. 'Table 7 requests water').",
      "Use the '86 Board' switch next to any dish to instantly mark it Sold Out.",
      "Mark tickets 'Served' (dine-in) or 'Collected' (pickup) upon delivery.",
    ],
    visualMockup: {
      type: "eight-six-board",
      caption:
        "The 86 Board lets you toggle item availability with a single tap during rush hours.",
      altText: "86 Board showing dishes with instant toggle switches for availability",
    },
    sections: [
      {
        id: "order-acceptance",
        title: "1. Order Acceptance & Guest Assurance",
        content: [
          "In MenuMinute, order submission is not automatic acceptance. As a restaurant operator, you always maintain final authority over your kitchen's capacity.",
          "When a diner submits an order, it arrives with a chime in your pending queue. Once you click 'Accept', the guest's phone updates with confirmation and estimated prep time.",
        ],
      },
      {
        id: "eighty-six-board",
        title: "2. The 86 Board (Sold Out Management)",
        content: [
          "Ran out of fresh salmon or the daily soup special? Don't make servers apologize at tables after diners order.",
          "Head to the 86 Board panel right on your orders screen. Marking a dish sold out updates its availability in the public menu; an already-open guest page may need to refresh. Diners scanning QR codes will see the dish grayed out with a polite 'Sold Out for Today' label.",
        ],
        callout: {
          type: "hospitality",
          title: "Morning Reset",
          text: "Turn items back on just as easily the next morning when your fresh delivery arrives!",
        },
      },
      {
        id: "service-requests",
        title: "3. Service Requests & Waiter Calls",
        content: [
          "Guests scanning table QR codes can tap 'Call Waiter' or 'Request Bill' directly from their phones.",
          "These notifications pop up prominently in your Service Requests panel with the table number, allowing floor staff to respond swiftly and delight customers.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I reject an order if the kitchen is at full capacity?",
        answer:
          "Yes, you can reject an order with an optional polite note (such as 'Kitchen at maximum capacity; please try again in 15 minutes'). The guest is immediately notified on their phone.",
      },
      {
        question: "Does accepting an order collect payment?",
        answer:
          "Accepting an order confirms kitchen preparation. Payment can be recorded separately at the table via cash, card, or your POS terminal.",
      },
    ],
    dashboardLink: {
      label: "View Live Orders",
      href: "/dashboard/orders",
    },
    relatedArticleSlugs: ["kitchen-display-system", "table-floor-matrix", "pos-and-payments"],
  },
  {
    id: "table-floor-matrix",
    slug: "table-floor-matrix",
    audience: "owner",
    category: "Front of House",
    title: "Table Floor Matrix: Managing Dining Tables & Tabs",
    subtitle:
      "Get a visual bird's-eye view of your dining room, occupied tables, open tabs, and turnover times.",
    summary:
      "The Table Floor Matrix provides floor managers and hosts with an instant visual snapshot of every table in your restaurant. Monitor which tables are actively dining, which are waiting for food, and which have unpaid orders.",
    readTimeMinutes: 4,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: [
      "floor matrix",
      "tables",
      "dining room",
      "table turnover",
      "open tabs",
      "host stand",
    ],
    heroImage: {
      src: "/brand/dashboard/editorial/dining-room-empty-light.svg",
      alt: "Table floor matrix dining layout",
      caption: "A visual floor map showing table occupancy, active prep, and open balances.",
    },
    quickSteps: [
      "Open 'Floor Matrix' from the dashboard navigation.",
      "View your tables arranged in a clean grid with status badges.",
      "Identify tables with active orders (amber), served food (green), or unpaid balances (blue).",
      "Click any table card to view its current ticket history and order total.",
      "Clear the table when guests finish and depart to ready it for the next party.",
    ],
    visualMockup: {
      type: "service-bell",
      caption: "Visual table cards indicate open orders, active requests, and dining duration.",
      altText: "Table floor matrix grid with table status indicators",
    },
    sections: [
      {
        id: "table-colors",
        title: "1. Understanding Table Status Colors",
        content: [
          "Gray (Available): Table is clean, open, and ready for new arriving diners.",
          "Amber (Active Orders): Diners have scanned and placed an order that is currently in kitchen prep.",
          "Green (Served): Food has been delivered to the table; diners are enjoying their meal.",
          "Blue Badge (Unpaid Balance): Shows orders requiring payment settlement before guest departure.",
        ],
        callout: {
          type: "hospitality",
          title: "Host Stand Efficiency",
          text: "Use the Floor Matrix at the host stand to estimate table turnaround times and seat waiting walk-in guests more accurately.",
        },
      },
    ],
    faqs: [
      {
        question: "Can I customize the table numbers to match my restaurant's layout?",
        answer:
          "Yes! You can configure table names or numbers (e.g. Table 1 to 30, Patio A-D, Bar 1-6) in your Outlet Settings.",
      },
    ],
    dashboardLink: {
      label: "Open Floor Matrix",
      href: "/dashboard/floor",
    },
    relatedArticleSlugs: ["qr-codes-and-tables", "live-orders-and-service", "pos-and-payments"],
  },
  {
    id: "pos-and-payments",
    slug: "pos-and-payments",
    audience: "owner",
    category: "Billing & POS",
    title: "Point of Sale (POS) & Payment Recording",
    subtitle:
      "Prepare counter orders, optionally mark a payment as received, and print a provisional customer invoice. Formal financial documents require separate approval.",
    summary:
      "Use Point of Sale to record orders and optionally note a payment received by staff. These records do not themselves capture card payments or prove bank settlement.",
    readTimeMinutes: 5,
    difficulty: "Comprehensive",
    lastUpdated: "2026-10-31",
    keywords: [
      "pos",
      "point of sale",
      "payments",
      "cash",
      "card",
      "receipts",
      "z-report",
      "register",
    ],
    heroImage: {
      src: "/brand/orders/service-counter/ticket-stack.webp",
      alt: "POS register and receipt printing",
      caption:
        "Record cash and card tenders accurately with thermal receipt printing and shift closing reports.",
    },
    quickSteps: [
      "Open 'POS' from the dashboard sidebar.",
      "View all attachable guest tickets and open table orders.",
      "Add published dishes to a new counter order, or open an eligible existing ticket. Choose a payment method only if staff actually received payment.",
      "Use 'Mark as Paid' when you have actually received payment. This is a staff record, not an automatic card charge or bank confirmation.",
      "Choose 'Print Invoice' and select the paper width (80 mm or 58 mm), then use your browser's print dialog.",
      "Generate the end-of-day Z-Report when closing your shift.",
    ],
    visualMockup: {
      type: "cart-drawer",
      caption:
        "Clean POS summary showing itemized tickets, payment methods, and thermal receipt print actions.",
      altText: "POS register view with ticket details and payment recording buttons",
    },
    sections: [
      {
        id: "recording-payments",
        title: "1. Recording Payments Accurately",
        content: [
          "MenuMinute treats guest order values as draft orders until your staff records the actual payment received.",
          "When diners pay at their table or front counter, staff can select the exact tender type: Cash, Card, Digital Wallet, or Room Charge.",
          "This ensures your end-of-day accounting balances match your physical cash drawer and card batch totals.",
        ],
      },
      {
        id: "receipts-and-zreport",
        title: "2. Printing Thermal Receipts & Z-Reports",
        content: [
          "MenuMinute provides print-friendly invoice layouts for 80 mm and 58 mm paper. Your browser, printer and drivers must support the chosen setup.",
          "Receipts cleanly list your restaurant name, table number, itemized dishes with modifiers, tax details, and warm thank-you message.",
          "At the end of your business day, generate the Z-Report (`/dashboard/reports/z-report`) for an immutable snapshot of all closed transactions.",
        ],
        callout: {
          type: "hospitality",
          title: "Printer Setup Simplicity",
          text: "Printer setup depends on your device, browser and printer. Install or configure the printer using its manufacturer's instructions before printing a sample.",
        },
      },
    ],
    faqs: [
      {
        question: "Does MenuMinute take a commission on in-restaurant cash or card payments?",
        answer:
          "Never! MenuMinute charges zero percent (0%) commission on orders taken through your digital menu. You keep 100% of your hard-earned revenue.",
      },
    ],
    dashboardLink: {
      label: "Open POS Register",
      href: "/dashboard/pos",
    },
    relatedArticleSlugs: ["table-floor-matrix", "reports-and-analytics", "live-orders-and-service"],
  },
  {
    id: "reports-and-analytics",
    slug: "reports-and-analytics",
    audience: "owner",
    category: "Insights & Reports",
    title: "Reports, Analytics & Daily Shift Summaries",
    subtitle:
      "Understand your best-selling dishes, peak dining hours, order volumes, and export financial data.",
    summary:
      "Transform your dining data into smarter business decisions. See your top-selling items, compare lunch vs dinner order volumes, celebrate daily milestones, and export reports for your accountant.",
    readTimeMinutes: 5,
    difficulty: "Comprehensive",
    lastUpdated: "2026-10-31",
    keywords: [
      "reports",
      "analytics",
      "shift summary",
      "sales",
      "best sellers",
      "csv export",
      "milestones",
    ],
    heroImage: {
      src: "/brand/dashboard/editorial/hero-desktop-light.webp",
      alt: "Restaurant shift analytics and sales reports",
      caption:
        "Track shift milestones, top-selling dishes, and financial totals across any time period.",
    },
    quickSteps: [
      "Navigate to 'Reports' in your dashboard.",
      "Select your time range: Today, Yesterday, This Week, Last 7 Days, or This Month.",
      "Inspect the Shift Summary for order counts, completed tickets, and gross values.",
      "Review the Top-Selling Dishes leaderboard to see customer favorites.",
      "Click 'Export CSV' to download detailed records for spreadsheet analysis.",
    ],
    visualMockup: {
      type: "kds-ticket",
      caption: "Interactive performance cards highlight revenue trends and popular menu items.",
      altText: "Reports dashboard with sales charts and top-selling dishes",
    },
    sections: [
      {
        id: "daily-shift-summary",
        title: "1. The Daily Shift Summary Dialog",
        content: [
          "At the end of each shift, click 'Shift Summary' on your main dashboard to review the day's highlights.",
          "It summarizes total completed tickets, average order values, and highlights any milestones (e.g. '100th Order Celebrated Today!').",
          "It is the perfect tool for shift managers to debrief before handing over to the evening team.",
        ],
      },
      {
        id: "best-sellers",
        title: "2. Identifying Best-Sellers & Low-Performing Items",
        content: [
          "Use the dish leaderboard to discover which items are driving your sales and which rarely get ordered.",
          "High-volume dishes with good margins can be promoted to the 'Chef Recommendations' category in Menu Studio to boost revenue even further.",
        ],
        callout: {
          type: "hospitality",
          title: "Data-Driven Menu Engineering",
          text: "If a dish has high views but low orders, consider updating its photo or refining the description to make it more enticing.",
        },
      },
    ],
    faqs: [
      {
        question: "Can I export data for my accounting software (QuickBooks, Excel)?",
        answer:
          "Yes! Click the 'Export CSV' button to download an itemized spreadsheet compatible with Excel, Google Sheets, or your accounting software.",
      },
    ],
    dashboardLink: {
      label: "View Reports",
      href: "/dashboard/reports",
    },
    relatedArticleSlugs: ["pos-and-payments", "ember-assistant-and-settings"],
  },
  {
    id: "ember-assistant-and-settings",
    slug: "ember-assistant-and-settings",
    audience: "owner",
    category: "AI & Organization",
    title: "Ember AI Assistant, Team Roles & Security",
    subtitle:
      "Ask Ember questions about your restaurant operations, invite staff, and manage security settings.",
    summary:
      "Meet Ember, your in-dashboard restaurant assistant. Ask Ember everyday questions about today's orders, menu items, or kitchen status. Plus, learn how to invite staff members with safe, role-based access.",
    readTimeMinutes: 5,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: [
      "ember",
      "ai assistant",
      "team",
      "roles",
      "permissions",
      "security",
      "two factor",
      "invite",
    ],
    heroImage: {
      src: "/brand/organization/hospitality-house/illustrations/team-hall-light.webp",
      alt: "Ember AI Assistant and team security",
      caption: "Grounded conversational assistance and secure role-based team management.",
    },
    quickSteps: [
      "Click the Ember sparkle icon in your dashboard bottom bar or press Ctrl+K and ask a question.",
      "Ask things like: 'What dishes are sold out today?' or 'How many orders did we complete today?'.",
      "Invite your kitchen and floor staff under Settings > Team.",
      "Assign roles: Owner, Manager, Kitchen Staff, or Floor Staff.",
      "Enable Two-Factor Authentication (2FA) for extra account protection.",
    ],
    visualMockup: {
      type: "service-bell",
      caption: "Ember gives instant, grounded answers about your live restaurant data.",
      altText: "Ember AI chat dialog with operational questions and grounded answers",
    },
    sections: [
      {
        id: "chatting-with-ember",
        title: "1. Chatting with Ember: What You Can Ask",
        content: [
          "Ember speaks plain, human language and answers only using verified facts from your restaurant. You can ask:",
          "'What were our top-selling dishes this week?'",
          "'Are there any tickets waiting in the kitchen right now?'",
          "'Do we sell Truffle Fries on our published menu?'",
          "'How do I print table QR codes?'",
          "Ember will answer directly and provide convenient shortcuts straight to the right screen.",
        ],
        callout: {
          type: "delight",
          title: "Truthful & Grounded",
          text: "Ember is designed to use verified information where available, but may still make mistakes. Check important prices, payments and operating decisions in your dashboard.",
        },
      },
      {
        id: "team-roles",
        title: "2. Inviting Staff & Role Permissions",
        content: [
          "Keep your restaurant secure by giving staff members only the access they need:",
          "Owner: Full access to billing, settings, reports, menus, and staff invites.",
          "Manager: Access to menu editing, orders, kitchen display, floor matrix, and reports.",
          "Kitchen Staff: Direct access to Kitchen Pro display and 86 Board.",
          "Service / Waiter: Access to Floor Matrix, Live Orders, and service calls.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can staff members see our total subscription or billing information?",
        answer: "No. Billing and plan settings are strictly restricted to Organization Owners.",
      },
      {
        question: "Is Ember trained on other restaurants' data?",
        answer:
          "Restaurant information is restricted by your account and outlet permissions. See the Privacy Policy for how configured AI providers handle submitted information.",
      },
    ],
    dashboardLink: {
      label: "Open Organization Settings",
      href: "/dashboard/organization",
    },
    relatedArticleSlugs: ["getting-started", "menu-studio", "reports-and-analytics"],
  },
];
