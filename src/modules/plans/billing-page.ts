import { grantStatus, type GrantStatus } from "@/modules/admin/grant-policy";
import { PLAN_LABELS, type PlanKey } from "./catalog";
import {
  buildNextUp,
  planLadder,
  planPrice,
  type NextUp,
  type PlanOffer,
  type PricePoint,
} from "./offer";
import { fmtDate, type IntakeSnapshot, type PlanUsageView, type UsageMeterView } from "./view";

/**
 * View model for /billing. Pure: it turns server facts (plan snapshot, billing state) into plain
 * data so the page renders no business rules and the rules are unit-tested.
 */
export type SubscriptionInput = {
  subscriptionId: string;
  product: string;
  status: string;
  currentPeriodEnd?: string | null;
  cancelRequestedAt?: string | null;
};
export type GrantInput = {
  capability: string;
  startsAt: Date | string;
  endsAt: Date | string;
  revokedAt: Date | string | null;
};
export type BillingStateInput = {
  isCommunityEdition?: boolean;
  billingEnabled?: boolean;
  kitchenCommerceEnabled?: boolean;
  subscriptions?: SubscriptionInput[];
  grants?: GrantInput[];
};

/** The provider subscription list is stored as JSON; accept only well-formed rows. */
export function coerceSubscriptions(raw: unknown): SubscriptionInput[] {
  if (!Array.isArray(raw)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  const out: SubscriptionInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const subscriptionId = text(r["subscriptionId"]);
    const product = text(r["product"]);
    const status = text(r["status"]);
    if (!subscriptionId || !product || !status) continue;
    out.push({
      subscriptionId,
      product,
      status,
      currentPeriodEnd: text(r["currentPeriodEnd"]),
      cancelRequestedAt: text(r["cancelRequestedAt"]),
    });
  }
  return out;
}

export const formatDate = fmtDate;

export type LadderAction =
  | { kind: "checkout"; plan: "ordering" | "kitchen_pro"; label: string }
  | { kind: "contact"; label: string; href: string };
export type LadderCard = PlanOffer & {
  state: "current" | "lower" | "upgrade";
  action: LadderAction | null;
  /** Plain-language reason when an upgrade cannot be started right now. */
  note: string | null;
};
export type SubscriptionRow = {
  id: string;
  product: string;
  status: string;
  periodEnd: string | null;
  cancelScheduled: boolean;
  canCancel: boolean;
};
export type HistoryRow = { id: string; label: string; window: string; status: GrantStatus };

export type BillingPageView = {
  organizationName: string;
  plan: PlanKey;
  planLabel: string;
  price: PricePoint;
  community: boolean;
  canManage: boolean;
  billingEnabled: boolean;
  billingUnavailable: boolean;
  /** One-line billing cycle summary, e.g. "Renews 12 Dec 2026". */
  cycle: { interval: string; headline: string; detail: string | null; payment: string };
  meters: UsageMeterView[];
  quotasEnforced: boolean;
  next: NextUp | null;
  ladder: LadderCard[];
  subscriptions: SubscriptionRow[];
  history: HistoryRow[];
  focus: PlanKey | null;
};

const RANK: Record<PlanKey, number> = { free: 0, ordering: 1, kitchen_pro: 2, dedicated: 3 };
const CAPABILITY_LABEL: Record<string, string> = {
  "ordering.new": "Online ordering",
  "kitchen.new": "Kitchen Pro",
};
const ACTIVE_SUBSCRIPTION = ["active", "authenticated", "pending", "created"];
const productKey = (plan: PlanKey) => (plan === "kitchen_pro" ? "kitchen_pro" : "ordering");
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");

export function buildBillingPageView(input: {
  organizationName: string;
  plan: PlanKey;
  usage: PlanUsageView | null;
  intake: IntakeSnapshot | null;
  canManage: boolean;
  billing: BillingStateInput | null;
  /** True when an owner's billing details failed to load, so we never guess at availability. */
  billingUnavailable?: boolean;
  focus?: string | null;
}): BillingPageView {
  const { plan, usage, intake, canManage, billing } = input;
  const community = billing?.isCommunityEdition === true;
  const billingEnabled = billing?.billingEnabled === true;
  const kitchenCheckout = billing?.kitchenCommerceEnabled === true;
  const subs = billing?.subscriptions ?? [];
  const grants = billing?.grants ?? [];

  // ── Billing cycle ────────────────────────────────────────────────────────
  let cycle: BillingPageView["cycle"] = {
    interval: "—",
    headline: "No subscription",
    detail: plan === "free" ? "Your free plan never expires." : null,
    payment: "None needed",
  };
  const current = subs.find(
    (s) => s.product === productKey(plan) && ACTIVE_SUBSCRIPTION.includes(s.status)
  );
  if (plan !== "free" && plan !== "dedicated") {
    if (current?.currentPeriodEnd) {
      const end = formatDate(current.currentPeriodEnd);
      cycle = current.cancelRequestedAt
        ? {
            interval: "Monthly",
            headline: `Ends ${end}`,
            detail: "Renewal cancelled. Access continues until then.",
            payment: "Managed by Razorpay",
          }
        : {
            interval: "Monthly",
            headline: `Renews ${end}`,
            detail: "Billed monthly through your payment provider.",
            payment: "Managed by Razorpay",
          };
    } else {
      const cap = plan === "kitchen_pro" ? "kitchen.new" : "ordering.new";
      const live = grants
        .filter(
          (g) =>
            g.capability === cap && grantStatus(g) !== "revoked" && grantStatus(g) !== "expired"
        )
        .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())[0];
      const open = live && new Date(live.endsAt).getUTCFullYear() >= 9000;
      cycle = {
        interval: "—",
        headline: live && !open ? `Access until ${formatDate(live.endsAt)}` : "Access active",
        detail: "Granted by MenuMinute. No card is charged.",
        payment: "None, access granted",
      };
    }
  }

  // ── Plan ladder ───────────────────────────────────────────────────────────
  const ladder: LadderCard[] = planLadder({ intake }).map((offer) => {
    const state: LadderCard["state"] =
      offer.key === plan ? "current" : RANK[offer.key] < RANK[plan] ? "lower" : "upgrade";
    let action: LadderAction | null = null;
    let note: string | null = null;
    if (state === "upgrade") {
      if (input.billingUnavailable)
        note = "Billing details are temporarily unavailable. Please try again shortly.";
      else if (community) note = "Self-hosted editions have every feature unlocked.";
      else if (!canManage) note = "Only the organization owner can change the plan.";
      else if (offer.key === "kitchen_pro" && !kitchenCheckout)
        action = { kind: "contact", label: "Talk to us about Kitchen Pro", href: "/contact" };
      else if (!billingEnabled) note = "Paid upgrades are opening soon.";
      else
        action = {
          kind: "checkout",
          plan: offer.key as "ordering" | "kitchen_pro",
          label: `Upgrade to ${offer.label}`,
        };
    }
    return { ...offer, state, action, note };
  });

  // ── Subscriptions & history ──────────────────────────────────────────────
  const subscriptions: SubscriptionRow[] = subs.map((s) => ({
    id: s.subscriptionId,
    product: s.product === "kitchen_pro" ? "Kitchen Pro" : "Online ordering",
    status: titleCase(s.status),
    periodEnd: s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : null,
    cancelScheduled: Boolean(s.cancelRequestedAt),
    canCancel:
      canManage && billingEnabled && !s.cancelRequestedAt && ACTIVE_SUBSCRIPTION.includes(s.status),
  }));
  const history: HistoryRow[] = [...grants]
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, 8)
    .map((g, i) => ({
      id: `${g.capability}-${i}`,
      label: CAPABILITY_LABEL[g.capability] ?? g.capability,
      window:
        new Date(g.endsAt).getUTCFullYear() >= 9000
          ? `From ${formatDate(g.startsAt)}`
          : `${formatDate(g.startsAt)} – ${formatDate(g.endsAt)}`,
      status: grantStatus(g),
    }));

  const focus = (["ordering", "kitchen_pro"] as const).find((k) => k === input.focus) ?? null;
  return {
    organizationName: input.organizationName,
    plan,
    planLabel: PLAN_LABELS[plan],
    price: planPrice(plan),
    community,
    canManage,
    billingEnabled,
    billingUnavailable: input.billingUnavailable === true,
    cycle,
    meters: usage?.meters ?? [],
    quotasEnforced: usage !== null,
    next: buildNextUp(plan, { intake }),
    ladder,
    subscriptions,
    history,
    focus,
  };
}
