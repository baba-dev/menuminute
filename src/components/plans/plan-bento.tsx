import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { BILLING_HREF, type PlanBentoView } from "@/modules/plans/bento";
import { UsageMeter } from "./plan-usage";
import "./plan-bento.css";

/**
 * Dashboard bento widget: your plan, what you have used, and what the next plan unlocks.
 * Presentational only; every number and rule comes from the server-built `PlanBentoView`.
 */
export function PlanBento({ view }: { view: PlanBentoView }) {
  const { next, cta } = view;
  return (
    <section className="pb" aria-labelledby="pb-title">
      <header className="pb-head">
        <div>
          <span className="pb-eyebrow">PLAN &amp; BILLING</span>
          <h2 id="pb-title" className="pb-sr">
            Your plan and what it includes
          </h2>
        </div>
        <Link href={BILLING_HREF} className="pb-manage">
          Manage billing
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>

      {view.notices.map((notice) => (
        <div
          key={notice.key}
          className="pb-alert"
          data-tone={notice.tone}
          role={notice.tone === "alert" ? "alert" : "status"}
        >
          <div>
            <strong>{notice.title}</strong>
            <span>{notice.body}</span>
          </div>
          {notice.action && (
            <Link href={notice.action.href} className="pb-alert-link">
              {notice.action.label}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      ))}

      <div className="pb-grid">
        <article className="pb-tile pb-plan" aria-label="Your plan">
          <span className="pb-label">Your plan</span>
          <p className="pb-plan-name">{view.planLabel}</p>
          <p className="pb-price">
            <strong>{view.price.label}</strong>
            <span>{view.price.note}</span>
          </p>
          {view.statusChip && <p className="pb-chip">{view.statusChip}</p>}
          <p className="pb-tagline">{view.tagline}</p>
        </article>

        <article className="pb-tile pb-usage" aria-label="Usage">
          <span className="pb-label">Usage</span>
          {view.meters.length > 0 ? (
            <div className="pb-meters">
              {view.meters.map((meter) => (
                <UsageMeter key={meter.key} meter={meter} />
              ))}
            </div>
          ) : (
            <p className="pb-included">
              <Check size={16} aria-hidden="true" />
              Your menu and permanent QR codes are always included.
            </p>
          )}
        </article>

        <article
          className="pb-tile pb-next"
          aria-label={next ? `Next plan: ${next.label}` : "Plan"}
        >
          {next ? (
            <>
              <span className="pb-label">
                {next.mode === "keep" ? "Keep after your trial" : "Unlock next"}
              </span>
              <div className="pb-next-head">
                <p className="pb-next-name">{next.label}</p>
                <p className="pb-next-price">
                  <strong>{next.price.label}</strong>
                  <span>{next.price.note}</span>
                </p>
              </div>
              <p className="pb-tagline">
                {next.mode === "keep"
                  ? `${next.tagline}. Without a subscription you return to the Free limits.`
                  : next.tagline}
              </p>
              <ul className="pb-benefits">
                {next.benefits.map((b) => (
                  <li key={b.key}>
                    <span className="pb-benefit-label">{b.label}</span>
                    <span className="pb-benefit-values">
                      <span className="pb-from">{b.from}</span>
                      <ArrowRight size={13} aria-hidden="true" />
                      <span className="pb-sr">to </span>
                      <strong className="pb-to">{b.to}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              {cta &&
                (cta.kind === "ask-owner" ? (
                  <p className="pb-note">
                    {cta.label}.{" "}
                    <Link href={cta.href} className="pb-inline-link">
                      See plans
                    </Link>
                  </p>
                ) : (
                  <Link
                    href={cta.href}
                    className={`pb-cta ${cta.kind === "upgrade" ? "pb-cta--primary" : "pb-cta--quiet"}`}
                  >
                    {cta.label}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ))}
            </>
          ) : (
            <>
              <span className="pb-label">Top plan</span>
              <p className="pb-next-name">Everything is unlocked</p>
              <p className="pb-tagline">
                You are on our most complete plan. Review your billing cycle any time.
              </p>
              <Link href={BILLING_HREF} className="pb-cta pb-cta--quiet">
                View billing
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
