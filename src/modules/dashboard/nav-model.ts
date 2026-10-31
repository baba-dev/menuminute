import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";

/**
 * Single source of truth for workspace destinations. The sidebar, the mobile bottom bar and
 * the command palette all derive from this, so availability rules cannot drift apart.
 * Pure on purpose: no React, no I/O.
 */
export type NavId =
  | "overview"
  | "orders"
  | "pos"
  | "kitchen"
  | "floor"
  | "menu"
  | "qr"
  | "reports"
  | "organization"
  | "settings";

export type NavGroupId = "run" | "menu" | "insights" | "admin";
export type NavIcon =
  | "layout"
  | "orders"
  | "pos"
  | "kitchen"
  | "floor"
  | "menu"
  | "qr"
  | "reports"
  | "organization"
  | "settings";

type Gate = "ordering" | "kitchen" | null;

export type NavItem = {
  id: NavId;
  href: string;
  label: string;
  /** Short label for the cramped mobile bar. The accessible name stays the full label. */
  shortLabel: string;
  group: NavGroupId | null;
  icon: NavIcon;
  gate: Gate;
  keywords: string[];
};

export const navGroups: readonly { id: NavGroupId; label: string }[] = [
  { id: "run", label: "Run service" },
  { id: "menu", label: "Menu" },
  { id: "insights", label: "Insights" },
  { id: "admin", label: "Admin" },
];

export const navItems: readonly NavItem[] = [
  {
    id: "overview",
    href: "/dashboard",
    label: "Overview",
    shortLabel: "Home",
    group: null,
    icon: "layout",
    gate: null,
    keywords: ["home", "dashboard"],
  },
  {
    id: "orders",
    href: "/dashboard/orders",
    label: "Orders",
    shortLabel: "Orders",
    group: "run",
    icon: "orders",
    gate: "ordering",
    keywords: ["service counter", "tickets"],
  },
  {
    id: "pos",
    href: "/dashboard/pos",
    label: "Point of Sale",
    shortLabel: "Till",
    group: "run",
    icon: "pos",
    gate: null,
    keywords: ["till", "register", "cash", "sale"],
  },
  {
    id: "kitchen",
    href: "/kitchen",
    label: "Kitchen",
    shortLabel: "Kitchen",
    group: "run",
    icon: "kitchen",
    gate: "kitchen",
    keywords: ["stations", "chef", "kds", "display"],
  },
  {
    id: "floor",
    href: "/dashboard/floor",
    label: "Dining floor",
    shortLabel: "Floor",
    group: "run",
    icon: "floor",
    gate: "ordering",
    keywords: ["tables", "dining room", "service requests", "guest requests"],
  },
  {
    id: "menu",
    href: "/dashboard/menu",
    label: "Menu Studio",
    shortLabel: "Menu",
    group: "menu",
    icon: "menu",
    gate: null,
    keywords: ["dishes", "categories", "publish", "edit menu"],
  },
  {
    id: "qr",
    href: "/dashboard/qr-codes",
    label: "QR codes",
    shortLabel: "QR",
    group: "menu",
    icon: "qr",
    gate: null,
    keywords: ["print", "table tent", "scan"],
  },
  {
    id: "reports",
    href: "/dashboard/reports",
    label: "Reports & Insights",
    shortLabel: "Reports",
    group: "insights",
    icon: "reports",
    gate: "ordering",
    keywords: ["sales", "z-report", "analytics", "menu engineering"],
  },
  {
    id: "organization",
    href: "/dashboard/organization",
    label: "Organization & access",
    shortLabel: "Team",
    group: "admin",
    icon: "organization",
    gate: null,
    keywords: ["team", "staff", "roles", "invite", "billing"],
  },
  {
    id: "settings",
    href: "/dashboard/settings",
    label: "Settings",
    shortLabel: "Settings",
    group: "admin",
    icon: "settings",
    gate: null,
    keywords: ["outlet", "profile", "hours", "tax", "currency"],
  },
];

export type UnavailableReason = "not-enabled" | "access-required" | "unknown";
export type NavState =
  | { state: "available"; label: string }
  | { state: "unavailable"; reason: UnavailableReason; label: string };

/**
 * Preserves the long-standing gating rules exactly:
 * - ordering-gated items need the entitlement AND orders.read;
 * - the kitchen is usable when operational or in setup, and is labelled "Kitchen Setup"
 *   until it is operational;
 * - when capabilities could not be read, gated items are "unknown", never "not enabled".
 */
export function navState(item: NavItem, capabilities: DashboardNavigation | undefined): NavState {
  if (item.gate === null) return { state: "available", label: item.label };
  if (item.gate === "kitchen") {
    if (!capabilities) return { state: "unavailable", reason: "unknown", label: item.label };
    const usable = capabilities.kitchenOperational || capabilities.kitchenSetup;
    const label =
      capabilities.kitchenSetup && !capabilities.kitchenOperational ? "Kitchen Setup" : item.label;
    return usable
      ? { state: "available", label }
      : { state: "unavailable", reason: "not-enabled", label };
  }
  if (!capabilities) return { state: "unavailable", reason: "unknown", label: item.label };
  if (!capabilities.ordering)
    return { state: "unavailable", reason: "not-enabled", label: item.label };
  if (!capabilities.ordersRead)
    return { state: "unavailable", reason: "access-required", label: item.label };
  return { state: "available", label: item.label };
}

export type ResolvedNavItem = NavItem & { nav: NavState };

export function resolveNavigation(
  capabilities: DashboardNavigation | undefined
): ResolvedNavItem[] {
  return navItems.map((item) => ({ ...item, nav: navState(item, capabilities) }));
}

export type GroupedNavigation = {
  overview: ResolvedNavItem;
  groups: { id: NavGroupId; label: string; items: ResolvedNavItem[] }[];
  /** Known-unavailable items collapse here. "Unknown" items stay in place, disabled. */
  addOns: ResolvedNavItem[];
};

export function groupNavigation(capabilities: DashboardNavigation | undefined): GroupedNavigation {
  const resolved = resolveNavigation(capabilities);
  const addOns = resolved.filter(
    (item) => item.nav.state === "unavailable" && item.nav.reason !== "unknown"
  );
  const inAddOns = new Set(addOns.map((item) => item.id));
  return {
    overview: resolved.find((item) => item.id === "overview")!,
    groups: navGroups
      .map((group) => ({
        ...group,
        items: resolved.filter((item) => item.group === group.id && !inAddOns.has(item.id)),
      }))
      .filter((group) => group.items.length > 0),
    addOns,
  };
}

export function addOnHint(item: ResolvedNavItem): string {
  if (item.nav.state !== "unavailable") return "";
  if (item.nav.reason === "access-required")
    return "Your role does not include this. Ask an administrator for access.";
  if (item.id === "kitchen") return "Kitchen Pro is not enabled for your plan yet.";
  return "Part of the ordering add-on. Upgrade to enable it.";
}

export function isNavSelected(item: Pick<NavItem, "href">, pathname: string): boolean {
  return item.href === "/dashboard"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Mobile bottom bar: Orders, Till, Kitchen and Floor when the user can use them, then More.
 * An outlet without ordering would otherwise get a nearly empty bar, so it is back-filled with
 * Overview, Menu and QR codes until there are at least three destinations.
 */
export function bottomBarItems(capabilities: DashboardNavigation | undefined): ResolvedNavItem[] {
  const resolved = resolveNavigation(capabilities);
  const pick = (ids: NavId[]) =>
    ids
      .map((id) => resolved.find((item) => item.id === id)!)
      .filter((item) => item.nav.state === "available");
  const primary = pick(["orders", "pos", "kitchen", "floor"]);
  if (primary.length >= 3) return primary;
  const filler = pick(["overview", "menu", "qr"]).filter(
    (item) => !primary.some((p) => p.id === item.id)
  );
  const needed = Math.max(0, 4 - primary.length);
  const chosen = filler.slice(0, needed);
  // Keep Overview first so "home" is always one tap away.
  return [
    ...chosen.filter((item) => item.id === "overview"),
    ...primary,
    ...chosen.filter((item) => item.id !== "overview"),
  ];
}

/** Everything available that the bar does not show; listed in the More sheet. */
export function moreItems(capabilities: DashboardNavigation | undefined): ResolvedNavItem[] {
  const onBar = new Set(bottomBarItems(capabilities).map((item) => item.id));
  return resolveNavigation(capabilities).filter(
    (item) => item.nav.state === "available" && !onBar.has(item.id)
  );
}
