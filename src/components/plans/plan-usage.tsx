import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert, Gauge, Lock, TriangleAlert } from "lucide-react";
import { fmt, type MeterKey, type PlanUsageView, type UsageMeterView } from "@/modules/plans/view";
import "./plan-usage.css";

/**
 * Plan usage UI (slice 2c). Purely presentational: it renders a server-built `PlanUsageView` and
 * holds no limit logic. State is always spelled out in text and icon, never colour alone.
 */
export const PLAN_USAGE_HREF = "/billing";

function StateIcon({ state }: { state: UsageMeterView["state"] }) {
  if (state === "near" || state === "full") return <TriangleAlert size={14} aria-hidden="true" />;
  if (state === "over") return <CircleAlert size={14} aria-hidden="true" />;
  return null;
}

export function UsageMeter({ meter }: { meter: UsageMeterView }) {
  const text = `${fmt(meter.used)} of ${fmt(meter.cap)} ${meter.noun} used`;
  return (
    <div className="pu-meter" data-state={meter.state} data-testid={`plan-meter-${meter.key}`}>
      <div className="pu-meter-top">
        <span className="pu-meter-label">{meter.label}</span>
        <span className="pu-meter-count">
          <strong>{fmt(meter.used)}</strong>
          <span aria-hidden="true"> / </span>
          <span className="pu-sr">of </span>
          {fmt(meter.cap)}
        </span>
      </div>
      <div
        className="pu-bar"
        role="meter"
        aria-label={meter.label}
        aria-valuemin={0}
        aria-valuemax={meter.cap}
        aria-valuenow={Math.min(meter.used, meter.cap)}
        aria-valuetext={text}
      >
        <span className="pu-bar-fill" style={{ width: `${meter.percent}%` }} />
      </div>
      <div className="pu-meter-foot">
        <span className="pu-chip">
          <StateIcon state={meter.state} />
          {meter.statusText}
        </span>
        {meter.upgradeHint ? (
          <span className="pu-period pu-hint">{meter.upgradeHint}</span>
        ) : (
          meter.period && <span className="pu-period">{meter.period}</span>
        )}
      </div>
    </div>
  );
}

/** Slim band for the page that owns the resource (e.g. Menu Studio, QR Studio). */
export function PlanMeterStrip({
  view,
  only,
  className,
}: {
  view: PlanUsageView | null;
  only: MeterKey[];
  className?: string;
}) {
  if (!view) return null;
  const meters = view.meters.filter((m) => only.includes(m.key));
  if (meters.length === 0) return null;
  const hot = meters.some((m) => m.state !== "ok");
  return (
    <section
      className={className ? `pu-strip ${className}` : "pu-strip"}
      aria-label="Plan usage"
      data-hot={hot ? "true" : undefined}
    >
      <div className="pu-strip-meters">
        {meters.map((meter) => (
          <UsageMeter key={meter.key} meter={meter} />
        ))}
      </div>
      <Link href={PLAN_USAGE_HREF} className="pu-link">
        <span className="pu-strip-plan">{view.planLabel} plan</span>
        <span className="pu-link-text">
          {hot && view.nextPlanLabel ? `See ${view.nextPlanLabel}` : "Plans & usage"}
          <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}

const FEATURE_ICON = { included: Check, limited: Gauge, locked: Lock } as const;
const FEATURE_STATUS = { included: "Included", limited: "Limited", locked: "Locked" } as const;

/** Full panel for the Organization billing area: every meter plus what each plan unlocks. */
export function PlanUsagePanel({ view, outletName }: { view: PlanUsageView; outletName?: string }) {
  return (
    <section id="plan-usage" className="pu-panel" aria-labelledby="plan-usage-title">
      <header className="pu-panel-head">
        <div>
          <span className="pu-eyebrow">PLAN &amp; USAGE</span>
          <h3 id="plan-usage-title">
            {view.planLabel} plan{outletName ? <span> · {outletName}</span> : null}
          </h3>
        </div>
        {view.nextPlanLabel && (
          <Link href="/billing" className="pu-compare">
            Compare plans
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        )}
      </header>
      {view.meters.length > 0 && (
        <div className="pu-panel-meters">
          {view.meters.map((meter) => (
            <UsageMeter key={meter.key} meter={meter} />
          ))}
        </div>
      )}
      <ul className="pu-features" aria-label="What your plan includes">
        {view.features.map((feature) => {
          const Icon = FEATURE_ICON[feature.status];
          return (
            <li key={feature.key} className="pu-feature" data-status={feature.status}>
              <span className="pu-feature-icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <div className="pu-feature-copy">
                <strong>{feature.label}</strong>
                <span>{feature.note}</span>
              </div>
              <span className="pu-feature-tag">
                <span className="pu-sr">{FEATURE_STATUS[feature.status]}. </span>
                {feature.unlockWith ? `Unlock with ${feature.unlockWith}` : FEATURE_STATUS.included}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
