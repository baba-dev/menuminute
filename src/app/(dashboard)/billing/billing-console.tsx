"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { UsageMeter } from "@/components/plans/plan-usage";
import type { BillingPageView, LadderCard } from "@/modules/plans/billing-page";
import {
  listPlayPurchaseTokens,
  playBillingSupported,
  PlayPurchaseCancelled,
  purchaseWithPlay,
} from "@/lib/play-billing-client";
import "@/components/plans/plan-usage.css";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type Notice = { kind: "info" | "ok" | "error"; text: string } | null;
type Paid = "ordering" | "kitchen_pro";

const MAX_POLLS = 10;
const POLL_MS = 4000;

async function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the secure checkout. Please retry."));
    document.body.appendChild(script);
  });
}

export function BillingConsole({
  view,
  organizationId,
  playClient,
}: {
  view: BillingPageView;
  organizationId: string;
  playClient: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Paid | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const planAtCheckout = useRef(view.plan);

  // Scroll a deep-linked plan (?plan=ordering) into view, respecting reduced motion.
  useEffect(() => {
    if (!view.focus) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`bp-plan-${view.focus}`)
      ?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [view.focus]);

  // After a payment is authorized the provider confirms by webhook; poll the server for the new plan.
  useEffect(() => {
    if (!confirming) return;
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      router.refresh();
      if (polls >= MAX_POLLS) {
        window.clearInterval(timer);
        setConfirming(false);
        setNotice({
          kind: "info",
          text: "Your payment is still being confirmed. This page will update on its own, or you can refresh in a minute.",
        });
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [confirming, router]);

  useEffect(() => {
    if (confirming && view.plan !== planAtCheckout.current) {
      setConfirming(false);
      setNotice({ kind: "ok", text: `You are now on ${view.planLabel}. Thank you!` });
    }
  }, [confirming, view.plan, view.planLabel]);

  const startCheckout = useCallback(
    async (plan: Paid, card: LadderCard) => {
      setBusy(plan);
      setNotice(null);
      planAtCheckout.current = view.plan;
      try {
        const res = await fetch(`/api/organizations/${organizationId}/billing/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = (await res.json()) as {
          message?: string;
          keyId?: string;
          subscriptionId?: string;
        };
        if (!res.ok) throw new Error(data.message ?? "We could not start checkout.");
        await loadCheckoutScript();
        const Checkout = window.Razorpay;
        if (!Checkout) throw new Error("Secure checkout is unavailable right now.");
        new Checkout({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "MenuMinute",
          description: `${card.label} (${card.price.label}/month)`,
          theme: { color: "#ea580c" },
          handler: () => {
            setNotice({
              kind: "info",
              text: "Payment authorized. Confirming it securely and unlocking your plan…",
            });
            setConfirming(true);
            router.refresh();
          },
          modal: { ondismiss: () => setBusy(null) },
        }).open();
      } catch (error) {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Checkout failed. Please try again.",
        });
        setBusy(null);
      }
    },
    [organizationId, router, view.plan]
  );

  const verifyPlayPurchase = useCallback(
    async (sku: string, purchaseToken: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/billing/play/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, purchaseToken }),
      });
      const data = (await res.json()) as { message?: string; entitled?: boolean; state?: string };
      if (!res.ok) throw new Error(data.message ?? "We could not verify your purchase.");
      return data;
    },
    [organizationId]
  );

  const startPlayCheckout = useCallback(
    async (plan: Paid) => {
      setBusy(plan);
      setNotice(null);
      try {
        if (!playBillingSupported())
          throw new Error("Google Play purchases are not available on this device.");
        // 1. Server decides whether this owner may start a purchase and names the catalog SKU.
        const intentRes = await fetch(`/api/organizations/${organizationId}/billing/play/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const intent = (await intentRes.json()) as { message?: string; sku?: string };
        if (!intentRes.ok || !intent.sku)
          throw new Error(intent.message ?? "We could not start the purchase.");
        // 2. Google Play's own purchase sheet.
        const token = await purchaseWithPlay(intent.sku);
        setNotice({ kind: "info", text: "Purchase received. Confirming it with Google Play…" });
        // 3. The server re-queries Google Play and only then unlocks the plan.
        const result = await verifyPlayPurchase(intent.sku, token);
        setNotice(
          result.entitled
            ? { kind: "ok", text: "Subscription active. Thank you!" }
            : {
                kind: "info",
                text: "Your purchase is pending confirmation from Google Play. Your plan will unlock automatically.",
              }
        );
        router.refresh();
      } catch (error) {
        if (!(error instanceof PlayPurchaseCancelled))
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "The purchase could not be completed.",
          });
      } finally {
        setBusy(null);
      }
    },
    [organizationId, router, verifyPlayPurchase]
  );

  // Restore: re-submit purchases Google Play still reports (reinstall, missed callback, new device).
  // The server binds tokens only for the signed-in owner and ignores anything Google does not confirm.
  const restoreSku = view.playClient && view.canManage ? view.playSku : null;
  useEffect(() => {
    if (!restoreSku || !playBillingSupported()) return;
    let flagged = false;
    try {
      flagged = window.sessionStorage.getItem("mm.play.restored") === organizationId;
    } catch {
      /* storage unavailable: restore once per mount instead */
    }
    if (flagged) return;
    let cancelled = false;
    void (async () => {
      try {
        const tokens = await listPlayPurchaseTokens(restoreSku);
        for (const token of tokens) {
          if (cancelled) return;
          await verifyPlayPurchase(restoreSku, token).catch(() => undefined);
        }
        try {
          window.sessionStorage.setItem("mm.play.restored", organizationId);
        } catch {
          /* ignore */
        }
        if (tokens.length > 0 && !cancelled) router.refresh();
      } catch {
        /* restore is best-effort; the manual purchase flow is unaffected */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreSku, organizationId, router, verifyPlayPurchase]);

  async function cancelRenewal() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/billing/${encodeURIComponent(cancelTarget)}/cancel`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "We could not schedule the cancellation.");
      setNotice({
        kind: "ok",
        text: "Renewal cancelled. Your plan stays active until the end of the paid period.",
      });
      setCancelTarget(null);
      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Cancellation is unavailable right now.",
      });
    } finally {
      setCancelBusy(false);
    }
  }

  const current = view.ladder.find((c) => c.state === "current");
  const nextCard = view.next ? view.ladder.find((c) => c.key === view.next?.plan) : undefined;
  const statusChip = view.trial
    ? view.trial.daysLeft === 0
      ? "Trial ends today"
      : `Trial · ${view.trial.daysLeft} ${view.trial.daysLeft === 1 ? "day" : "days"} left`
    : view.plan === "free"
      ? "Free forever"
      : view.cycle.headline.startsWith("Ends")
        ? "Ending soon"
        : "Active";

  const renderAction = (card: LadderCard, size: "lg" | "md" = "md") => {
    // The Play app sells only through Google Play Billing; Razorpay checkout is never rendered there.
    if (playClient && card.action?.kind === "play-checkout") {
      const plan = card.action.plan;
      const working = busy === plan;
      return (
        <button
          type="button"
          className={size === "lg" ? "bp-btn bp-btn--primary bp-btn--lg" : "bp-btn bp-btn--primary"}
          disabled={busy !== null}
          aria-busy={working}
          onClick={() => void startPlayCheckout(plan)}
        >
          {working ? "Opening Google Play…" : card.action.label}
          {!working && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      );
    }
    if (playClient && card.action?.kind !== "contact") {
      return card.note ? (
        <p className="bp-note">
          <Lock size={14} aria-hidden="true" /> {card.note}
        </p>
      ) : null;
    }
    if (card.action?.kind === "checkout") {
      const plan = card.action.plan;
      const working = busy === plan;
      return (
        <button
          type="button"
          className={size === "lg" ? "bp-btn bp-btn--primary bp-btn--lg" : "bp-btn bp-btn--primary"}
          disabled={busy !== null || confirming}
          aria-busy={working}
          onClick={() => void startCheckout(plan, card)}
        >
          {working ? "Opening secure checkout…" : card.action.label}
          {!working && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      );
    }
    if (card.action?.kind === "contact")
      return (
        <Link
          href={card.action.href}
          className={size === "lg" ? "bp-btn bp-btn--quiet bp-btn--lg" : "bp-btn bp-btn--quiet"}
        >
          {card.action.label}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      );
    if (card.note)
      return (
        <p className="bp-note">
          <Lock size={14} aria-hidden="true" /> {card.note}
        </p>
      );
    return null;
  };

  return (
    <div className="bp">
      <header className="bp-hero">
        <div>
          <span className="bp-eyebrow">BILLING &amp; PLAN</span>
          <h1>Your plan, in one place.</h1>
          <p>
            {view.organizationName} · See your current plan, usage and billing cycle.
            {" Explore available upgrades."}
          </p>
        </div>
        <div className="bp-hero-plan" aria-label="Current plan">
          <span className="bp-label">Current plan</span>
          <strong>{view.planLabel}</strong>
          <span className="bp-hero-price">
            {view.price.label} <span>{view.price.note}</span>
          </span>
        </div>
      </header>

      {view.notices
        .filter((entry) => !playClient || !entry.action || view.checkoutAvailable)
        .map((notice) => (
          <div
            key={notice.key}
            className="bp-banner"
            data-tone={notice.tone}
            role={notice.tone === "alert" ? "alert" : "status"}
          >
            <div>
              <strong>{notice.title}</strong>
              <span>{notice.body}</span>
            </div>
            {notice.action && (
              <Link href={notice.action.href} className="bp-btn bp-btn--quiet">
                {notice.action.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        ))}

      <div className="bp-messages" aria-live="polite">
        {notice && (
          <p
            className={`bp-notice bp-notice--${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        )}
      </div>

      <div className="bp-grid">
        <article className="bp-tile bp-span-5" aria-labelledby="bp-plan-title">
          <span className="bp-label" id="bp-plan-title">
            Your plan
          </span>
          <p className="bp-name">{view.planLabel}</p>
          <p className="bp-price">
            <strong>{view.price.label}</strong>
            <span>{view.price.note}</span>
            <span className="bp-chip">{statusChip}</span>
          </p>
          {current && (
            <ul className="bp-checks">
              {current.highlights.map((h) => (
                <li key={h}>
                  <Check size={15} aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="bp-tile bp-span-7" aria-labelledby="bp-cycle-title">
          <span className="bp-label" id="bp-cycle-title">
            Billing cycle
          </span>
          <p className="bp-headline">{view.cycle.headline}</p>
          {view.cycle.detail && <p className="bp-muted">{view.cycle.detail}</p>}
          <dl className="bp-facts">
            <div>
              <dt>Interval</dt>
              <dd>{view.cycle.interval}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{playClient ? "Set by Google Play" : "INR"}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{view.cycle.payment}</dd>
            </div>
          </dl>
          <p className="bp-secure">
            <ShieldCheck size={15} aria-hidden="true" />
            {playClient
              ? "Payments are processed by Google Play. MenuMinute never sees or stores your payment details."
              : "Payments are processed by Razorpay. MenuMinute never sees or stores your card details."}
          </p>
        </article>

        <article className="bp-tile bp-span-7" aria-labelledby="bp-usage-title">
          <span className="bp-label" id="bp-usage-title">
            Usage &amp; limits
          </span>
          {view.quotasEnforced && view.meters.length > 0 ? (
            <div className="bp-meters">
              {view.meters.map((meter) => (
                <UsageMeter key={meter.key} meter={meter} />
              ))}
            </div>
          ) : (
            <p className="bp-muted">
              Plan limits are not being applied yet, so nothing on your account is capped today.
              Your allowances will appear here when they switch on.
            </p>
          )}
        </article>

        {(!playClient || view.checkoutAvailable) && (
          <article className="bp-tile bp-tile--accent bp-span-5" aria-labelledby="bp-next-title">
            {view.next ? (
              <>
                <span className="bp-label" id="bp-next-title">
                  {view.next.mode === "keep" ? "Keep after your trial" : "Unlock next"}
                </span>
                <div className="bp-next-head">
                  <p className="bp-name">{view.next.label}</p>
                  <p className="bp-price">
                    <strong>{view.next.price.label}</strong>
                    <span>{view.next.price.note}</span>
                  </p>
                </div>
                <p className="bp-muted">{view.next.tagline}</p>
                <ul className="bp-benefits">
                  {view.next.benefits.map((b) => (
                    <li key={b.key}>
                      <span>{b.label}</span>
                      <span className="bp-benefit-values">
                        <span className="bp-from">{b.from}</span>
                        <ArrowRight size={13} aria-hidden="true" />
                        <span className="bp-sr">to </span>
                        <strong>{b.to}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
                {nextCard && <div className="bp-action">{renderAction(nextCard, "lg")}</div>}
              </>
            ) : (
              <>
                <span className="bp-label" id="bp-next-title">
                  Top plan
                </span>
                <p className="bp-name">Everything is unlocked</p>
                <p className="bp-muted">
                  You are on our most complete plan. Thank you for building with MenuMinute.
                </p>
              </>
            )}
          </article>
        )}
      </div>

      {(!playClient || view.checkoutAvailable) && (
        <section className="bp-section" aria-labelledby="bp-plans-title">
          <div className="bp-section-head">
            <h2 id="bp-plans-title">Choose your plan</h2>
            <p>Monthly, cancel any time. Your permanent QR menu is always free.</p>
          </div>
          <div className="bp-ladder">
            {view.ladder.map((card) => (
              <article
                key={card.key}
                id={`bp-plan-${card.key}`}
                className="bp-plan-card"
                data-state={card.state}
                data-focus={view.focus === card.key ? "true" : undefined}
                aria-label={`${card.label} plan`}
              >
                <header>
                  <h3>{card.label}</h3>
                  {card.state === "current" && (
                    <span className="bp-chip bp-chip--ink">Current plan</span>
                  )}
                </header>
                <p className="bp-price">
                  <strong>{card.price.label}</strong>
                  <span>{card.price.note}</span>
                </p>
                {card.price.detail && <p className="bp-price-detail">{card.price.detail}</p>}
                <p className="bp-muted">{card.tagline}</p>
                <ul className="bp-checks">
                  {card.highlights.map((h) => (
                    <li key={h}>
                      <Check size={15} aria-hidden="true" />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="bp-action">
                  {card.state === "lower" ? (
                    <p className="bp-note">Included in your plan</p>
                  ) : (
                    renderAction(card)
                  )}
                  {card.switchNote && <p className="bp-note bp-note--switch">{card.switchNote}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="bp-grid">
        <article className="bp-tile bp-span-7" aria-labelledby="bp-subs-title">
          <span className="bp-label" id="bp-subs-title">
            Subscriptions
          </span>
          {view.subscriptions.length === 0 ? (
            <p className="bp-muted">
              {view.plan === "free"
                ? "No subscriptions yet. You are on the free plan."
                : view.trial
                  ? "You are on a free trial, so there is no subscription yet."
                  : "Your access is granted by MenuMinute, so there is no subscription to manage."}
            </p>
          ) : (
            <ul className="bp-rows">
              {view.subscriptions.map((sub) => (
                <li key={sub.id}>
                  <div className="bp-row-main">
                    <strong>{sub.product}</strong>
                    <span className="bp-muted">
                      {sub.periodEnd ? `Period ends ${sub.periodEnd}` : "Awaiting confirmation"}
                    </span>
                  </div>
                  <span className="bp-chip">
                    {sub.cancelScheduled ? "Renewal cancelled" : sub.status}
                  </span>
                  {sub.manageUrl && (
                    <a
                      className="bp-btn bp-btn--quiet"
                      href={sub.manageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage in Google Play
                      <ArrowRight size={16} aria-hidden="true" />
                    </a>
                  )}
                  {sub.canCancel &&
                    (cancelTarget === sub.id ? (
                      <div className="bp-confirm" role="group" aria-label="Confirm cancellation">
                        <span>Stop renewing? You keep access until the period ends.</span>
                        <button
                          type="button"
                          className="bp-btn bp-btn--quiet"
                          onClick={() => setCancelTarget(null)}
                          disabled={cancelBusy}
                        >
                          Keep plan
                        </button>
                        <button
                          type="button"
                          className="bp-btn bp-btn--danger"
                          onClick={() => void cancelRenewal()}
                          disabled={cancelBusy}
                        >
                          {cancelBusy ? "Cancelling…" : "Cancel renewal"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="bp-btn bp-btn--quiet"
                        onClick={() => setCancelTarget(sub.id)}
                      >
                        Cancel renewal
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="bp-tile bp-span-5" aria-labelledby="bp-pay-title">
          <span className="bp-label" id="bp-pay-title">
            Payments &amp; invoices
          </span>
          <p className="bp-muted">
            {playClient
              ? "Subscriptions are bought, renewed and cancelled through Google Play. Manage them in Google Play subscriptions."
              : "You pick how to pay inside the secure checkout. Card numbers go straight to our payment provider and never touch MenuMinute."}
          </p>
          <p className="bp-muted">
            GST invoices are not available here yet. We will show them on this page as soon as
            invoicing is switched on.
          </p>
        </article>
      </div>

      {view.history.length > 0 && (
        <section className="bp-tile" aria-labelledby="bp-history-title">
          <span className="bp-label" id="bp-history-title">
            Access history
          </span>
          <ul className="bp-rows">
            {view.history.map((row) => (
              <li key={row.id}>
                <div className="bp-row-main">
                  <strong>{row.label}</strong>
                  <span className="bp-muted">{row.window}</span>
                </div>
                <span className="bp-chip">
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
