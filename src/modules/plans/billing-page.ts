import { grantStatus, type GrantStatus } from "@/modules/admin/grant-policy";
import { PLAN_LABELS, type PlanKey } from "./catalog";
import { planLadder, planPrice, type NextUp, type PlanOffer, type PricePoint } from "./offer";
import {
  buildLifecycleNotices,
  NO_LIFECYCLE,
  nextUpFor,
  trialDaysLeft,
  type LifecycleNotice,
  type LifecycleSnapshot,
} from "./lifecycle";
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
export type PlaySubscriptionInput = {
  product: string;
  state: string;
  currentPeriodEnd?: string | null;
  autoRenewing: boolean;
};
export type BillingStateInput = {
  isCommunityEdition?: boolean;
  billingEnabled?: boolean;
  kitchenCommerceEnabled?: boolean;
  /** Google Play Billing is configured on this deployment (only usable inside the Play app). */
  playBillingEnabled?: boolean;
  /** Catalog SKU for Ordering, used by the Play app to restore purchases without a checkout call. */
  playSku?: string;
  subscriptions?: SubscriptionInput[];
  playSubscriptions?: PlaySubscriptionInput[];
  grants?: GrantInput[];
};

/** Google Play subscription rows are stored as JSON; accept only well-formed rows. */
export function coercePlaySubscriptions(raw: unknown): PlaySubscriptionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaySubscriptionInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r["product"] !== "string" || typeof r["state"] !== "string") continue;
    out.push({
      product: r["product"],
      state: r["state"],
      currentPeriodEnd: typeof r["currentPeriodEnd"] === "string" ? r["currentPeriodEnd"] : null,
      autoRenewing: r["autoRenewing"] === true,
    });
  }
  return out;
}

/** Play states that still represent a subscription the owner can manage in Google Play. */
const PLAY_LIVE_STATES = ["active", "canceled", "grace", "on_hold", "paused"];
export const GOOGLE_PLAY_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

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
  /** Google Play Billing purchase sheet, offered only inside the Play-distributed Android app. */
  | { kind: "play-checkout"; plan: "ordering"; label: string }
  /** Dedicated is sold by contract, so its only action is a conversation. */
  | { kind: "contact"; label: string; href: string };
export type LadderCard = PlanOffer & {
  state: "current" | "lower" | "upgrade";
  action: LadderAction | null;
  /** Plain-language reason when an upgrade cannot be started right now. */
  note: string | null;
  /** What happens to the current subscription if the owner switches to this plan. */
  switchNote: string | null;
};
export type SubscriptionRow = {
  id: string;
  provider: "razorpay" | "play";
  product: string;
  status: string;
  periodEnd: string | null;
  cancelScheduled: boolean;
  canCancel: boolean;
  /** Play subscriptions are changed or cancelled in Google Play, not in this app. */
  manageUrl: string | null;
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
  /** A purchase can be made right now from this client (Razorpay on the web, Play Billing in the app). */
  checkoutAvailable: boolean;
  playSku: string | null;
  playClient: boolean;
  billingUnavailable: boolean;
  /** Trial and payment-problem banners, most urgent first. */
  notices: LifecycleNotice[];
  trial: { endsAt: string; daysLeft: number } | null;
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
  lifecycle?: LifecycleSnapshot;
  now?: Date;
  focus?: string | null;
  /** True inside the Google Play TWA: purchases go through Play Billing only, never Razorpay. */
  playClient?: boolean;
}): BillingPageView {
  const { plan, usage, intake, canManage, billing } = input;
  const lifecycle = input.lifecycle ?? NO_LIFECYCLE;
  const trial = lifecycle.trial
    ? { endsAt: lifecycle.trial.endsAt, daysLeft: trialDaysLeft(lifecycle.trial.endsAt, input.now) }
    : null;
  const community = billing?.isCommunityEdition === true;
  const billingEnabled = billing?.billingEnabled === true;
  const kitchenCheckout = billing?.kitchenCommerceEnabled === true;
  const playClient = input.playClient === true;
  const playBillingEnabled = billing?.playBillingEnabled === true;
  const playSubs = billing?.playSubscriptions ?? [];
  const livePlay = playSubs.find(
    (p) =>
      PLAY_LIVE_STATES.includes(p.state) &&
      (!p.currentPeriodEnd ||
        new Date(p.currentPeriodEnd).getTime() > (input.now ?? new Date()).getTime())
  );
  // One provider per organization. Razorpay rows are hidden from the Play app's purchase surface and
  // a live Play subscription closes web checkout; the database enforces the same rule.
  const subs = playClient ? [] : (billing?.subscriptions ?? []);
  const grants = billing?.grants ?? [];
  const checkoutEnabled = playClient ? playBillingEnabled : billingEnabled;

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
    if (livePlay?.currentPeriodEnd) {
      const end = formatDate(livePlay.currentPeriodEnd);
      cycle = livePlay.autoRenewing
        ? {
            interval: "Monthly",
            headline: `Renews ${end}`,
            detail: "Billed monthly by Google Play.",
            payment: "Managed by Google Play",
          }
        : {
            interval: "Monthly",
            headline: `Ends ${end}`,
            detail: "Renewal is off. Access continues until then.",
            payment: "Managed by Google Play",
          };
    } else if (current?.currentPeriodEnd) {
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

  if (trial) {
    cycle = {
      interval: "—",
      headline: `Trial ends ${fmtDate(trial.endsAt)}`,
      detail:
        "Free until then. Subscribing starts your paid month today and replaces the trial days left.",
      payment: "None needed yet",
    };
  } else if (lifecycle.dunning?.status === "pending" && lifecycle.dunning.graceUntil) {
    cycle = {
      interval: "Monthly",
      headline: `Payment retry until ${fmtDate(lifecycle.dunning.graceUntil)}`,
      detail: "Your last renewal failed. Access continues while the payment is retried.",
      payment: "Managed by Razorpay",
    };
  }

  const subscribedViaPlay = livePlay !== undefined;
  const ordersOnSubscription = subs.some(
    (s) =>
      s.product === "ordering" && ACTIVE_SUBSCRIPTION.includes(s.status) && !s.cancelRequestedAt
  );

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
      else if (offer.key === "dedicated")
        action = { kind: "contact", label: "Talk to us about Dedicated", href: "/contact" };
      else if (!canManage) note = "Only the organization owner can change the plan.";
      else if (subscribedViaPlay)
        note = playClient
          ? "You are subscribed through Google Play. Manage it in Google Play subscriptions."
          : "This organization is subscribed through Google Play. Manage it in the Google Play app.";
      else if (!checkoutEnabled) note = "Paid upgrades are opening soon.";
      else if (playClient && offer.key === "kitchen_pro")
        note = "Kitchen Pro is not available in the Android app yet.";
      else if (playClient)
        action = { kind: "play-checkout", plan: "ordering", label: `Upgrade to ${offer.label}` };
      else if (offer.key === "kitchen_pro" && !kitchenCheckout)
        // The server is the authority: it refuses Kitchen Pro checkout until the platform release is on.
        note = "Kitchen Pro checkout is not available on this deployment yet.";
      else
        action = {
          kind: "checkout",
          plan: offer.key as "ordering" | "kitchen_pro",
          label: `Upgrade to ${offer.label}`,
        };
    }
    if (trial && offer.key === "ordering" && state === "current") {
      if (input.billingUnavailable)
        note = "Billing details are temporarily unavailable. Please try again shortly.";
      else if (!canManage) note = "Only the organization owner can subscribe.";
      else if (subscribedViaPlay)
        note =
          "This organization is subscribed through Google Play. Manage it in the Google Play app.";
      else if (!checkoutEnabled) note = "Paid plans are opening soon.";
      else if (playClient)
        action = { kind: "play-checkout", plan: "ordering", label: "Subscribe to keep Ordering" };
      else action = { kind: "checkout", plan: "ordering", label: "Subscribe to keep Ordering" };
    }
    // Kitchen Pro includes ordering, so buying it ends an Ordering subscription's renewals. Say so first.
    const switchNote =
      offer.key === "kitchen_pro" && action?.kind === "checkout" && ordersOnSubscription
        ? "Kitchen Pro includes Ordering. Your Ordering subscription stops renewing once Kitchen Pro starts, and the days you have already paid for stay active."
        : null;
    return { ...offer, state, action, note, switchNote };
  });

  // ── Subscriptions & history ──────────────────────────────────────────────
  const razorpayRows: SubscriptionRow[] = subs.map((s) => ({
    id: s.subscriptionId,
    provider: "razorpay",
    product: s.product === "kitchen_pro" ? "Kitchen Pro" : "Online ordering",
    status: titleCase(s.status),
    periodEnd: s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : null,
    cancelScheduled: Boolean(s.cancelRequestedAt),
    canCancel:
      canManage && billingEnabled && !s.cancelRequestedAt && ACTIVE_SUBSCRIPTION.includes(s.status),
    manageUrl: null,
  }));
  const playRows: SubscriptionRow[] = playSubs.map((p, i) => ({
    id: `play-${i}`,
    provider: "play",
    product: "Online ordering",
    status: titleCase(
      p.state === "grace" ? "payment issue" : p.state.replace("canceled", "active")
    ),
    periodEnd: p.currentPeriodEnd ? formatDate(p.currentPeriodEnd) : null,
    cancelScheduled: PLAY_LIVE_STATES.includes(p.state) && !p.autoRenewing,
    canCancel: false,
    manageUrl:
      canManage && PLAY_LIVE_STATES.includes(p.state) ? GOOGLE_PLAY_SUBSCRIPTIONS_URL : null,
  }));
  const subscriptions: SubscriptionRow[] = [...playRows, ...razorpayRows];
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
    checkoutAvailable: checkoutEnabled && canManage && !subscribedViaPlay,
    playSku: playClient && playBillingEnabled ? (billing?.playSku ?? null) : null,
    playClient,
    billingUnavailable: input.billingUnavailable === true,
    cycle,
    meters: usage?.meters ?? [],
    quotasEnforced: usage !== null,
    notices: buildLifecycleNotices(lifecycle, { canManage, billingEnabled, now: input.now }),
    trial,
    next: nextUpFor(plan, { intake, trialActive: trial !== null }),
    ladder,
    subscriptions,
    history,
    focus,
  };
}
