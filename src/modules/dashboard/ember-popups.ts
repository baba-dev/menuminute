import type { ClientShellSnapshot } from "./notification-model";

/**
 * Transient, Ember-styled pop-ups derived from two successive successful shell reads of the same
 * outlet. They are a convenience layer on top of the notification drawer: nothing here is a
 * ledger, and a missed poll only means a missed pop-up, never a missed order.
 */
export const POPUP_KINDS = ["order", "cooking", "delivery", "payment"] as const;
export type PopupKind = (typeof POPUP_KINDS)[number];

/** Colour is one signal of three: each kind also has its own icon name and a text label. */
export const POPUP_META: Record<
  PopupKind,
  { label: string; icon: "bell" | "flame" | "bell-ring" | "wallet"; colour: string; legend: string }
> = {
  order: { label: "New order", icon: "bell", colour: "orange", legend: "Orange · new orders" },
  cooking: { label: "Cooking", icon: "flame", colour: "amber", legend: "Amber · cooking" },
  delivery: {
    label: "Ready",
    icon: "bell-ring",
    colour: "blue",
    legend: "Blue · ready or served",
  },
  payment: { label: "Payment", icon: "wallet", colour: "green", legend: "Green · payments" },
};

export type EmberPopup = {
  /** Stable per event so a re-poll never shows the same pop-up twice. */
  id: string;
  kind: PopupKind;
  title: string;
  detail?: string;
  href?: string;
};

export const POPUP_VISIBLE_MAX = 3;
export const POPUP_LIFETIME_MS = 5_000;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : n + " " + many);

/**
 * Pop-ups for what changed between two reads. Never fires on first load, for another outlet,
 * or for a source that was not readable in both reads. Bursts collapse to one pop-up per kind.
 */
export function popupsFromDiff(
  previous: ClientShellSnapshot | null,
  next: ClientShellSnapshot
): EmberPopup[] {
  if (!previous || previous.outletId !== next.outletId) return [];
  const out: EmberPopup[] = [];
  const stamp = next.checkedAt;
  if (previous.pulse.state === "ready" && next.pulse.state === "ready") {
    const a = previous.pulse.data;
    const b = next.pulse.data;
    const orders = b.pending - a.pending;
    if (orders > 0)
      out.push({
        id: "order:" + stamp,
        kind: "order",
        title: plural(orders, "1 new order", "new orders"),
        detail: "Waiting for acceptance",
        href: "/dashboard/orders",
      });
    const cooking = b.preparing - a.preparing;
    if (cooking > 0)
      out.push({
        id: "cooking:" + stamp,
        kind: "cooking",
        title: plural(cooking, "1 order", "orders") + " now cooking",
        href: "/dashboard/orders",
      });
    const ready = b.ready - a.ready;
    const served = b.completedToday - a.completedToday;
    if (ready > 0)
      out.push({
        id: "delivery:ready:" + stamp,
        kind: "delivery",
        title: plural(ready, "1 order", "orders") + " ready",
        detail: "Ready to serve or collect",
        href: "/dashboard/orders",
      });
    else if (served > 0)
      out.push({
        id: "delivery:served:" + stamp,
        kind: "delivery",
        title: plural(served, "1 order", "orders") + " served or collected",
        href: "/dashboard/orders",
      });
  }
  if (previous.payments?.state === "ready" && next.payments?.state === "ready") {
    const known = new Set(previous.payments.data.paid.map((order) => order.id));
    const fresh = next.payments.data.paid.filter((order) => !known.has(order.id));
    if (fresh.length > 0)
      out.push({
        id: "payment:" + stamp,
        kind: "payment",
        title:
          fresh.length === 1
            ? "Order #" + fresh[0]!.orderNumber + " paid"
            : fresh.length + " orders paid",
        detail: "Payment recorded by staff",
        href: "/dashboard/orders",
      });
  }
  return out;
}

/** Newest first, no duplicate ids, and never more than the visible maximum. */
export function pushPopup(current: EmberPopup[], incoming: EmberPopup[]): EmberPopup[] {
  const seen = new Set(current.map((popup) => popup.id));
  const added = incoming.filter((popup) => !seen.has(popup.id));
  return [...added, ...current].slice(0, POPUP_VISIBLE_MAX);
}

export type PopupPreference = { enabled: boolean; kinds: Record<PopupKind, boolean> };
export const defaultPopupPreference: PopupPreference = {
  enabled: true,
  kinds: { order: true, cooking: true, delivery: true, payment: true },
};

export function parsePopupPreference(raw: string | null): PopupPreference {
  if (!raw) return defaultPopupPreference;
  try {
    const value = JSON.parse(raw) as { enabled?: unknown; kinds?: Record<string, unknown> };
    const kinds = { ...defaultPopupPreference.kinds };
    for (const kind of POPUP_KINDS) {
      if (typeof value.kinds?.[kind] === "boolean") kinds[kind] = value.kinds[kind] as boolean;
    }
    return { enabled: typeof value.enabled === "boolean" ? value.enabled : true, kinds };
  } catch {
    return defaultPopupPreference;
  }
}
