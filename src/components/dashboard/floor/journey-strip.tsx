import type { ReactNode } from "react";
import type { JourneyStepKey, TableJourney } from "@/modules/hospitality/floor-contracts";
import styles from "./journey-strip.module.css";

/** Small stroke icons, drawn inline so they inherit the chip colour and need no assets. */
const ICONS: Record<JourneyStepKey, ReactNode> = {
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2.5v2.5m3.5-2.5v6m-6 0h2.5" />
    </>
  ),
  order: (
    <>
      <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  cooking: (
    <>
      <path d="M5 11h14a0 0 0 0 1 0 0 7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />
      <path d="M9 7c0-1.2 1-1.6 1-2.8M13 7c0-1.2 1-1.6 1-2.8" />
    </>
  ),
  ready: (
    <>
      <path d="M3.5 16.5h17" />
      <path d="M5.5 16.5a6.5 6.5 0 0 1 13 0" />
      <path d="M12 8.5V7M10.5 7h3" />
    </>
  ),
  delivered: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.4 2.6 2.6 5-5.4" />
    </>
  ),
  bill: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17M7 14.5h3" />
    </>
  ),
  paid: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.2h4.2a1.7 1.7 0 0 1 0 3.4H10.3l3.6 3.2M9 12.6h5" />
    </>
  ),
  water: <path d="M12 3.5c3.2 3.8 5.5 6.6 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3 2.3-5.8 5.5-9.6z" />,
};

const LABELS: Record<JourneyStepKey, { idle: string; active: string; done: string }> = {
  qr: { idle: "QR not scanned", active: "QR scanned", done: "QR scanned" },
  order: { idle: "No order yet", active: "Order sent", done: "Order sent" },
  cooking: { idle: "Not cooking", active: "Cooking", done: "Cooked" },
  ready: { idle: "Not ready", active: "Ready for handoff", done: "Handed off" },
  delivered: { idle: "Not delivered", active: "Delivering", done: "Delivered" },
  bill: { idle: "Bill not shown", active: "Bill requested", done: "Bill shown" },
  paid: { idle: "Not paid", active: "Paying", done: "Paid" },
  water: { idle: "No water request", active: "Water requested", done: "Water served" },
};

export function relativeTime(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : "over a day ago";
}

/**
 * Guest-journey indicators for one table: QR scanned, order sent, cooking, handoff, delivered,
 * bill and payment, water. Each is idle, active (pulses once per few seconds) or done. State is
 * always spelled out in text so colour is never the only cue.
 */
export function JourneyStrip({
  journey,
  now,
  tableName,
  onWaterAction,
  busy = false,
}: {
  journey: TableJourney;
  now?: number;
  tableName: string;
  /** Present only for staff who may act on service requests. */
  onWaterAction?: (requestId: string, action: "acknowledge" | "resolve") => void;
  busy?: boolean;
}) {
  return (
    <section className={styles.strip} aria-label={`Guest journey for ${tableName}`}>
      <ul className={styles.grid}>
        {journey.steps.map((step) => {
          const label = LABELS[step.key][step.state];
          const when = relativeTime(step.at, now);
          const sub = [step.detail, step.state === "idle" ? null : when]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={step.key}
              className={styles.step}
              data-state={step.state}
              data-key={step.key}
              aria-label={sub ? `${label}, ${sub}` : label}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[step.key]}
              </svg>
              <span className={styles.text}>
                <span className={styles.label}>{label}</span>
                {sub && <span className={styles.sub}>{sub}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {journey.waterAction && onWaterAction && (
        <button
          type="button"
          className={styles.action}
          disabled={busy}
          onClick={() => onWaterAction(journey.waterAction!.requestId, journey.waterAction!.action)}
        >
          {journey.waterAction.action === "acknowledge"
            ? "Acknowledge water request"
            : "Mark water served"}
        </button>
      )}
    </section>
  );
}
