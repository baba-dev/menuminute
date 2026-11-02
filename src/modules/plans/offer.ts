import { inrMonthlyPrice } from "@/modules/billing/catalog";
import { PLAN_LABELS, PLAN_LIMITS, type PlanKey } from "./catalog";
import { fmt, NEXT_PLAN, type IntakeSnapshot } from "./view";

/**
 * What each plan costs and offers, derived from the reviewed catalogs so the dashboard widget, the
 * /billing page and checkout can never disagree. Pure: no I/O, no React.
 *
 * Prices come from `PAID_PLAN_CATALOG` (the amounts the payment provider's plans are created with).
 * Only enforced limits and real features are listed as benefits.
 */
export type PricePoint = {
  /** "Free", "₹119", "Custom" */
  label: string;
  /** "forever", "per month", "by quote" */
  note: string;
  paid: boolean;
};

export function planPrice(plan: PlanKey): PricePoint {
  if (plan === "free") return { label: "₹0", note: "forever", paid: false };
  if (plan === "dedicated") return { label: "Custom", note: "by quote", paid: false };
  return { label: inrMonthlyPrice(plan), note: "per month", paid: true };
}

export type BenefitRow = {
  key: "dishes" | "qrCodes" | "floor" | "orders" | "kitchen";
  label: string;
  from: string;
  to: string;
};

type Opts = { intake?: IntakeSnapshot | null };

const capText = (n: number | null) => (n === null ? "No cap" : fmt(n));
const floorText = (tables: number | null, chairs: number | null) =>
  tables === null || chairs === null ? "No cap" : `${fmt(tables)} tables · ${fmt(chairs)} chairs`;

/** What moving from one plan to a higher one changes. Every row is a real, enforced difference. */
export function benefitsBetween(from: PlanKey, to: PlanKey, opts: Opts = {}): BenefitRow[] {
  const a = PLAN_LIMITS[from];
  const b = PLAN_LIMITS[to];
  const rows: BenefitRow[] = [];
  if (a.dishes !== b.dishes)
    rows.push({ key: "dishes", label: "Dishes", from: capText(a.dishes), to: capText(b.dishes) });
  if (a.qrCodes !== b.qrCodes)
    rows.push({
      key: "qrCodes",
      label: "QR codes",
      from: capText(a.qrCodes),
      to: capText(b.qrCodes),
    });
  if (a.tables !== b.tables || a.chairs !== b.chairs)
    rows.push({
      key: "floor",
      label: "Dining floor",
      from: floorText(a.tables, a.chairs),
      to: floorText(b.tables, b.chairs),
    });
  if (from === "free" && to !== "free")
    rows.push({
      key: "orders",
      label: "Online orders",
      from: opts.intake?.enabled ? `${fmt(opts.intake.cap)} a month` : "Not included",
      to: "No monthly cap",
    });
  if (to === "kitchen_pro" && from !== "kitchen_pro")
    rows.push({ key: "kitchen", label: "Kitchen display", from: "Not included", to: "Included" });
  return rows;
}

export type PlanOffer = {
  key: PlanKey;
  label: string;
  price: PricePoint;
  tagline: string;
  highlights: string[];
};

const TAGLINE: Record<PlanKey, string> = {
  free: "A permanent QR menu, free for good",
  ordering: "Take orders straight from the table",
  kitchen_pro: "Run the whole kitchen on screens",
  dedicated: "Your own branded app",
};

export const planTagline = (plan: PlanKey): string => TAGLINE[plan];

export function planHighlights(plan: PlanKey, opts: Opts = {}): string[] {
  const l = PLAN_LIMITS[plan];
  const list: string[] = [];
  if (l.dishes !== null) list.push(`${fmt(l.dishes)} dishes`);
  if (l.qrCodes !== null) list.push(`${fmt(l.qrCodes)} QR codes`);
  if (l.tables !== null && l.chairs !== null) list.push(floorText(l.tables, l.chairs));
  if (plan === "free")
    list.push(
      opts.intake?.enabled
        ? `Up to ${fmt(opts.intake.cap)} online orders a month`
        : "Guests browse; ordering needs a paid plan"
    );
  else list.push("Online ordering with no monthly cap");
  if (plan === "kitchen_pro") list.push("Kitchen display and stations");
  return list;
}

/** The self-serve ladder shown on /billing. Dedicated is by contract and is not listed. */
export function planLadder(opts: Opts = {}): PlanOffer[] {
  return (["free", "ordering", "kitchen_pro"] as const).map((key) => ({
    key,
    label: PLAN_LABELS[key],
    price: planPrice(key),
    tagline: TAGLINE[key],
    highlights: planHighlights(key, opts),
  }));
}

export type NextUp = {
  plan: PlanKey;
  label: string;
  price: PricePoint;
  tagline: string;
  benefits: BenefitRow[];
  /** "keep" during a trial: the rows describe what subscribing keeps, not what upgrading adds. */
  mode?: "keep";
};

/** The next self-serve plan and why it is worth it; null on the top plan and for contract plans. */
export function buildNextUp(plan: PlanKey, opts: Opts = {}): NextUp | null {
  const next = NEXT_PLAN[plan];
  if (!next) return null;
  return {
    plan: next,
    label: PLAN_LABELS[next],
    price: planPrice(next),
    tagline: TAGLINE[next],
    benefits: benefitsBetween(plan, next, opts),
  };
}
