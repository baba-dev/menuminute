import { PLAN_LABELS, PLAN_LIMITS, type PlanKey, type PlanLimits } from "./catalog";

/**
 * Pure view model for the plan usage UI (slice 2c). No I/O, no React.
 * Only limits that are really enforced are shown as meters: dishes and QR codes always, and the
 * monthly order allowance only while Free order intake is switched on. AI credits, storage and
 * seats are deliberately absent until something enforces them, so the UI never advertises a
 * limit that does not exist.
 */
export type MeterKey = "outlets" | "dishes" | "qrCodes" | "tables" | "chairs" | "orders";
/** ok < 80% · near 80–99% · full = cap · over > cap (existing data above a newly applied cap). */
export type MeterState = "ok" | "near" | "full" | "over";

export type UsageMeterView = {
  key: MeterKey;
  label: string;
  /** Singular noun phrase for assistive text, e.g. "dishes". */
  noun: string;
  used: number;
  cap: number;
  state: MeterState;
  /** Whole-number percentage of the bar to fill, clamped to 0–100. */
  percent: number;
  /** Short human status; the state is never conveyed by colour alone. */
  statusText: string;
  /** Optional extra context such as the monthly reset. */
  period?: string;
  /** What the next plan allows, e.g. "Ordering allows 200". Only set once usage is near the cap. */
  upgradeHint?: string;
  /** Plain-language consequence of being over the cap (grace period or hidden dishes). */
  notice?: string;
};

export type FeatureStatus = "included" | "limited" | "locked";
export type PlanFeatureRow = {
  key: "menu" | "ordering" | "kitchen";
  label: string;
  status: FeatureStatus;
  note: string;
  /** Plan that unlocks the feature, when it is not already included. */
  unlockWith: string | null;
};

export type PlanUsageView = {
  plan: PlanKey;
  planLabel: string;
  meters: UsageMeterView[];
  features: PlanFeatureRow[];
  nextPlanLabel: string | null;
};

export type UsageCounts = {
  outlets: number;
  dishes: number;
  qrCodes: number;
  tables: number;
  chairs: number;
};
export type IntakeSnapshot = { enabled: boolean; used: number; cap: number };
/** Present only while an outlet is over its dish cap and overflow hiding is switched on. */
export type OverflowSnapshot = { cap: number; count: number; graceUntil: string; hidden: number };

export function meterState(used: number, cap: number): MeterState {
  if (used > cap) return "over";
  if (used === cap) return "full";
  return cap > 0 && used / cap >= 0.8 ? "near" : "ok";
}

/** Fixed locale: identical on the server and in the browser, so hydration never differs. */
export const fmt = (n: number) => n.toLocaleString("en-US");

function statusText(state: MeterState, used: number, cap: number): string {
  if (state === "full") return "Limit reached";
  if (state === "over") return `${fmt(used - cap)} over the limit`;
  return `${fmt(cap - used)} left`;
}

/** Fixed locale and zone so the server and the browser print the same text. */
export const fmtDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

/** What being over the dish cap means right now. Nothing is deleted in either state. */
export function overflowNotice(o: OverflowSnapshot): string {
  return o.hidden > 0
    ? `${fmt(o.hidden)} ${o.hidden === 1 ? "dish is" : "dishes are"} hidden from guests. They are safe and come back when your plan allows or you free up space.`
    : `After ${fmtDate(o.graceUntil)}, dishes beyond the first ${fmt(o.cap)} are hidden from guests. Nothing is deleted.`;
}

export function buildMeter(
  key: MeterKey,
  label: string,
  noun: string,
  used: number,
  cap: number,
  period?: string,
  upgradeHint?: string
): UsageMeterView {
  const safeUsed = Math.max(0, Math.floor(used));
  const state = meterState(safeUsed, cap);
  return {
    key,
    label,
    noun,
    used: safeUsed,
    cap,
    state,
    percent: cap > 0 ? Math.min(100, Math.round((safeUsed / cap) * 100)) : 100,
    statusText: statusText(state, safeUsed, cap),
    period,
    ...(state !== "ok" && upgradeHint ? { upgradeHint } : {}),
  };
}

/** The self-serve upgrade path. Dedicated is by contract, so nothing sits above Kitchen Pro. */
export const NEXT_PLAN: Record<PlanKey, PlanKey | null> = {
  free: "ordering",
  ordering: "kitchen_pro",
  kitchen_pro: null,
  dedicated: null,
};

/** Returns null when there is nothing meaningful to show (uncapped or contract plans). */
export function buildPlanUsageView(input: {
  plan: PlanKey;
  limits: PlanLimits;
  counts: UsageCounts;
  intake: IntakeSnapshot | null;
  overflow?: OverflowSnapshot | null;
}): PlanUsageView | null {
  const { plan, limits, counts, intake, overflow } = input;
  if (plan === "dedicated") return null;
  const nextPlan = NEXT_PLAN[plan];
  const hint = (
    resource: "outlets" | "dishes" | "qrCodes" | "tables" | "chairs" | "ordersPerMonth"
  ): string | undefined => {
    if (!nextPlan) return undefined;
    const cap = PLAN_LIMITS[nextPlan][resource];
    // Only say what the next plan allows when it genuinely allows more than this one.
    const current = limits[resource];
    if (cap !== null && current !== null && cap <= current) return undefined;
    const label = PLAN_LABELS[nextPlan];
    if (resource === "ordersPerMonth")
      return cap === null
        ? `${label} has no monthly cap`
        : `${label} allows ${cap.toLocaleString("en-US")} a month`;
    return cap === null ? `${label} has no cap` : `${label} allows ${cap.toLocaleString("en-US")}`;
  };
  const meters: UsageMeterView[] = [];
  const specs = [
    { key: "outlets", label: "Outlets", noun: "outlets" },
    { key: "dishes", label: "Dishes", noun: "dishes" },
    { key: "qrCodes", label: "QR codes", noun: "QR codes" },
    { key: "tables", label: "Tables", noun: "tables" },
    { key: "chairs", label: "Chairs", noun: "chairs" },
  ] as const;
  for (const spec of specs) {
    const cap = limits[spec.key];
    // A single outlet is the normal state on Free and Ordering: no meter until it means something.
    if (spec.key === "outlets" && cap === 1 && counts.outlets <= 1) continue;
    if (cap !== null)
      meters.push(
        buildMeter(
          spec.key,
          spec.label,
          spec.noun,
          counts[spec.key],
          cap,
          undefined,
          hint(spec.key)
        )
      );
  }
  if (overflow) {
    const dishes = meters.find((m) => m.key === "dishes");
    if (dishes) dishes.notice = overflowNotice(overflow);
  }
  if (plan === "free" && intake?.enabled && intake.cap > 0)
    meters.push(
      buildMeter(
        "orders",
        "Online orders",
        "online orders this month",
        intake.used,
        intake.cap,
        "Resets each calendar month",
        hint("ordersPerMonth")
      )
    );

  const ordering: PlanFeatureRow =
    plan === "free"
      ? intake?.enabled
        ? {
            key: "ordering",
            label: "Online ordering",
            status: "limited",
            note: `Up to ${intake.cap} orders a month`,
            unlockWith: PLAN_LABELS.ordering,
          }
        : {
            key: "ordering",
            label: "Online ordering",
            status: "locked",
            note: "Guests can browse your menu but not order yet",
            unlockWith: PLAN_LABELS.ordering,
          }
      : {
          key: "ordering",
          label: "Online ordering",
          status: "included",
          note: "No monthly order cap",
          unlockWith: null,
        };

  const kitchen: PlanFeatureRow =
    plan === "kitchen_pro"
      ? {
          key: "kitchen",
          label: "Kitchen display",
          status: "included",
          note: "Stations, tickets and expediting",
          unlockWith: null,
        }
      : {
          key: "kitchen",
          label: "Kitchen display",
          status: "locked",
          note: "Stations, tickets and expediting for busy services",
          unlockWith: PLAN_LABELS.kitchen_pro,
        };

  const next = nextPlan;
  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    meters,
    features: [
      {
        key: "menu",
        label: "Permanent QR menu",
        status: "included",
        note: "Your printed codes never expire",
        unlockWith: null,
      },
      ordering,
      kitchen,
    ],
    nextPlanLabel: next ? PLAN_LABELS[next] : null,
  };
}
