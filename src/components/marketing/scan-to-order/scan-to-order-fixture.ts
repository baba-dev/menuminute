/**
 * Marketing fixture for "Scan, tap, ordered". Sample data only: nothing here is a customer's menu,
 * and no dish carries an allergen, dietary or nutrition claim. Names and prices are the public demo
 * outlet's (the same dishes and unit prices the home-v2 dashboard replica reports as top sellers).
 */

export type SampleDish = {
  id: string;
  name: string;
  category: "mains" | "rice-and-grills";
  priceMinor: number;
  /** Rank in the sample top-sellers list; lower is more popular. */
  popularity: number;
  blurb: string;
  /** Always false: sample dishes carry no verified allergen or free-from information. */
  verified: false;
};

export const SAMPLE_DISHES: readonly SampleDish[] = [
  {
    id: "MM-CORE-butter-chicken",
    name: "Butter Chicken",
    category: "mains",
    priceMinor: 39900,
    popularity: 1,
    blurb: "A creamy tomato curry, a sample dish from the demo menu.",
    verified: false,
  },
  {
    id: "MM-CORE-biryani",
    name: "Biryani",
    category: "rice-and-grills",
    priceMinor: 27900,
    popularity: 2,
    blurb: "Layered rice, a sample dish from the demo menu.",
    verified: false,
  },
  {
    id: "MM-IN-045",
    name: "Chettinad Chicken",
    category: "mains",
    priceMinor: 40900,
    popularity: 3,
    blurb: "A pepper-forward curry, a sample dish from the demo menu.",
    verified: false,
  },
  {
    id: "MM-IN-013",
    name: "Amritsari Fish",
    category: "rice-and-grills",
    priceMinor: 35900,
    popularity: 4,
    blurb: "Crisp fried fish, a sample dish from the demo menu.",
    verified: false,
  },
] as const;

export const SAMPLE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "mains", label: "Mains" },
  { id: "rice-and-grills", label: "Rice & grills" },
] as const;

export type SortId = "popular" | "price";
export const SAMPLE_SORTS: readonly { id: SortId; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "price", label: "Price: low to high" },
];

export const SAMPLE_OUTLET_NAME = "Spice Route Kitchen";
export const SAMPLE_TABLE = "Table 11";
export const SAMPLE_LOCALE = "en-IN";

export function sampleDish(id: string): SampleDish | undefined {
  return SAMPLE_DISHES.find((dish) => dish.id === id);
}

export function arrangeDishes(category: string, sort: SortId): SampleDish[] {
  const visible = SAMPLE_DISHES.filter((dish) => category === "all" || dish.category === category);
  return [...visible].sort((a, b) =>
    sort === "price" ? a.priceMinor - b.priceMinor : a.popularity - b.popularity
  );
}

/** Whole-currency formatter for a minor-unit amount in the sample outlet's currency (INR). */
export function formatInr(minor: number): string {
  return new Intl.NumberFormat(SAMPLE_LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

/**
 * The same sample dish priced by outlets in different countries. These are illustrative price points
 * (each outlet sets its own price in its own currency), not exchange rates or conversions.
 */
export const CURRENCY_SAMPLES = [
  { code: "INR", label: "India", symbol: "₹", amount: 399 },
  { code: "AED", label: "UAE", symbol: "AED ", amount: 42 },
  { code: "USD", label: "United States", symbol: "$", amount: 14 },
  { code: "EUR", label: "Germany", symbol: "€", amount: 13 },
] as const;

export type CapabilityCard = { title: string; body: string; href: string; cta: string };

/**
 * Every `href` is an existing public page (checked by tests/scan-to-order.test.ts). Statements
 * describe the preview or existing product behaviour and make no availability promise.
 */
export const CAPABILITY_CARDS: readonly CapabilityCard[] = [
  {
    title: "One QR that stays put",
    body: "Each published menu has a QR link that does not change when you edit dishes or prices.",
    href: "/help/owner",
    cta: "How QR menus work",
  },
  {
    title: "Requests you control",
    body: "Ordering is in development. A guest's order is a request, and the restaurant accepts or declines it.",
    href: "/demo",
    cta: "Try the live demo",
  },
  {
    title: "Your own currency",
    body: "Outlets sell in their local currency. USD and INR apply only to MenuMinute subscription billing.",
    href: "/pricing",
    cta: "See plans",
  },
];

export const SCAN_TO_ORDER_NOTE =
  "Preview with a sample menu. No real orders or payments are placed, and sample dishes carry no allergen or dietary claims.";
