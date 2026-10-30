import type { RequestSummary, Section, TillSummary } from "./shell-data";

/** What the shell endpoint returns, as the browser sees it. */
export type ClientPulse = {
  pending: number;
  preparing: number;
  ready: number;
  active: number;
  completedToday: number;
};
export type ClientShellSnapshot = {
  outletId: string;
  checkedAt: string;
  pulse: Section<ClientPulse>;
  requests: Section<RequestSummary>;
  till: Section<TillSummary>;
};

export type ConnectionState = "live" | "reconnecting" | "offline";

export const STALE_AFTER_MS = 90_000;
export const TILL_STALE_AFTER_MS = 16 * 3_600_000;
export const REQUEST_URGENT_AFTER_MS = 10 * 60_000;

/**
 * - offline: the browser reports no network;
 * - reconnecting: the latest poll failed, or nothing has succeeded for a while;
 * - live: a recent poll succeeded.
 */
export function connectionState(input: {
  online: boolean;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  now: number;
}): ConnectionState {
  if (!input.online) return "offline";
  if (input.lastSuccessAt === null) return input.lastFailureAt === null ? "live" : "reconnecting";
  if (input.lastFailureAt !== null && input.lastFailureAt > input.lastSuccessAt)
    return "reconnecting";
  return input.now - input.lastSuccessAt > STALE_AFTER_MS ? "reconnecting" : "live";
}

export function ageLabel(iso: string | null, now: number): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? hours + " h ago" : Math.floor(hours / 24) + " d ago";
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string | null;
  count: number | null;
};

const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Alerts are derived from current state, not stored as events, so they can never be stale
 * after the situation is resolved. A source that is unavailable produces an explicit notice:
 * silence must never be mistaken for "all clear". A restricted source (no permission) is
 * simply absent, because it is not that user's concern.
 */
export function deriveAlerts(
  snapshot: ClientShellSnapshot | null,
  connection: ConnectionState,
  now: number
): AlertItem[] {
  const items: AlertItem[] = [];
  if (connection === "offline") {
    items.push({
      id: "connection",
      severity: "critical",
      title: "You are offline",
      detail: snapshot
        ? "Live updates are paused. The figures below were last updated " +
          ageLabel(snapshot.checkedAt, now) +
          "."
        : "Live updates are paused until you are back online.",
      href: null,
      count: null,
    });
  } else if (connection === "reconnecting") {
    items.push({
      id: "connection",
      severity: "warning",
      title: "Reconnecting",
      detail: snapshot
        ? "The latest refresh did not complete. Figures may be out of date (last updated " +
          ageLabel(snapshot.checkedAt, now) +
          ")."
        : "The latest refresh did not complete.",
      href: null,
      count: null,
    });
  }
  if (!snapshot) return items.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const { pulse, requests, till } = snapshot;
  if (pulse.state === "ready") {
    if (pulse.data.pending > 0)
      items.push({
        id: "orders-pending",
        severity: "warning",
        title:
          pulse.data.pending +
          plural(pulse.data.pending, " order awaits", " orders await") +
          " acceptance",
        detail: "New orders need a decision from staff.",
        href: "/dashboard/orders",
        count: pulse.data.pending,
      });
    if (pulse.data.ready > 0)
      items.push({
        id: "orders-ready",
        severity: "info",
        title:
          pulse.data.ready +
          plural(pulse.data.ready, " order is", " orders are") +
          " ready for handoff",
        detail: "Waiting to be served or collected.",
        href: "/dashboard/orders",
        count: pulse.data.ready,
      });
  } else if (pulse.state === "unavailable") {
    items.push({
      id: "orders-unavailable",
      severity: "warning",
      title: "Order activity is temporarily unavailable",
      detail: "Do not assume there are no waiting orders. Check the Orders page.",
      href: "/dashboard/orders",
      count: null,
    });
  }

  if (requests.state === "ready") {
    const waiting = requests.data.unacknowledged;
    const inProgress = requests.data.open - waiting;
    if (waiting > 0) {
      const oldest = requests.data.oldestAt ? Date.parse(requests.data.oldestAt) : NaN;
      const urgent = Number.isFinite(oldest) && now - oldest > REQUEST_URGENT_AFTER_MS;
      items.push({
        id: "requests-waiting",
        severity: urgent ? "critical" : "warning",
        title: waiting + plural(waiting, " guest request is", " guest requests are") + " waiting",
        detail: urgent
          ? "The longest wait is " + ageLabel(requests.data.oldestAt, now).replace(" ago", "") + "."
          : "Guests are asking for staff, water or the bill.",
        href: "/dashboard/floor",
        count: waiting,
      });
    }
    if (inProgress > 0)
      items.push({
        id: "requests-progress",
        severity: "info",
        title:
          inProgress + plural(inProgress, " guest request", " guest requests") + " in progress",
        detail: "Acknowledged and not yet resolved.",
        href: "/dashboard/floor",
        count: inProgress,
      });
  } else if (requests.state === "unavailable") {
    items.push({
      id: "requests-unavailable",
      severity: "warning",
      title: "Guest requests are temporarily unavailable",
      detail: "Do not assume no guest is waiting. Check the Dining floor.",
      href: "/dashboard/floor",
      count: null,
    });
  }

  if (till.state === "ready" && till.data.open && till.data.openedAt) {
    const opened = Date.parse(till.data.openedAt);
    if (Number.isFinite(opened) && now - opened > TILL_STALE_AFTER_MS)
      items.push({
        id: "till-stale",
        severity: "warning",
        title: "The till has been open for a long time",
        detail: "Opened " + ageLabel(till.data.openedAt, now) + ". Close it when service ends.",
        href: "/dashboard/pos/closing",
        count: null,
      });
  }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Things that need a person right now: new orders, waiting guests, and a broken feed. */
export function attentionCount(
  snapshot: ClientShellSnapshot | null,
  connection: ConnectionState
): number {
  let total = connection === "live" ? 0 : 1;
  if (snapshot?.pulse.state === "ready") total += snapshot.pulse.data.pending;
  if (snapshot?.requests.state === "ready") total += snapshot.requests.data.unacknowledged;
  return total;
}

/**
 * Newly arrived work between two successive successful reads of the same outlet. Used to
 * decide whether to chime; it never fires on first load, for another outlet, or when a source
 * was not readable in both snapshots.
 */
export function arrivals(
  previous: ClientShellSnapshot | null,
  next: ClientShellSnapshot
): { orders: number; requests: number } {
  if (!previous || previous.outletId !== next.outletId) return { orders: 0, requests: 0 };
  const orders =
    previous.pulse.state === "ready" && next.pulse.state === "ready"
      ? Math.max(0, next.pulse.data.pending - previous.pulse.data.pending)
      : 0;
  const requests =
    previous.requests.state === "ready" && next.requests.state === "ready"
      ? Math.max(0, next.requests.data.unacknowledged - previous.requests.data.unacknowledged)
      : 0;
  return { orders, requests };
}

export function formatMinor(minor: string, currency: string, locale?: string): string {
  let exponent = 2;
  try {
    exponent =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    return minor;
  }
  if (!/^-?\d{1,18}$/.test(minor)) return "—";
  const negative = minor.startsWith("-");
  const digits = (negative ? minor.slice(1) : minor).padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = exponent ? digits.slice(digits.length - exponent) : "";
  try {
    // Format from the exact integer string so large amounts never lose precision as a float.
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(Number((negative ? "-" : "") + whole + (fraction ? "." + fraction : "")));
  } catch {
    return (negative ? "-" : "") + whole + (fraction ? "." + fraction : "") + " " + currency;
  }
}
