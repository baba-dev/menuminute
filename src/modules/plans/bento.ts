import type { PlanKey } from "./catalog";
import { buildNextUp, planPrice, planTagline, type NextUp, type PricePoint } from "./offer";
import type { IntakeSnapshot, PlanUsageView, UsageMeterView } from "./view";
import { PLAN_LABELS } from "./catalog";

export const BILLING_HREF = "/billing";

/** Plain, serializable view for the dashboard bento widget. */
export type PlanBentoView = {
  plan: PlanKey;
  planLabel: string;
  price: PricePoint;
  tagline: string;
  /** The two meters closest to their limit; empty when limits are not enforced yet. */
  meters: UsageMeterView[];
  next: NextUp | null;
  cta:
    | { kind: "upgrade" | "explore"; label: string; href: string }
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
}): PlanBentoView | null {
  const { plan, usage, intake, canManageBilling, billingEnabled } = input;
  if (plan === "dedicated") return null;
  const next = buildNextUp(plan, { intake });
  const meters = [...(usage?.meters ?? [])].sort((a, b) => urgency(b) - urgency(a)).slice(0, 2);
  let cta: PlanBentoView["cta"] = null;
  if (next) {
    const base = `${BILLING_HREF}?plan=${next.plan}`;
    if (!canManageBilling)
      cta = { kind: "ask-owner", label: "Ask your owner to upgrade", href: BILLING_HREF };
    else if (next.plan === "kitchen_pro")
      cta = { kind: "explore", label: `Explore ${next.label}`, href: base };
    else if (billingEnabled)
      cta = { kind: "upgrade", label: `Upgrade to ${next.label}`, href: base };
    else cta = { kind: "see-plans", label: "See plans", href: BILLING_HREF };
  }
  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    price: planPrice(plan),
    tagline: planTagline(plan),
    meters,
    next,
    cta,
  };
}
