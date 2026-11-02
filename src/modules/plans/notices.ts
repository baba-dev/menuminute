import type { Pool } from "pg";
import { renderEmail, type EmailContent, type RenderedEmail } from "@/lib/email/template";
import { PLAN_LIMITS } from "./catalog";
import { planPrice } from "./offer";
import { fmt, fmtDate } from "./view";

/**
 * Plan reminder emails: trial ending, payment failing, grace period ending (migration 0085).
 * Env-free and worker-safe: the worker has no web environment, so the app origin is passed in.
 * The database decides what is due and records each reminder once per recipient (see
 * `enqueue_plan_email_notices`); this module only words and sends them.
 */
export type PlanEmailKind = "trial_ending" | "payment_failed" | "grace_ending";

export type DueNotice = {
  id: string;
  kind: PlanEmailKind;
  to_email: string;
  to_name: string;
  organization_name: string;
  ends_at: Date | string;
};

const DAY_MS = 86_400_000;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const greeting = (name: string) => (firstName(name) ? `Hi ${firstName(name)},` : "Hello,");
const daysLeft = (endsAt: Date | string, now: Date) =>
  Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / DAY_MS));

/** The subject line and body of one reminder. Pure. */
export function planEmail(
  notice: Pick<DueNotice, "kind" | "to_name" | "organization_name" | "ends_at">,
  appUrl: string,
  now: Date = new Date()
): { subject: string } & RenderedEmail {
  const org = notice.organization_name;
  const ends = fmtDate(notice.ends_at);
  const price = planPrice("ordering").label;
  const freeOrders = fmt(PLAN_LIMITS.free.ordersPerMonth ?? 0);
  const billing = `${new URL(appUrl).origin}/billing`;
  let subject: string;
  let content: EmailContent;

  if (notice.kind === "trial_ending") {
    const n = daysLeft(notice.ends_at, now);
    const when = n <= 1 ? "tomorrow" : `in ${n} days`;
    subject =
      n <= 1 ? "Your Ordering trial ends tomorrow" : `Your Ordering trial ends in ${n} days`;
    content = {
      preheader: `Subscribe for ${price} a month to keep taking orders after ${ends}.`,
      eyebrow: "Your trial",
      tone: n <= 1 ? "warn" : "info",
      heading: `Your Ordering trial ends ${when}`,
      paragraphs: [
        greeting(notice.to_name),
        `${org} has been taking orders on a free trial of the Ordering plan. The trial ends on ${ends}.`,
        `Subscribe for ${price} a month and nothing changes. If you do not, your menu and QR codes keep working for free, and guest ordering drops to ${freeOrders} orders a month.`,
      ],
      facts: [
        { label: "Trial ends", value: ends },
        { label: "Ordering plan", value: `${price} a month` },
      ],
      action: { label: "Keep taking orders", url: billing },
      note: "Subscribing starts your paid month on the day you pay and replaces the trial days left.",
    };
  } else if (notice.kind === "payment_failed") {
    subject = "We could not renew your Ordering plan";
    content = {
      preheader: `Ordering stays on until ${ends} while we retry your payment.`,
      eyebrow: "Payment problem",
      tone: "alert",
      heading: "We could not renew your Ordering plan",
      paragraphs: [
        greeting(notice.to_name),
        `The latest payment for ${org} did not go through. This is usually an expired card, a bank limit or a declined charge.`,
        `Nothing has stopped. Ordering stays on until ${ends} while your bank retries. Update your payment method before then to keep everything running.`,
      ],
      facts: [{ label: "Ordering stays on until", value: ends }],
      action: { label: "Update payment method", url: billing },
      note: "If the retry succeeds, you do not need to do anything.",
    };
  } else {
    subject = "Ordering pauses soon unless your payment goes through";
    content = {
      preheader: `Your grace period ends ${ends}. Update your payment method to keep taking orders.`,
      eyebrow: "Grace period ending",
      tone: "alert",
      heading: "Your grace period is almost over",
      paragraphs: [
        greeting(notice.to_name),
        `We still could not collect payment for ${org}. Ordering stays on until ${ends}, then it pauses.`,
        `Your menu and QR codes keep working for free, and guest ordering drops to ${freeOrders} orders a month. Update your payment method and Ordering resumes at once.`,
      ],
      facts: [{ label: "Ordering pauses on", value: ends }],
      action: { label: "Update payment method", url: billing },
    };
  }
  return { subject, ...renderEmail(content, appUrl) };
}

export type Send = (message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => Promise<void>;

/**
 * One pass: record what is due, then send what was leased. A failed send leaves the lease to expire, so it
 * retries on a later pass (at most 5 times). Returns counts for logging; never throws on a send failure.
 */
export async function sendDuePlanEmails(
  pool: Pick<Pool, "query">,
  send: Send,
  appUrl: string,
  opts: { limit?: number; now?: Date } = {}
): Promise<{ queued: number; sent: number; failed: number }> {
  const queued = Number(
    (await pool.query<{ n: number }>("select app_private.enqueue_plan_email_notices() as n"))
      .rows[0]?.n ?? 0
  );
  const { rows } = await pool.query<DueNotice>(
    "select * from app_private.claim_plan_email_notices($1)",
    [opts.limit ?? 25]
  );
  let sent = 0;
  let failed = 0;
  for (const notice of rows) {
    try {
      await send({ to: notice.to_email, ...planEmail(notice, appUrl, opts.now) });
      await pool.query("select app_private.complete_plan_email_notice($1)", [notice.id]);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { queued, sent, failed };
}
