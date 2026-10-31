import Image from "next/image";

/**
 * These captures are generated from the isolated MenuMinute demo environment.
 * They are shared with /docs and verified by scripts/verify-docs-media.mjs on
 * the merge build; never duplicate the binaries inside the Help Center.
 */
export const HELP_SCREENSHOTS = {
  "getting-started": {
    id: "dashboard",
    alt: "MenuMinute restaurant dashboard with navigation and overview panels",
    caption: "Restaurant dashboard and the main navigation",
  },
  "menu-studio": {
    id: "menu-studio",
    alt: "Menu Studio interface for reviewing and editing restaurant dishes",
    caption: "Menu Studio: find, edit and review dishes before publishing",
  },
  "ai-menu-import": {
    id: "menu-import",
    alt: "MenuMinute menu import review interface in the demo environment",
    caption: "Menu import review workspace — not available in the public demo",
  },
  "qr-codes-and-tables": {
    id: "qr-studio",
    alt: "QR Studio interface for managing restaurant menu QR codes",
    caption: "QR Studio for creating and reviewing menu QR materials",
  },
  "kitchen-display-system": {
    id: "kitchen",
    alt: "Kitchen Pro station dashboard showing routed preparation tickets",
    caption: "Kitchen Pro station view — requires an enabled kitchen",
  },
  "live-orders-and-service": {
    id: "orders",
    alt: "MenuMinute orders dashboard showing restaurant order tickets",
    caption: "Orders dashboard for accepting and tracking tickets",
  },
  "table-floor-matrix": {
    id: "floor",
    alt: "Dining floor overview showing service tables and their activity",
    caption: "Dining floor and table activity",
  },
  "reports-and-analytics": {
    id: "reports",
    alt: "Restaurant reports dashboard with performance summaries",
    caption: "Restaurant reports and performance overview",
  },
  "ember-assistant-and-settings": {
    id: "ember",
    alt: "Ember assistant panel inside a MenuMinute restaurant workspace",
    caption: "Ember assistant — availability depends on the configured provider",
  },
  "how-to-scan-qr": {
    id: "demo-hub",
    alt: "MenuMinute demo page showing its guest-menu QR code",
    caption: "Public QR code on the MenuMinute demo page",
  },
  "browsing-and-searching": {
    id: "public-menu",
    alt: "Guest-facing sample restaurant menu with categories and dishes",
    caption: "The menu a guest sees after opening a restaurant QR link",
  },
  "customizing-dishes": {
    id: "public-menu-dish",
    alt: "Guest dish-details screen showing choices and meal options",
    caption: "Dish details and available choices in the guest menu",
  },
  "placing-orders": {
    id: "public-menu-dish",
    alt: "Guest dish-details screen where a diner reviews choices before ordering",
    caption: "Selecting dish options before adding a meal to an order",
  },
} as const;

export type HelpScreenshot = (typeof HELP_SCREENSHOTS)[keyof typeof HELP_SCREENSHOTS];

export function getHelpScreenshot(slug: string): HelpScreenshot | undefined {
  return Object.prototype.hasOwnProperty.call(HELP_SCREENSHOTS, slug)
    ? HELP_SCREENSHOTS[slug as keyof typeof HELP_SCREENSHOTS]
    : undefined;
}

export function HelpScreenshotFigure({ screenshot }: { screenshot: HelpScreenshot }) {
  const base = `/docs-media/${screenshot.id}`;
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="overflow-hidden bg-stone-100 dark:bg-stone-950">
        <Image
          src={`${base}-mobile-light.webp`}
          alt={`${screenshot.alt} (mobile layout)`}
          width={390}
          height={844}
          sizes="100vw"
          className="mx-auto block h-auto w-full max-w-sm sm:hidden"
          loading="lazy"
        />
        <Image
          src={`${base}-desktop-light.webp`}
          alt={screenshot.alt}
          width={1200}
          height={750}
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="hidden h-auto w-full sm:block dark:sm:hidden"
          loading="lazy"
        />
        <Image
          src={`${base}-desktop-dark.webp`}
          alt={`${screenshot.alt} (dark appearance)`}
          width={1200}
          height={750}
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="hidden h-auto w-full dark:sm:block"
          loading="lazy"
        />
      </div>
      <figcaption className="border-t border-stone-100 px-5 py-3 text-center text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:text-stone-300">
        <strong className="font-semibold">Demo interface capture.</strong> {screenshot.caption}.
        Screens and available features may differ by restaurant and deployment.
      </figcaption>
    </figure>
  );
}
