import type { BillingCurrency } from "@/modules/billing/catalog";
import type { PlanKey } from "./catalog";

/**
 * What a visitor can actually do about each plan right now. Pure: no I/O, no React.
 *
 * Prices and limits are always the reviewed catalog values (`./offer`). This module decides only the
 * *call to action*, so a public button can never promise a purchase the deployment cannot complete.
 * The facts come from the same switches that checkout enforces (`./sale-facts`); the server remains
 * the authority and `/billing` repeats the check against the database before any charge.
 *
 * | state          | meaning                                                               |
 * | -------------- | --------------------------------------------------------------------- |
 * | `free`         | the plan costs nothing; sign up                                        |
 * | `checkout`     | the owner can subscribe from Billing today                            |
 * | `opening_soon` | the feature works on Free, but self-service paid checkout is not open |
 * | `early_access` | not self-serve yet; request it and the team enables it by hand        |
 * | `contact`      | sold by conversation (Dedicated, and USD which has no checkout)       |
 * | `community`    | self-hosted Community Edition: everything is already unlocked         |
 */
export type SaleState =
  "free" | "checkout" | "opening_soon" | "early_access" | "contact" | "community";

export type SaleFacts = {
  /** Self-hosted Community Edition: all features unlocked, no subscriptions. */
  community: boolean;
  /** Ordering checkout can start: payments enabled and the Ordering provider plan configured. */
  checkoutOpen: boolean;
  /** Kitchen Pro checkout can start: Ordering checkout plus the independent Kitchen release switch. */
  kitchenCheckoutOpen: boolean;
};

/** The conservative default used whenever availability cannot be determined: nothing is purchasable. */
export const NOTHING_FOR_SALE: SaleFacts = {
  community: false,
  checkoutOpen: false,
  kitchenCheckoutOpen: false,
};

export type PlanSale = {
  state: SaleState;
  /** Button text. */
  label: string;
  /** Always a real, same-origin destination. Never `#`. */
  href: string;
  /** One short, honest sentence shown under the button, or null when nothing needs saying. */
  note: string | null;
};

export function planSale(plan: PlanKey, currency: BillingCurrency, facts: SaleFacts): PlanSale {
  if (plan === "free")
    return { state: "free", label: "Get started free", href: "/register", note: null };

  if (plan === "dedicated")
    return {
      state: "contact",
      label: currency === "USD" ? "Discuss private deployment" : "Talk to us about Dedicated",
      href: "/contact",
      note: null,
    };

  // USD is published as a price book only: no checkout can charge it, so it is always an enquiry.
  if (currency === "USD")
    return { state: "contact", label: "Ask about USD billing", href: "/contact", note: null };

  if (facts.community)
    return {
      state: "community",
      label: "Included in Community Edition",
      href: "/register",
      note: "Self-hosted editions have every feature unlocked.",
    };

  if (plan === "ordering") {
    if (facts.checkoutOpen)
      return {
        state: "checkout",
        label: "Get Ordering",
        href: "/billing?plan=ordering",
        note: null,
      };
    return {
      state: "opening_soon",
      label: "Start free for now",
      href: "/register",
      note: "Paid checkout is opening soon. Start with a free menu, then upgrade from Billing when it opens.",
    };
  }

  if (facts.kitchenCheckoutOpen)
    return {
      state: "checkout",
      label: "Get Kitchen Pro",
      href: "/billing?plan=kitchen_pro",
      note: null,
    };
  return {
    state: "early_access",
    label: "Request early access",
    href: "/contact?topic=kitchen-pro",
    note: "Kitchen Pro is available by request while self-service checkout is being finalised.",
  };
}

/** The sentence under the plan cards; it must agree with the buttons above it. */
export function saleFootnote(currency: BillingCurrency, facts: SaleFacts): string {
  if (currency === "USD")
    return "USD plans are published for international enquiries. USD checkout is not yet active; no USD card charges can be initiated from this page.";
  if (facts.community) return "Self-hosted Community Edition has every feature unlocked.";
  if (facts.checkoutOpen)
    return "Current self-service checkout charges in INR. USD plan requests are available in the USD tab.";
  return "Self-service paid checkout is not open yet. Free menus work today, and paid plans will be available from Billing once checkout opens. USD plan requests are available in the USD tab.";
}

/** Topics the contact page understands, so a pricing button can pre-fill the right enquiry. */
export const CONTACT_TOPICS = {
  "kitchen-pro": {
    subject: "Kitchen Pro early access",
    heading: "Request Kitchen Pro early access",
    body: "Tell us your outlet name, how many outlets you run, and how many kitchen screens you need. We will enable Kitchen Pro for your outlet while self-service checkout is being finalised.",
  },
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export function parseContactTopic(value: string | string[] | undefined): ContactTopic | null {
  return typeof value === "string" && Object.hasOwn(CONTACT_TOPICS, value)
    ? (value as ContactTopic)
    : null;
}
