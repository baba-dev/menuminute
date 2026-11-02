import { describe, expect, it, vi } from "vitest";
import { planEmail, sendDuePlanEmails, type DueNotice } from "../src/modules/plans/notices";
import { parsePlanEmailWorkerSettings } from "../src/modules/plans/email-worker";

const APP = "https://food.example.com";
const NOW = new Date("2026-11-10T09:00:00Z");
const notice = (over: Partial<DueNotice> = {}): DueNotice => ({
  id: "n1",
  kind: "trial_ending",
  to_email: "owner@example.com",
  to_name: "Asha Rao",
  organization_name: "Spice Route",
  ends_at: "2026-11-12T09:00:00Z",
  ...over,
});

describe("plan reminder wording", () => {
  it("trial ending: names the date, the price and what happens next, with a billing link", () => {
    const mail = planEmail(notice(), APP, NOW);
    expect(mail.subject).toBe("Your Ordering trial ends in 2 days");
    expect(mail.html).toContain("Hi Asha,");
    expect(mail.html).toContain("12 Nov 2026");
    expect(mail.html).toContain("₹119");
    expect(mail.html).toContain("100 orders a month");
    expect(mail.html).toContain(`href="${APP}/billing"`);
    expect(mail.text).toContain("Spice Route");
    expect(mail.text.match(/https?:\/\/\S+/)?.[0]).toBe(`${APP}/billing`);
  });

  it("trial ending: says tomorrow on the last day", () => {
    const mail = planEmail(notice({ ends_at: "2026-11-11T09:00:00Z" }), APP, NOW);
    expect(mail.subject).toBe("Your Ordering trial ends tomorrow");
  });

  it("payment failed and grace ending are distinct and urgent", () => {
    const failed = planEmail(
      notice({ kind: "payment_failed", ends_at: "2026-11-15T00:00:00Z" }),
      APP,
      NOW
    );
    expect(failed.subject).toBe("We could not renew your Ordering plan");
    expect(failed.html).toContain("Ordering stays on until 15 Nov 2026");
    const ending = planEmail(
      notice({ kind: "grace_ending", ends_at: "2026-11-11T00:00:00Z" }),
      APP,
      NOW
    );
    expect(ending.subject).toBe("Ordering pauses soon unless your payment goes through");
    expect(ending.html).toContain("Update payment method");
    expect(failed.subject).not.toBe(ending.subject);
  });

  it("greets generically when the account has no usable name, and escapes names", () => {
    expect(planEmail(notice({ to_name: "   " }), APP, NOW).html).toContain("Hello,");
    const mail = planEmail(notice({ organization_name: "<b>Bad</b> Cafe" }), APP, NOW);
    expect(mail.html).not.toContain("<b>Bad</b>");
    expect(mail.html).toContain("&lt;b&gt;Bad&lt;/b&gt; Cafe");
  });
});

describe("sending due reminders", () => {
  const poolWith = (rows: DueNotice[]) => {
    const query = vi.fn(async (text: string, _params?: unknown[]) => {
      if (text.includes("enqueue_plan_email_notices")) return { rows: [{ n: rows.length }] };
      if (text.includes("claim_plan_email_notices")) return { rows };
      return { rows: [] };
    });
    return { query } as unknown as Parameters<typeof sendDuePlanEmails>[0] & {
      query: typeof query;
    };
  };

  it("sends each leased reminder and reports it complete", async () => {
    const pool = poolWith([notice({ id: "a" }), notice({ id: "b", kind: "payment_failed" })]);
    const send = vi.fn(async (_m: unknown) => {});
    const result = await sendDuePlanEmails(pool, send, APP, { now: NOW });
    expect(result).toEqual({ queued: 2, sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "owner@example.com" });
    const completed = pool.query.mock.calls.filter((c) => String(c[0]).includes("complete_plan"));
    expect(completed.map((c) => (c[1] as string[])[0])).toEqual(["a", "b"]);
  });

  it("a failed send is not completed (so it retries) and does not stop the others", async () => {
    const pool = poolWith([notice({ id: "a" }), notice({ id: "b" })]);
    const send = vi
      .fn<(m: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce();
    const result = await sendDuePlanEmails(pool, send, APP, { now: NOW });
    expect(result).toEqual({ queued: 2, sent: 1, failed: 1 });
    const completed = pool.query.mock.calls.filter((c) => String(c[0]).includes("complete_plan"));
    expect(completed.map((c) => (c[1] as string[])[0])).toEqual(["b"]);
  });
});

describe("worker mail settings", () => {
  it("is off without a real provider", () => {
    expect(parsePlanEmailWorkerSettings({})).toBeNull();
    expect(parsePlanEmailWorkerSettings({ EMAIL_PROVIDER: "test" })).toBeNull();
  });
  it("accepts a complete resend or smtp setup", () => {
    expect(
      parsePlanEmailWorkerSettings({
        EMAIL_PROVIDER: "resend",
        APP_URL: APP,
        EMAIL_FROM: "MenuMinute <hello@example.com>",
        RESEND_API_KEY: "re_x",
      })?.mail.EMAIL_PROVIDER
    ).toBe("resend");
    const smtp = parsePlanEmailWorkerSettings({
      EMAIL_PROVIDER: "smtp",
      APP_URL: APP,
      EMAIL_FROM: "hello@example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "u",
      SMTP_PASSWORD: "p",
    });
    expect(smtp?.mail).toMatchObject({ SMTP_PORT: 587, SMTP_SECURE: false });
  });
  it("fails loudly on a half-configured provider", () => {
    expect(() =>
      parsePlanEmailWorkerSettings({ EMAIL_PROVIDER: "resend", APP_URL: APP })
    ).toThrow();
    expect(() =>
      parsePlanEmailWorkerSettings({ EMAIL_PROVIDER: "smtp", APP_URL: APP, EMAIL_FROM: "a@b.co" })
    ).toThrow();
    expect(() => parsePlanEmailWorkerSettings({ EMAIL_PROVIDER: "bogus" })).toThrow();
  });
});
