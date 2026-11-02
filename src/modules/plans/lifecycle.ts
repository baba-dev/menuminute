import { PLAN_LABELS, type PlanKey } from "./catalog";
import { benefitsBetween, buildNextUp, planPrice, planTagline, type NextUp } from "./offer";
import { fmtDate, type IntakeSnapshot } from "./view";

/**
 * Trial and payment-failure state (migration 0082), turned into plain notices. Pure: no I/O, no
 * React. The facts come from `app_private.plan_lifecycle_snapshot`; dunning is only ever present for
 * organization owners and admins.
 */
export type LifecycleSnapshot = {
  trial: { startedAt: string; endsAt: string } | null;
  dunning: { status: "pending" | "halted" | "paused"; graceUntil: string | null } | null;
};
export const NO_LIFECYCLE: LifecycleSnapshot = { trial: null, dunning: null };

export type LifecycleNotice = {
  key: "trial" | "dunning-retrying" | "dunning-stopped";
  tone: "info" | "warn" | "alert";
  title: string;
  body: string;
  action: { label: string; href: string } | null;
};

const DAY_MS = 86_400_000;

/** Whole days left, rounded up, never negative: 0 means it ends today. */
export function trialDaysLeft(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / DAY_MS));
}

export function trialChip(
  trial: LifecycleSnapshot["trial"],
  now: Date = new Date()
): string | null {
  if (!trial) return null;
  const n = trialDaysLeft(trial.endsAt, now);
  return n === 0 ? "Trial ends today" : `Trial · ${n} ${n === 1 ? "day" : "days"} left`;
}

export function buildLifecycleNotices(
  lifecycle: LifecycleSnapshot,
  opts: { canManage: boolean; billingEnabled: boolean; now?: Date }
): LifecycleNotice[] {
  const notices: LifecycleNotice[] = [];
  const { trial, dunning } = lifecycle;
  const canPay = opts.canManage && opts.billingEnabled;
  if (trial) {
    const n = trialDaysLeft(trial.endsAt, opts.now);
    notices.push({
      key: "trial",
      tone: n <= 3 ? "warn" : "info",
      title:
        n === 0
          ? "Your Ordering trial ends today"
          : `Your Ordering trial ends in ${n} ${n === 1 ? "day" : "days"}`,
      body: canPay
        ? `Subscribe to keep taking orders after ${fmtDate(trial.endsAt)}. Subscribing starts your paid month today and replaces the trial days left.`
        : opts.canManage
          ? `Paid plans are opening soon. Your trial runs until ${fmtDate(trial.endsAt)}.`
          : `Ask your organization owner to subscribe before ${fmtDate(trial.endsAt)} to keep taking orders.`,
      action: canPay
        ? { label: "Subscribe to keep Ordering", href: "/billing?plan=ordering" }
        : null,
    });
  }
  if (dunning?.status === "pending") {
    notices.push({
      key: "dunning-retrying",
      tone: "warn",
      title: "We could not renew your plan",
      body: dunning.graceUntil
        ? `Your access continues until ${fmtDate(dunning.graceUntil)} while the payment is retried. Make sure your payment method can cover the renewal.`
        : "The payment is being retried. Make sure your payment method can cover the renewal.",
      action: { label: "View billing", href: "/billing" },
    });
  } else if (dunning) {
    notices.push({
      key: "dunning-stopped",
      tone: "alert",
      title: "Your subscription has stopped",
      body: "The payment could not be collected, so paid features are paused. Your menu and QR codes keep working. Subscribe again to restore everything.",
      action: canPay
        ? { label: "Subscribe again", href: "/billing?plan=ordering" }
        : { label: "View billing", href: "/billing" },
    });
  }
  return notices;
}

/**
 * The next-plan tile. During a trial it flips from "unlock the next plan" to "keep what you have":
 * the same before/after rows (Free to Ordering), framed as what the owner would lose.
 */
export function nextUpFor(
  plan: PlanKey,
  opts: { intake?: IntakeSnapshot | null; trialActive?: boolean }
): NextUp | null {
  if (opts.trialActive && plan === "ordering")
    return {
      plan: "ordering",
      label: PLAN_LABELS.ordering,
      price: planPrice("ordering"),
      tagline: "Keep taking orders after your trial",
      benefits: benefitsBetween("free", "ordering", { intake: opts.intake }),
      mode: "keep",
    };
  return buildNextUp(plan, { intake: opts.intake });
}
export { planTagline };
