import type { PlanKey } from "./catalog";
import { planPrice, planTagline, type NextUp, type PricePoint } from "./offer";
import {
  buildLifecycleNotices,
  nextUpFor,
  NO_LIFECYCLE,
  trialChip,
  type LifecycleNotice,
  type LifecycleSnapshot,
} from "./lifecycle";
import type { IntakeSnapshot, PlanUsageView, UsageMeterView } from "./view";
import { PLAN_LABELS } from "./catalog";

export const BILLING_HREF = "/billing";

/** Plain, serializable view for the dashboard bento widget. */
export type PlanBentoView = {
  plan: PlanKey;
  planLabel: string;
  price: PricePoint;
  tagline: string;
  /** "Trial · 9 days left" while an automatic trial is running. */
  statusChip: string | null;
  /** Payment problems only; the trial is shown in the plan tile and the next-plan tile. */
  notices: LifecycleNotice[];
  /** The two meters closest to their limit; empty when limits are not enforced yet. */
  meters: UsageMeterView[];
  next: NextUp | null;
  cta:
    | { kind: "upgrade"; label: string; href: string }
    | { kind: "see-plans"; label: string; href: string }
    | { kind: "ask-owner"; label: string; href: string }
    | null;
};

const urgency = (m: UsageMeterView) => (m.cap > 0 ? m.used / m.cap : 1);

export function buildBentoView(input: {
  plan: PlanKey;
  usage: PlanUsageView | null;
  intake: IntakeSnapshot | null;
  canManageBilling: boolean;
  billingEnabled: boolean;
  lifecycle?: LifecycleSnapshot;
  now?: Date;
}): PlanBentoView | null {
  const { plan, usage, intake, canManageBilling, billingEnabled } = input;
  if (plan === "dedicated") return null;
  const lifecycle = input.lifecycle ?? NO_LIFECYCLE;
  const next = nextUpFor(plan, { intake, trialActive: lifecycle.trial !== null });
  const meters = [...(usage?.meters ?? [])].sort((a, b) => urgency(b) - urgency(a)).slice(0, 2);
  let cta: PlanBentoView["cta"] = null;
  if (next) {
    const base = `${BILLING_HREF}?plan=${next.plan}`;
    if (!canManageBilling)
      cta = {
        kind: "ask-owner",
        label: next.mode === "keep" ? "Ask your owner to subscribe" : "Ask your owner to upgrade",
        href: BILLING_HREF,
      };
    else if (next.mode === "keep" && billingEnabled)
      cta = { kind: "upgrade", label: "Subscribe to keep Ordering", href: base };
    else if (billingEnabled)
      cta = { kind: "upgrade", label: `Upgrade to ${next.label}`, href: base };
    else cta = { kind: "see-plans", label: "See plans", href: BILLING_HREF };
  }
  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    price: planPrice(plan),
    tagline: planTagline(plan),
    statusChip: trialChip(lifecycle.trial, input.now),
    notices: buildLifecycleNotices(lifecycle, {
      canManage: canManageBilling,
      billingEnabled,
      now: input.now,
    }).filter((n) => n.key !== "trial"),
    meters,
    next,
    cta,
  };
}
