import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { createRestaurant } from "../src/modules/restaurants/service";
import { withOutlet } from "../src/modules/tenancy/service";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);

async function setSettings(values: Record<string, unknown>) {
  const keys = Object.keys(values);
  await owner(
    `update app_private.plan_settings set ${keys.map((k, i) => `${k}=$${i + 1}`).join(", ")}`,
    keys.map((k) => values[k])
  );
}
afterAll(async () => {
  await setSettings({
    auto_trial_enabled: false,
    auto_trial_days: 14,
    dunning_grace_enabled: false,
    dunning_grace_days: 5,
  });
});

async function publish(f: F, outletId = f.outlet.id) {
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, outletId, menuId, {
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
  await commandMenu(f.actor, outletId, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  return menuId;
}
const orderingGrants = (f: F) =>
  owner<{ operator: string; starts_at: Date; ends_at: Date; revoked_at: Date | null }>(
    "select operator,starts_at,ends_at,revoked_at from entitlement_grants where organization_id=$1 and capability='ordering.new' order by created_at",
    [f.outlet.organizationId]
  );
const allowed = async (f: F) =>
  (
    await owner<{ a: boolean }>(
      "select exists(select 1 from entitlement_grants where organization_id=$1 and capability='ordering.new' and revoked_at is null and starts_at<=now() and ends_at>now()) a",
      [f.outlet.organizationId]
    )
  )[0]!.a;
const lifecycle = (f: F, actor = f.actor) =>
  withOutlet(actor, f.outlet.id, "menu.read", async (tx) => {
    const r = await tx.execute<{ s: { trial: unknown; dunning: unknown } | null }>(
      sql`select app_private.plan_lifecycle_snapshot(${f.outlet.id}) as s`
    );
    return r.rows[0]?.s ?? null;
  });
const blocks = (f: F, actor = f.actor) =>
  withOutlet(actor, f.outlet.id, "menu.read", async (tx) => {
    const r = await tx.execute<{ b: boolean }>(
      sql`select app_private.entitlement_blocks_checkout(${f.outlet.organizationId},'ordering.new') as b`
    );
    return r.rows[0]!.b;
  });

describe("automatic trial", () => {
  it("does nothing while the owner switch is off", async () => {
    await setSettings({ auto_trial_enabled: false });
    const f = await fixture();
    await publish(f);
    expect(await orderingGrants(f)).toEqual([]);
  });

  it("starts exactly one time-boxed trial on the owner's first publish, and never again", async () => {
    await setSettings({ auto_trial_enabled: true, auto_trial_days: 14 });
    const f = await fixture();
    await publish(f);
    const grants = await orderingGrants(f);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ operator: "auto-trial", revoked_at: null });
    const days = (grants[0]!.ends_at.getTime() - grants[0]!.starts_at.getTime()) / 86400000;
    expect(days).toBeCloseTo(14, 1);
    expect(await allowed(f)).toBe(true);
    await publish(f); // a second publish must not mint another
    expect(await orderingGrants(f)).toHaveLength(1);
    expect(await lifecycle(f)).toMatchObject({ trial: { endsAt: expect.anything() } });
    // The trial must not block paying.
    expect(await blocks(f)).toBe(false);
  });

  it("is once per owner account, so extra workspaces cannot farm trials", async () => {
    await setSettings({ auto_trial_enabled: true });
    const f = await fixture();
    await publish(f);
    const second = await createRestaurant(f.actor.userId, {
      name: "Second workspace",
      country: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      outletType: "restaurant",
    });
    await publish(f, second.id);
    const rows = await owner<{ n: number }>(
      "select count(*)::int n from entitlement_grants where organization_id=$1",
      [second.organizationId]
    );
    expect(rows[0]!.n).toBe(0);
  });

  it("requires a verified owner, an organization with no past access, and a non-demo outlet", async () => {
    await setSettings({ auto_trial_enabled: true });
    const unverified = await fixture();
    await owner("update users set email_verified=false where id=$1", [unverified.actor.userId]);
    await publish(unverified);
    expect(await orderingGrants(unverified)).toEqual([]);

    const hadAccess = await fixture();
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: hadAccess.outlet.organizationId,
        operator: "trial-test",
        reason: "Earlier operator grant",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        endsAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      });
    });
    await publish(hadAccess);
    expect((await orderingGrants(hadAccess)).map((g) => g.operator)).toEqual(["trial-test"]);

    const demo = await fixture();
    await owner("update restaurants set is_demo_data=true where id=$1", [demo.outlet.id]);
    await publish(demo);
    expect(await orderingGrants(demo)).toEqual([]);
  });
});

describe("paying during a trial and failed renewals", () => {
  const plan = "plan_lifecycle_test";
  async function subscribe(f: F) {
    const subscription = "sub_" + crypto.randomUUID().replace(/-/g, "");
    await owner(
      "insert into app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by) values($1,$2,'ordering',$3,$4)",
      [subscription, f.outlet.organizationId, plan, f.actor.userId]
    );
    return subscription;
  }
  let tick = Date.now();
  const stamp = () => new Date((tick += 1000));
  const charge = (sub: string, startMs: number, endMs: number) =>
    owner<{ g: string }>("select app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7) g", [
      "evt_" + crypto.randomUUID(),
      sub,
      plan,
      "pay_" + crypto.randomUUID(),
      new Date(startMs),
      new Date(endMs),
      stamp(),
    ]);
  const status = (sub: string, st: string) =>
    owner("select app_private.record_razorpay_status($1,$2,$3,$4)", [
      "evt_" + crypto.randomUUID(),
      sub,
      st,
      stamp(),
    ]);

  it("a verified payment during the trial ends the trial and starts the paid month, never overlapping", async () => {
    await setSettings({ auto_trial_enabled: true });
    const f = await fixture();
    await publish(f);
    const sub = await subscribe(f);
    const now = Date.now();
    await charge(sub, now - 1000, now + 29 * 86400000);
    const grants = await orderingGrants(f);
    expect(grants.map((g) => [g.operator, g.revoked_at !== null])).toEqual([
      ["auto-trial", true],
      ["razorpay-webhook", false],
    ]);
    expect(await allowed(f)).toBe(true);
    // Real paid access now blocks a second checkout; the lifecycle no longer shows a trial.
    expect(await blocks(f)).toBe(true);
    expect((await lifecycle(f))?.trial).toBeNull();
  });

  it("opens one short grace window when a paid renewal fails, and ends it when the subscription stops", async () => {
    await setSettings({ dunning_grace_enabled: true, dunning_grace_days: 5 });
    const f = await fixture();
    const sub = await subscribe(f);
    const now = Date.now();
    await charge(sub, now - 30 * 86400000, now + 1500); // the paid month ends in 1.5s
    await new Promise((r) => setTimeout(r, 1800));
    expect(await allowed(f)).toBe(false);
    await status(sub, "pending");
    let grants = await orderingGrants(f);
    expect(grants.map((g) => g.operator)).toEqual(["razorpay-webhook", "dunning-grace"]);
    const grace = grants[1]!;
    expect((grace.ends_at.getTime() - grace.starts_at.getTime()) / 86400000).toBeCloseTo(5, 1);
    expect(await allowed(f)).toBe(true);
    expect(await blocks(f)).toBe(false); // grace must not block paying again
    expect(await lifecycle(f)).toMatchObject({ dunning: { status: "pending" } });
    // Every further retry notice for the same billing cycle changes nothing.
    await status(sub, "pending");
    await status(sub, "pending");
    expect((await orderingGrants(f)).filter((g) => g.operator === "dunning-grace")).toHaveLength(1);
    // The provider gives up: access ends with the grace.
    await status(sub, "halted");
    grants = await orderingGrants(f);
    expect(grants.find((g) => g.operator === "dunning-grace")?.revoked_at).not.toBeNull();
    expect(await allowed(f)).toBe(false);
    expect(await lifecycle(f)).toMatchObject({ dunning: { status: "halted" } });
  });

  it("a late successful charge during the grace replaces it cleanly", async () => {
    await setSettings({ dunning_grace_enabled: true });
    const f = await fixture();
    const sub = await subscribe(f);
    const now = Date.now();
    const periodEnd = now + 1500;
    await charge(sub, now - 30 * 86400000, periodEnd);
    await new Promise((r) => setTimeout(r, 1800));
    await status(sub, "pending");
    // The provider's next period starts exactly where the last one ended, inside the grace window.
    await charge(sub, periodEnd, Date.now() + 29 * 86400000);
    const ops = (await orderingGrants(f)).map((g) => [g.operator, g.revoked_at !== null]);
    expect(ops).toEqual([
      ["razorpay-webhook", false],
      ["dunning-grace", true],
      ["razorpay-webhook", false],
    ]);
    expect(await allowed(f)).toBe(true);
  });

  it("gives no grace when the feature is off, the customer cancelled, or it was never paid", async () => {
    await setSettings({ dunning_grace_enabled: false });
    const off = await fixture();
    const offSub = await subscribe(off);
    await charge(offSub, Date.now() - 30 * 86400000, Date.now() + 1500);
    await new Promise((r) => setTimeout(r, 1800));
    await status(offSub, "pending");
    expect((await orderingGrants(off)).map((g) => g.operator)).toEqual(["razorpay-webhook"]);

    await setSettings({ dunning_grace_enabled: true });
    const cancelled = await fixture();
    const cSub = await subscribe(cancelled);
    await charge(cSub, Date.now() - 30 * 86400000, Date.now() + 1500);
    await owner(
      "update app_private.razorpay_subscriptions set cancel_requested_at=now() where subscription_id=$1",
      [cSub]
    );
    await new Promise((r) => setTimeout(r, 1800));
    await status(cSub, "pending");
    expect((await orderingGrants(cancelled)).map((g) => g.operator)).toEqual(["razorpay-webhook"]);

    const fresh = await fixture();
    const freshSub = await subscribe(fresh); // checkout started, never charged
    await status(freshSub, "pending");
    expect(await orderingGrants(fresh)).toEqual([]);
  });

  it("only owners can ask whether checkout is blocked", async () => {
    const f = await fixture();
    const other = await fixture();
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "ops",
        reason: "Operator grant",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    expect(await blocks(f)).toBe(true); // a real operator grant blocks, unlike a trial
    await expect(blocks(f, other.actor)).rejects.toThrow();
  });
});
