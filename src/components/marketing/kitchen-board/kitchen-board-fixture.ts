/**
 * Copy for the kitchen board (home-v2 section 3). Statements describe the preview or behaviour the
 * product code already has. Kitchen Pro is activated per outlet after approval (see /pricing), so the
 * copy says that and does not promise instant or universal availability.
 * Every `href` is an existing public page (checked by tests/kitchen-board.test.ts).
 */
export type KitchenCard = { title: string; body: string; href: string; cta: string };

export const KITCHEN_CARDS: readonly KitchenCard[] = [
  {
    title: "One ticket, every station",
    body: "Dishes can be routed to kitchen stations, so each cook sees their part of the order. Kitchen areas appear when your plan includes them.",
    href: "/pricing",
    cta: "See what plans include",
  },
  {
    title: "Guests stay informed",
    body: "A clearer journey after the order is sent: sent, accepted, preparing, ready. The guest view here is an illustration.",
    href: "/demo",
    cta: "Try the live demo",
  },
  {
    title: "You stay in control",
    body: "Orders are requests. The restaurant accepts or declines each one.",
    href: "/help/owner",
    cta: "Read the owner guide",
  },
];

export const KITCHEN_NOTE =
  "Sample tickets and a sample clock (one second is one minute); no real orders are placed on this page. Kitchen Pro is activated per outlet after approval, and the areas you see depend on your plan.";
