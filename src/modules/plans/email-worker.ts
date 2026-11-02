import type { Pool } from "pg";
import { createEmailTransport, type EmailConfig } from "@/lib/email/factory";
import { sendDuePlanEmails } from "./notices";

export const PLAN_EMAIL_INTERVAL_MS = 15 * 60 * 1000;

export type PlanEmailWorkerSettings = { appUrl: string; from: string; mail: EmailConfig };

/**
 * The isolated worker has no web environment (no DATABASE_URL, AUTH_SECRET), so it reads its own few mail
 * settings here instead of importing the web env parser. Returns null (reminders off) unless a real mail
 * provider is configured; throws on a half-configured one so the mistake shows at startup.
 */
export function parsePlanEmailWorkerSettings(
  source: Readonly<Record<string, string | undefined>>
): PlanEmailWorkerSettings | null {
  const provider = source["EMAIL_PROVIDER"] ?? "test";
  if (provider === "test") return null;
  if (provider !== "smtp" && provider !== "resend")
    throw new Error("EMAIL_PROVIDER must be smtp, resend or test");
  const appUrl = source["APP_URL"];
  const from = source["EMAIL_FROM"];
  if (!appUrl || !from)
    throw new Error("APP_URL and EMAIL_FROM are required for plan reminder email");
  new URL(appUrl);
  if (provider === "resend") {
    if (!source["RESEND_API_KEY"]) throw new Error("RESEND_API_KEY is required");
    return {
      appUrl,
      from,
      mail: { EMAIL_PROVIDER: "resend", RESEND_API_KEY: source["RESEND_API_KEY"] },
    };
  }
  const port = Number(source["SMTP_PORT"]);
  const secure = source["SMTP_SECURE"];
  if (
    !source["SMTP_HOST"] ||
    !source["SMTP_USER"] ||
    !source["SMTP_PASSWORD"] ||
    !Number.isInteger(port) ||
    (secure !== "true" && secure !== "false")
  )
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASSWORD are required");
  return {
    appUrl,
    from,
    mail: {
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: source["SMTP_HOST"],
      SMTP_PORT: port,
      SMTP_SECURE: secure === "true",
      SMTP_USER: source["SMTP_USER"],
      SMTP_PASSWORD: source["SMTP_PASSWORD"],
    },
  };
}

/** Sends due plan reminders every 15 minutes. Inert without mail settings. Never blocks the worker. */
export function startPlanEmailDispatcher(pool: Pool) {
  const settings = parsePlanEmailWorkerSettings(process.env);
  if (!settings) return { close: async () => {} };
  const transport = createEmailTransport(settings.mail);
  let stopping = false;
  let pending: Promise<void> | undefined;
  const tick = () => {
    if (stopping || pending) return;
    pending = sendDuePlanEmails(
      pool,
      (message) => transport.send({ ...message, from: settings.from }),
      settings.appUrl
    )
      .then(() => undefined)
      .catch(() => console.error("[plan-email] Reminder lane unavailable; retrying safely"))
      .finally(() => {
        pending = undefined;
      });
  };
  const timer = setInterval(tick, PLAN_EMAIL_INTERVAL_MS);
  tick();
  return {
    async close() {
      stopping = true;
      clearInterval(timer);
      await pending;
    },
  };
}
