/**
 * Service milestones are derived only from the authoritative `completedToday` counter
 * returned by a successful pulse read. They are currency-neutral on purpose: outlets
 * trade in any supported local currency, so revenue thresholds need a per-outlet goal.
 */
export type MilestoneId = "first-order" | "orders-25" | "orders-50" | "orders-100";

export type Milestone = { id: MilestoneId; threshold: number; title: string; detail: string };

export const orderMilestones: readonly Milestone[] = [
  {
    id: "first-order",
    threshold: 1,
    title: "First order out the door",
    detail: "Your first completed order of the day is in the books.",
  },
  {
    id: "orders-25",
    threshold: 25,
    title: "25 orders served today",
    detail: "Service has found its rhythm. Keep the pass moving.",
  },
  {
    id: "orders-50",
    threshold: 50,
    title: "50 orders served today",
    detail: "A busy day, and your team is carrying it.",
  },
  {
    id: "orders-100",
    threshold: 100,
    title: "100 orders served today",
    detail: "A century of orders. Worth a moment to thank the team.",
  },
];

/**
 * The single most significant milestone crossed between two successive successful reads.
 * Returns null when nothing was crossed, so a page that loads above a threshold never
 * replays it and a counter that falls (new business day) never fires.
 */
export function crossedMilestone(previous: number | null, next: number): Milestone | null {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(next)) return null;
  if (next <= previous) return null;
  const crossed = orderMilestones.filter((m) => previous < m.threshold && next >= m.threshold);
  return crossed.at(-1) ?? null;
}

/** Calendar date (YYYY-MM-DD) in the outlet's own timezone; falls back to UTC if invalid. */
export function outletLocalDate(at: string | Date, timezone: string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function milestoneStorageKey(outletId: string, localDate: string, id: MilestoneId) {
  return `menuminute.milestone.${outletId}.${localDate}.${id}`;
}

/** Per-viewer convenience only: storage may be blocked or empty, so every access is guarded. */
export function hasSeenMilestone(
  storage: Pick<Storage, "getItem"> | null,
  key: string,
  sessionSeen: Set<string>
): boolean {
  if (sessionSeen.has(key)) return true;
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markMilestoneSeen(
  storage: Pick<Storage, "setItem"> | null,
  key: string,
  sessionSeen: Set<string>
) {
  sessionSeen.add(key);
  try {
    storage?.setItem(key, "1");
  } catch {
    // The in-memory set still prevents a repeat during this page session.
  }
}
