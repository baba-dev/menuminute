import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { sendDuePlanEmails, type Send } from "../src/modules/plans/notices";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const APP = "https://food.example.com";

async function setSettings(values: Record<string, unknown>) {
  const keys = Object.keys(values);
  await owner(
    `update app_private.plan_settings set ${keys.map((k, i) => `${k}=$${i + 1}`).join(", ")}`,
    keys.map((k) => values[k])
  );
}
beforeAll(() => setSettings({ auto_trial_enabled: true, dunning_grace_enabled: true }));
afterAll(() => setSettings({ auto_trial_enabled: false, dunning_grace_enabled: false }));

/** Runs the real sweep against the real database, capturing mail instead of sending it. */
async function sweep() {
  const mail: Parameters<Send>[0][] = [];
  const result = await admin((_db, pool) =>
    sendDuePlanEmails(
      pool,
      async (m) => {
        mail.push(m);
      },
      APP
    )
  );
  return { ...result, mail };
}
/** Only this test's organization, because other tests' reminders may be due in the shared database. */
const mailFor = (mail: Parameters<Send>[0][], f: F) =>
  mail.filter((m) => m.to === ownerEmail.get(f));
const ownerEmail = new WeakMap<F, string>();
async function track(f: F) {
  const [u] = await owner<{ email: string }>("select email from users where id=$1", [
    f.actor.userId,
  ]);
  ownerEmail.set(f, u!.email);
}

async function publish(f: F) {
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Menu",
        currency: f.outlet.currency,
        categories: [{ id: "c", name: "C", items: [{ id: "d1", name: "D1", priceMinor: 100 }] }],
      },
    },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
}
const trialGrant = async (f: F) =>
  (
    await owner<{ id: string }>(
      "select id from entitlement_grants where organization_id=$1 and operator='auto-trial'",
      [f.outlet.organizationId]
    )
  )[0]!.id;
const endsIn = (grant: string, interval: string) =>
  owner(
    `update entitlement_grants set ends_at=clock_timestamp()+interval '${interval}' where id=$1`,
    [grant]
  );

describe("trial ending reminder", () => {
  it("is not sent while the trial still has plenty of time", async () => {
    const f = await fixture();
    await track(f);
    await publish(f);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
  });

  it("is sent once to the owner when 3 days or less remain, and never again", async () => {
    const f = await fixture();
    await track(f);
    await publish(f);
    await endsIn(await trialGrant(f), "2 days");
    const first = mailFor((await sweep()).mail, f);
    expect(first).toHaveLength(1);
    expect(first[0]!.subject).toMatch(/^Your Ordering trial ends in [23] days$/);
    expect(first[0]!.html).toContain(`href="${APP}/billing"`);
    expect(first[0]!.text).toContain(APP);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
    const rows = await owner<{ status: string }>(
      "select status from app_private.plan_email_notices where organization_id=$1",
      [f.outlet.organizationId]
    );
    expect(rows).toEqual([{ status: "sent" }]);
  });

  it("is dropped, not sent, when the customer paid before it went out", async () => {
    const f = await fixture();
    await track(f);
    await publish(f);
    const grant = await trialGrant(f);
    await endsIn(grant, "2 days");
    // Enqueue only (no send), then the trial is replaced by payment.
    await owner("select app_private.enqueue_plan_email_notices()");
    await owner("update entitlement_grants set revoked_at=clock_timestamp() where id=$1", [grant]);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
    const rows = await owner<{ status: string }>(
      "select status from app_private.plan_email_notices where organization_id=$1",
      [f.outlet.organizationId]
    );
    expect(rows).toEqual([{ status: "abandoned" }]);
  });

  it("does not email an unverified owner", async () => {
    const f = await fixture();
    await track(f);
    await publish(f);
    await endsIn(await trialGrant(f), "2 days");
    await owner("update users set email_verified=false where id=$1", [f.actor.userId]);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
  });
});

describe("payment problem reminders", () => {
  async function failedRenewal(f: F) {
    const sub = "sub_" + crypto.randomUUID().replace(/-/g, "");
    await owner(
      "insert into app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by) values($1,$2,'ordering','plan_notice_test',$3)",
      [sub, f.outlet.organizationId, f.actor.userId]
    );
    const now = Date.now();
    await owner("select app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7)", [
      "evt_" + crypto.randomUUID(),
      sub,
      "plan_notice_test",
      "pay_" + crypto.randomUUID(),
      new Date(now - 30 * 86400000),
      new Date(now + 1500),
      new Date(now),
    ]);
    await new Promise((r) => setTimeout(r, 1800));
    await owner("select app_private.record_razorpay_status($1,$2,'pending',$3)", [
      "evt_" + crypto.randomUUID(),
      sub,
      new Date(Date.now() + 5000),
    ]);
    return sub;
  }
  const graceGrant = async (f: F) =>
    (
      await owner<{ id: string }>(
        "select id from entitlement_grants where organization_id=$1 and operator='dunning-grace'",
        [f.outlet.organizationId]
      )
    )[0]!.id;

  it("tells the owner the payment failed, once, when the grace window opens", async () => {
    const f = await fixture();
    await track(f);
    await failedRenewal(f);
    const mail = mailFor((await sweep()).mail, f);
    expect(mail.map((m) => m.subject)).toEqual(["We could not renew your Ordering plan"]);
    expect(mail[0]!.html).toContain("Update payment method");
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
  });

  it("warns again, once, when the grace window is about to end", async () => {
    const f = await fixture();
    await track(f);
    await failedRenewal(f);
    await sweep(); // payment_failed goes out
    await endsIn(await graceGrant(f), "20 hours");
    const mail = mailFor((await sweep()).mail, f);
    expect(mail.map((m) => m.subject)).toEqual([
      "Ordering pauses soon unless your payment goes through",
    ]);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
  });

  it("sends nothing once the subscription has stopped and the grace is revoked", async () => {
    const f = await fixture();
    await track(f);
    const sub = await failedRenewal(f);
    await owner("select app_private.record_razorpay_status($1,$2,'halted',$3)", [
      "evt_" + crypto.randomUUID(),
      sub,
      new Date(Date.now() + 9000),
    ]);
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
  });
});

describe("delivery safety", () => {
  it("a failing mail provider is retried later, not lost and not repeated", async () => {
    const f = await fixture();
    await track(f);
    await publish(f);
    await endsIn(await trialGrant(f), "2 days");
    const failing = vi.fn(async () => {
      throw new Error("provider down");
    });
    const failed = await admin((_db, pool) => sendDuePlanEmails(pool, failing, APP));
    expect(failed.failed).toBeGreaterThanOrEqual(1);
    // The lease keeps it from being retried at once, then it becomes due again.
    expect(mailFor((await sweep()).mail, f)).toHaveLength(0);
    await owner(
      "update app_private.plan_email_notices set next_attempt_at=clock_timestamp() where organization_id=$1",
      [f.outlet.organizationId]
    );
    expect(mailFor((await sweep()).mail, f)).toHaveLength(1);
  });

  it("the application database role cannot read or run the reminder queue", async () => {
    await expect(
      admin((_db, pool) =>
        pool.query("set role menuminute_app; select * from app_private.plan_email_notices")
      )
    ).rejects.toThrow();
  });
});

describe("shipped defaults", () => {
  it("every plan switch is on by default in a fresh database (migration 0084)", async () => {
    const rows = await owner<{ column_name: string; column_default: string }>(
      `select column_name,column_default from information_schema.columns
        where table_schema='app_private' and table_name='plan_settings' and column_name like '%\\_enabled'
        order by column_name`
    );
    expect(rows.map((r) => [r.column_name, r.column_default])).toEqual([
      ["auto_trial_enabled", "true"],
      ["dunning_grace_enabled", "true"],
      ["free_intake_enabled", "true"],
      ["overflow_hiding_enabled", "true"],
    ]);
  });
});
