import type { HelpFaqItem } from "./contracts";

export const allFaqs: HelpFaqItem[] = [
  // General & Pricing
  {
    category: "General & Pricing",
    question: "Is MenuMinute really free to start?",
    answer:
      "Yes! Creating and publishing your digital menu with permanent QR codes is completely free forever. There is zero commission on your orders, no credit card required to sign up, and no hidden surprises.",
  },
  {
    category: "General & Pricing",
    question: "How does MenuMinute make money if the basic plan is free?",
    answer:
      "We offer optional advanced capabilities for busy restaurants, such as Kitchen Pro kitchen screens, AI photo menu scanning, multi-outlet management, and priority support. You can choose to upgrade whenever your restaurant grows.",
  },
  {
    category: "General & Pricing",
    question: "Can I manage multiple restaurants under one account?",
    answer:
      "Yes. You can create and manage multiple outlets from a single organization dashboard. Each location has its own independent menus, tables, staff, and operating hours.",
  },

  // QR Codes & Tables
  {
    category: "QR Codes & Tables",
    question: "Do I have to re-print table QR stickers when I change a price or add dishes?",
    answer:
      "Usually no. Updating a published menu does not change its saved QR destination. If you delete or replace the QR connection, you may need a new print.",
  },
  {
    category: "QR Codes & Tables",
    question: "What is the difference between a Table QR and an Entrance QR?",
    answer:
      "A Table QR is tied to a specific table (e.g. Table 4). When guests order or tap 'Call Waiter', staff and kitchen see 'Table 4' automatically. An Entrance QR is generic, perfect for storefront windows or takeout counters where guests order for pickup.",
  },
  {
    category: "QR Codes & Tables",
    question: "What kind of paper or sticker material works best for tables?",
    answer:
      "We recommend waterproof synthetic vinyl stickers with a matte lamination coating. Matte finishes prevent bright restaurant lighting from glaring into diners' smartphone cameras, making scans instant.",
  },

  // Menu Creation & Dishes
  {
    category: "Menu & Food",
    question: "What is the difference between a Draft menu and a Published menu?",
    answer:
      "Edits made in Menu Studio are saved as a private Draft first. Diners viewing your menu won't see your in-progress changes until you hit 'Publish'. This lets you comfortably prepare seasonal items or price tweaks without disrupting active diners.",
  },
  {
    category: "Menu & Food",
    question: "How do I mark a dish sold out?",
    answer:
      "Use the dish availability controls to mark an item sold out. Guests opening or refreshing the live menu can then see that it is unavailable.",
  },
  {
    category: "Menu & Food",
    question: "Can I offer dish modifiers like extra cheese or salad dressing choices?",
    answer:
      "Yes! You can configure required choices (e.g. Choose 1: Fries or Salad) and optional add-ons (e.g. Extra Avocado +$2.00) with custom prices in the dish editor.",
  },

  // Kitchen & Hardware
  {
    category: "Hardware & Kitchen",
    question: "What devices do I need for Kitchen Pro?",
    answer:
      "Any standard tablet or screen with a web browser works! Most restaurants use standard 10-inch Android tablets or iPads mounted with a protective cover near the cook line or expo pass.",
  },
  {
    category: "Hardware & Kitchen",
    question: "Can I connect a thermal receipt printer?",
    answer:
      "MenuMinute offers 80 mm and 58 mm print layouts. Printing uses the browser's print dialog, so compatibility and setup depend on your printer, operating system and connection.",
  },

  // Guest Experience
  {
    category: "Diner & Guest Experience",
    question: "Do diners have to download an app or create an account?",
    answer:
      "No! Diners simply point their phone's camera at the QR code. The menu opens instantly in Safari, Chrome, or any mobile browser with zero app installation and zero login required.",
  },
  {
    category: "Diner & Guest Experience",
    question: "What happens if a customer has poor mobile reception in our restaurant?",
    answer:
      "Eligible public menu pages may be saved by the browser after a visit. Saved images and menu availability cannot be guaranteed; guests need a connection to submit orders.",
  },
  {
    category: "Diner & Guest Experience",
    question: "Can customers call the waiter from their phone?",
    answer:
      "When the restaurant enables table assistance, guests can send a waiter or bill request. Staff can review the request from their service workspace when connected.",
  },
  {
    category: "Point of Sale",
    question: "Does Mark as Paid charge a customer's card?",
    answer:
      "No. Mark as Paid records that staff received payment outside MenuMinute. It does not charge a card, confirm bank settlement, or issue a tax-approved invoice.",
  },
];
