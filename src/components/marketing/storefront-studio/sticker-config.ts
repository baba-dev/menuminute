/** Public demo only: never substitute a private tenant or an unapproved QR destination. */
export const STICKER_DEMO_URL = "https://food.bababuilds.com/m/demo-spice-route-kitchen-v1";

export const STICKER_FORMATS = [
  {
    id: "primary",
    number: "01",
    name: "Primary QR",
    short: "The unmistakable menu marker",
    detail: "A high-contrast rectangle for a restaurant's front window.",
  },
  {
    id: "circular",
    number: "02",
    name: "Circular",
    short: "A friendly invitation to scan",
    detail: "An eye-catching round decal for glass and entrances.",
  },
  {
    id: "cling",
    number: "03",
    name: "Door cling",
    short: "Made for the way in",
    detail: "A tall, elegant composition suited to glass entrance doors.",
  },
  {
    id: "premium",
    number: "04",
    name: "Premium window",
    short: "A bold storefront statement",
    detail: "A landscape presentation that draws attention from outside.",
  },
  {
    id: "hours",
    number: "05",
    name: "Opening hours",
    short: "Useful information, beautifully placed",
    detail: "A sample-hours concept alongside a browse-menu QR, with example hours only.",
  },
  {
    id: "compact",
    number: "06",
    name: "Compact",
    short: "Small space, big welcome",
    detail: "An easy-to-notice choice for smaller windows and counters.",
  },
] as const;

export type StickerFormat = (typeof STICKER_FORMATS)[number]["id"];
export const MOUNTING_SURFACES = [
  { id: "window", name: "Window" },
  { id: "door", name: "Glass door" },
  { id: "counter", name: "Countertop" },
] as const;
export type MountingSurface = (typeof MOUNTING_SURFACES)[number]["id"];
