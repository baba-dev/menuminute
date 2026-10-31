import type { HelpArticle } from "./contracts";

export const customerArticles: HelpArticle[] = [
  {
    id: "how-to-scan-qr",
    slug: "how-to-scan-qr",
    audience: "customer",
    category: "Getting Started",
    title: "How to Scan & Open the Digital Menu in Seconds",
    subtitle:
      "No app downloads, no account registration—just point your phone's camera and explore.",
    summary:
      "Browsing a restaurant menu on your phone is effortless with MenuMinute. Simply open your phone's camera, point it at the table QR code, and tap the link that appears. You will instantly see today's fresh dishes, photos, and prices.",
    readTimeMinutes: 3,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: ["scan qr", "how to scan", "camera", "qr code", "iphone", "android", "no app"],
    heroImage: {
      src: "/brand/qr-studio/tabletop-press/print-studio-illustration.webp",
      alt: "Scanning tabletop QR menu on mobile",
      caption:
        "Instant camera scanning launches the full menu directly in your mobile browser with zero app installation.",
    },
    quickSteps: [
      "Open the default Camera app on your iPhone or Android phone.",
      "Hold your phone steadily a few inches above the tabletop QR code.",
      "A yellow or colored notification link will pop up on your screen.",
      "Tap the notification to open the restaurant's menu directly in your browser.",
      "Enjoy exploring dishes, ingredients, and photos!",
    ],
    visualMockup: {
      type: "qr-card",
      caption: "Point your phone camera at the table QR code to launch the menu instantly.",
      altText: "Smartphone scanning a tabletop QR sticker",
    },
    sections: [
      {
        id: "scanning-iphone",
        title: "1. Scanning on an iPhone (iOS)",
        content: [
          "Open your native Camera app from your lock screen or home screen.",
          "Point the rear camera at the QR code so the code is centered in the camera viewfinder.",
          "Tap the yellow banner labeled with the restaurant name or web address.",
          "Safari will open the menu instantly. No app installation or sign-in is required!",
        ],
      },
      {
        id: "scanning-android",
        title: "2. Scanning on an Android Phone",
        content: [
          "Open your default Camera app or Google Lens.",
          "Aim the camera at the QR sticker on your table.",
          "A pop-up pill with a link will appear. Tap it to open the menu in Chrome or your default web browser.",
          "If your camera does not scan automatically, swipe down from the top of your screen to open Quick Settings and tap 'Scan QR Code'.",
        ],
        callout: {
          type: "hospitality",
          title: "Dimly Lit Dining Rooms",
          text: "If the table is dimly lit, you can turn on your phone's camera flashlight using the lightning bolt icon in your camera app.",
        },
      },
      {
        id: "guest-privacy",
        title: "3. Privacy You Can Trust",
        content: [
          "You can browse the menu completely anonymously. MenuMinute never asks you to create an account, enter a password, or download an application just to read food descriptions and prices.",
        ],
        callout: {
          type: "delight",
          title: "Safe & Frictionless",
          text: "No annoying sign-up walls or email prompts—just great food and simple ordering.",
        },
      },
    ],
    faqs: [
      {
        question: "Do I have to download an app from the App Store or Google Play?",
        answer:
          "No! MenuMinute runs 100% in your mobile web browser (Safari, Chrome, Firefox, Samsung Internet).",
      },
      {
        question: "What if my camera won't focus on the code?",
        answer:
          "Hold your phone about 15–20 cm (6–8 inches) away from the sticker. Wiping your camera lens with a napkin can also help remove any smudges.",
      },
    ],
    relatedArticleSlugs: ["browsing-and-searching", "customizing-dishes", "placing-orders"],
  },
  {
    id: "browsing-and-searching",
    slug: "browsing-and-searching",
    audience: "customer",
    category: "Menu Exploration",
    title: "Browsing Dishes, Categories & Allergen Filters",
    subtitle:
      "Find your favorite cravings in seconds with sticky category pills, instant search, and dietary tags.",
    summary:
      "Whether you are looking for vegan delights, gluten-free options, or just the chef's signature pasta, MenuMinute's menu viewer makes it fun and easy to find exactly what you are craving.",
    readTimeMinutes: 3,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: [
      "browse menu",
      "search dishes",
      "categories",
      "dietary filters",
      "vegan",
      "gluten-free",
      "halal",
      "allergens",
    ],
    heroImage: {
      src: "/assets/public-menu/covers/artisan-bakery.webp",
      alt: "Browsing dishes and dietary categories",
      caption: "Explore categories, filter by dietary requirements, and view appetizing photos.",
    },
    quickSteps: [
      "Scroll horizontally across the top category pill bar (e.g. Starters, Mains, Desserts).",
      "Tap any category to smoothly glide directly to that section.",
      "Use the Search Bar to quickly find ingredients like 'truffle', 'avocado', or 'matcha'.",
      "Tap the Dietary Filter pills (Vegetarian, Vegan, Halal, Gluten-Free) to filter matching dishes.",
      "Tap any dish card to view appetizing high-res photos and full ingredient descriptions.",
    ],
    visualMockup: {
      type: "dish-card",
      caption: "Filter dishes effortlessly with clean badges for dietary preferences.",
      altText: "Dish card showing clear dietary badges and appetizing image",
    },
    sections: [
      {
        id: "sticky-categories",
        title: "1. The Sticky Category Bar",
        content: [
          "At the top of the menu, you will see category pills. As you scroll through the dishes, the bar stays pinned to the top of your screen so you can jump between Starters, Drinks, and Desserts whenever you want without endless scrolling.",
        ],
      },
      {
        id: "dietary-filters",
        title: "2. Finding Dishes with Dietary Tags & Allergen Warnings",
        content: [
          "Eating with allergies or personal dietary choices is stress-free on MenuMinute:",
          "Vegetarian (V) & Vegan (VG): Fresh plant-based dishes.",
          "Gluten-Free (GF): Suitable for gluten-sensitive diners.",
          "Halal: Prepared in accordance with halal standards.",
          "Allergen warnings: If a restaurant has flagged common allergens (nuts, shellfish, dairy, eggs), these are prominently highlighted on the dish detail sheet.",
        ],
        callout: {
          type: "pitfall",
          title: "Severe Allergies",
          text: "If you have a severe food allergy, always inform your server in person in addition to reviewing the digital menu.",
        },
      },
    ],
    faqs: [
      {
        question: "Can I view the menu in a different language?",
        answer:
          "If the restaurant has enabled translations, a language switcher appears at the top corner of the menu so you can view dish names and descriptions in your preferred language.",
      },
    ],
    relatedArticleSlugs: ["how-to-scan-qr", "customizing-dishes", "placing-orders"],
  },
  {
    id: "customizing-dishes",
    slug: "customizing-dishes",
    audience: "customer",
    category: "Ordering",
    title: "Customizing Dishes, Portion Sizes & Modifiers",
    subtitle:
      "Make your meal exactly how you like it—choose portion sizes, spice levels, toppings, and add notes.",
    summary:
      "Craving extra parmesan, less ice in your beverage, or a specific spice level? Tapping a dish opens the customization sheet where you can tailor your meal before adding it to your order.",
    readTimeMinutes: 3,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: [
      "customize dish",
      "modifiers",
      "portion size",
      "spice level",
      "add-ons",
      "kitchen notes",
    ],
    heroImage: {
      src: "/brand/menu-studio/recipe-atelier/dish-workspace-illustration.webp",
      alt: "Customizing dishes and selecting add-ons",
      caption: "Select portion sizes, dressings, and optional toppings with transparent pricing.",
    },
    quickSteps: [
      "Tap any dish on the menu to open the customization drawer.",
      "Select your required options (e.g. Size: Regular or Large, Salad Dressing choice).",
      "Pick any optional extras or toppings (e.g. Extra Cheese, Avocado, Bacon).",
      "Add a special preparation note for the kitchen (e.g. 'Dressing on the side, please').",
      "Check the updated price and tap 'Add to Cart'.",
    ],
    visualMockup: {
      type: "dish-card",
      caption:
        "Customization options allow you to choose portion sizes and toppings with clear pricing.",
      altText: "Dish customization modal showing options and add-ons",
    },
    sections: [
      {
        id: "required-vs-optional",
        title: "1. Required Choices vs Optional Add-ons",
        content: [
          "Required Choices: Indicated with a 'Choose 1' badge. For example, when ordering coffee, you may choose Whole Milk, Oat Milk, or Almond Milk.",
          "Optional Add-ons: Checkbox extras where you can pick as many as you like. Each add-on clearly displays its individual price so there are never any surprise charges.",
        ],
      },
      {
        id: "kitchen-notes",
        title: "2. Special Kitchen Notes",
        content: [
          "Need your steak cooked medium-rare or want your sauce on the side? Use the 'Special Instructions' box to leave a polite note for the chef.",
        ],
        callout: {
          type: "hospitality",
          title: "Clear Instructions Help the Chef",
          text: "Keep special notes short and specific so the kitchen cooks can prepare your meal accurately during a busy rush.",
        },
      },
    ],
    faqs: [
      {
        question: "Can I order more than one of the same dish with different toppings?",
        answer:
          "Yes! Customize the first dish and tap 'Add to Cart'. Then tap the dish again, choose your second set of toppings, and add it. Both variations will appear separately in your cart.",
      },
    ],
    relatedArticleSlugs: ["browsing-and-searching", "placing-orders", "order-tracking-and-service"],
  },
  {
    id: "placing-orders",
    slug: "placing-orders",
    audience: "customer",
    category: "Ordering",
    title: "Placing Your Order: Dine-In & Scheduled Pickup",
    subtitle:
      "Review your cart, confirm your table number, and submit your order directly to the restaurant.",
    summary:
      "Once you have selected your dishes, placing your order takes just one tap. Review your order in the cart drawer, verify your table number, and send your ticket straight to the kitchen.",
    readTimeMinutes: 4,
    difficulty: "Beginner Friendly",
    lastUpdated: "2026-10-31",
    keywords: ["place order", "cart", "checkout", "dine in", "pickup", "table number"],
    heroImage: {
      src: "/brand/orders/service-counter/ticket-stack.webp",
      alt: "Reviewing cart and placing dine in order",
      caption:
        "Review itemized dishes and table numbers before submitting directly to the kitchen.",
    },
    quickSteps: [
      "Tap the floating cart button at the bottom of the screen to open your cart drawer.",
      "Review your dishes, portion quantities, and selected modifiers.",
      "Verify your table number (if dining in) or choose your pickup time.",
      "Tap 'Submit Order' to send your request to the restaurant. Staff may need to accept it before preparation begins.",
      "Keep the tracking screen open to follow your meal's preparation in real time.",
    ],
    visualMockup: {
      type: "cart-drawer",
      caption: "The cart drawer shows an itemized breakdown of your meal and table confirmation.",
      altText: "Cart checkout drawer showing items, totals, and submit button",
    },
    sections: [
      {
        id: "dine-in-orders",
        title: "1. Dine-In Orders (At Your Table)",
        content: [
          "A table-specific QR identifies your table for the restaurant. Confirm that the displayed table is correct before submitting.",
          "Your order is sent to the restaurant for review. The kitchen receives work according to the restaurant's acceptance and kitchen settings.",
        ],
      },
      {
        id: "pickup-orders",
        title: "2. Scheduled Pickup Orders (Takeout)",
        content: [
          "For restaurants offering pickup, you can choose when you would like your food prepared (e.g. 'Ready in 25 minutes' or 'Schedule for 7:30 PM').",
          "You will receive an on-screen tracking ticket so you can pick up fresh, hot food without waiting in line.",
        ],
      },
    ],
    faqs: [
      {
        question: "How do I pay for my order?",
        answer:
          "Payment depends on the restaurant: many restaurants accept payment directly at your table via cash or card terminal when your food arrives, while others offer online payment directly on your phone.",
      },
      {
        question: "Can I add more items to my table later during the meal?",
        answer:
          "Yes! If you decide to order drinks, sides, or dessert later, simply scan the QR code again or keep the menu tab open to submit an additional order for your table.",
      },
    ],
    relatedArticleSlugs: ["customizing-dishes", "order-tracking-and-service"],
  },
  {
    id: "order-tracking-and-service",
    slug: "order-tracking-and-service",
    audience: "customer",
    category: "Dining Experience",
    title: "Live Order Tracking & Calling Your Server",
    subtitle:
      "Watch your meal's progress from kitchen to table, and request water, service, or the bill anytime.",
    summary:
      "No more wondering when your food will arrive! Follow your order through an accessible step-by-step progress tracker. Plus, use the on-screen Service Bell to request assistance without waving across the room.",
    readTimeMinutes: 3,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: [
      "order tracking",
      "tracker",
      "stepper",
      "call waiter",
      "request bill",
      "service bell",
    ],
    heroImage: {
      src: "/brand/orders/service-counter/hero-desktop-light.webp",
      alt: "Live order tracking and call waiter service bell",
      caption:
        "Follow preparation progress from kitchen to pass and alert your server with a single tap.",
    },
    quickSteps: [
      "After placing an order, keep the tracking page open on your phone.",
      "Watch the stepper advance: 'Order Received' -> 'In Kitchen' -> 'Ready' -> 'Served'.",
      "Need extra napkins, water, or cutlery? Tap the 'Call Waiter' button.",
      "Ready to wrap up? Tap 'Request Bill' to alert your server.",
    ],
    visualMockup: {
      type: "order-stepper",
      caption: "The live stepper keeps you informed at each stage of your food's preparation.",
      altText: "Order progress stepper with Received, Kitchen, Ready, and Served steps",
    },
    sections: [
      {
        id: "four-stages",
        title: "1. The 4 Stages of Your Order",
        content: [
          "Stage 1: Order Received — The restaurant has received your order and the manager has confirmed it.",
          "Stage 2: In Kitchen — The chefs have started cooking and assembling your dishes.",
          "Stage 3: Ready — Food has been plated and is at the pass waiting for pickup.",
          "Stage 4: Served — The friendly service team has delivered the dishes to your table. Enjoy your meal!",
        ],
      },
      {
        id: "service-bell",
        title: "2. The On-Screen Service Bell",
        content: [
          "Waving your hands across a crowded restaurant can feel awkward. MenuMinute includes an on-screen Service Bell for tables:",
          "Tap 'Call Waiter': Alerts staff that your table needs quick assistance (water refill, clean fork, extra sauce).",
          "Tap 'Request Bill': Lets your server know you are ready to settle the tab, allowing them to bring the bill folder or portable card terminal right away.",
        ],
        callout: {
          type: "delight",
          title: "Discreet & Attentive",
          text: "If your restaurant has enabled guest service requests, staff can see the request and table information in their service view.",
        },
      },
    ],
    faqs: [
      {
        question: "What if I accidentally close the browser tab?",
        answer:
          "Scan the table QR again to reopen the menu. If your order tracking link is no longer visible, ask restaurant staff to check your order.",
      },
    ],
    relatedArticleSlugs: ["placing-orders", "offline-menu-and-pwa"],
  },
  {
    id: "offline-menu-and-pwa",
    slug: "offline-menu-and-pwa",
    audience: "customer",
    category: "Dining Experience",
    title: "Safe Offline Browsing & Saving MenuMinute to Your Phone",
    subtitle:
      "Browse the menu smoothly even in basement dining rooms with spotty cellular reception.",
    summary:
      "Restaurants with thick stone walls or underground dining areas sometimes have poor cellular reception. MenuMinute can save eligible public menu pages for later viewing. Offline availability depends on what your browser has already cached, and some photos or details may be missing.",
    readTimeMinutes: 3,
    difficulty: "Quick 2-min Guide",
    lastUpdated: "2026-10-31",
    keywords: [
      "offline menu",
      "pwa",
      "install app",
      "add to home screen",
      "no internet",
      "connectivity",
    ],
    heroImage: {
      src: "/brand/reference/qr-system.webp",
      alt: "Safe offline browsing on mobile",
      caption:
        "Cached menus keep dishes and photos readable even in underground cellars with zero mobile reception.",
    },
    quickSteps: [
      "A previously opened public menu may be available from your browser's saved pages. Offline access is not guaranteed on every device.",
      "If your connection drops, try reopening a menu you have visited. Some content may not load until your connection returns.",
      "Reconnect and refresh your menu to check for the latest changes.",
      "Optional: Tap 'Add to Home Screen' in your browser menu for one-tap access next time you visit.",
    ],
    visualMockup: {
      type: "dish-card",
      caption: "A friendly offline banner lets you know you can still browse all dishes safely.",
      altText: "Offline badge indicating safe cached menu browsing",
    },
    sections: [
      {
        id: "how-offline-works",
        title: "1. How Safe Offline Browsing Works",
        content: [
          "MenuMinute can keep some previously visited public pages available offline. It cannot promise that every dish, image or current availability status is saved.",
          "If your mobile network drops while deciding between pasta or steak, you will not get a frustrating error screen—you can keep reading descriptions and browsing photos seamlessly.",
        ],
        callout: {
          type: "hospitality",
          title: "Submitting Orders Offline",
          text: "You need a working connection to submit an order or service request. If offline, the app will politely ask you to connect before submitting.",
        },
      },
      {
        id: "install-home-screen",
        title: "2. Adding to Your Home Screen (PWA)",
        content: [
          "On iPhone (Safari): Tap the Share button at the bottom of the screen (the square with an arrow pointing up) and select 'Add to Home Screen'.",
          "On Android (Chrome): Tap the three dots menu at the top right and select 'Add to Home Screen' or 'Install App'.",
          "This places an icon right on your phone's home screen, behaving just like a native app with zero download size!",
        ],
      },
    ],
    faqs: [
      {
        question: "Does saving the menu take up space on my phone?",
        answer:
          "Hardly any at all! A MenuMinute menu takes less than 1 megabyte of cache—a tiny fraction of a typical mobile app.",
      },
    ],
    relatedArticleSlugs: ["how-to-scan-qr", "browsing-and-searching"],
  },
];
