import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const DAY = 86_400_000;

// Kitchen Pro paid charges need the platform's Kitchen release switched on (as it is in production).
beforeAll(() =>
  owner("update app_private.kitchen_commercial_release set enabled=true where singleton")
);
afterAll(() =>
  owner("update app_private.kitchen_commercial_release set enabled=false where singleton")
);

async function subscribe(f: F, product: "ordering" | "kitchen_pro") {
  const id = "sub_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  await owner(
    "insert into app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by) values($1,$2,$3,$4,$5)",
    [id, f.outlet.organizationId, product, "plan_" + product, f.actor.userId]
  );
  return id;
}
let tick = Date.now();
const created = () => new Date((tick += 1000));
async function charge(sub: string, product: string, startMs: number, endMs: number) {
  const pay = "pay_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  const rows = await owner<{ g: string }>(
    "select app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7) g",
    [
      "evt_" + crypto.randomUUID(),
      sub,
      "plan_" + product,
      pay,
      new Date(startMs),
      new Date(endMs),
      created(),
    ]
  );
  return { grant: rows[0]!.g, payment: pay };
}
const allowed = async (f: F, capability: string) =>
  (
    await owner<{ a: boolean }>(
      "select exists(select 1 from entitlement_grants where organization_id=$1 and capability=$2 and revoked_at is null and starts_at<=now() and ends_at>now()) a",
      [f.outlet.organizationId, capability]
    )
  )[0]!.a;

describe("the real upgrade and renewal paths through the charge function", () => {
  it("upgrading to Kitchen Pro in the middle of a paid Ordering month grants Kitchen and keeps ordering on", async () => {
    const f = await fixture();
    const ordering = await subscribe(f, "ordering");
    const now = Date.now();
    await charge(ordering, "ordering", now - 5 * DAY, now + 25 * DAY);
    expect(await allowed(f, "ordering.new")).toBe(true);
    expect(await allowed(f, "kitchen.new")).toBe(false);

    const kitchen = await subscribe(f, "kitchen_pro");
    // Kitchen Pro's first period starts now, while the Ordering month still has 25 days left.
    await charge(kitchen, "kitchen_pro", now, now + 30 * DAY);
    expect(await allowed(f, "kitchen.new")).toBe(true);
    expect(await allowed(f, "ordering.new")).toBe(true);
    const grants = await owner<{ capability: string; revoked_at: Date | null }>(
      "select capability,revoked_at from entitlement_grants where organization_id=$1 order by created_at",
      [f.outlet.organizationId]
    );
    expect(
      grants
        .filter((g) => g.revoked_at === null)
        .map((g) => g.capability)
        .sort()
    ).toEqual(["kitchen.new", "ordering.new", "ordering.new"]);
  });

  it("a normal renewal, starting exactly where the last period ended, is accepted for both plans", async () => {
    const f = await fixture();
    for (const product of ["ordering", "kitchen_pro"] as const) {
      const sub = await subscribe(f, product);
      const start = Date.now() - 2 * DAY;
      const first = await charge(sub, product, start, start + 30 * DAY);
      const second = await charge(sub, product, start + 30 * DAY, start + 60 * DAY);
      expect(second.grant).not.toBe(first.grant);
    }
  });

  it("a renewal whose period overlaps the last one is refused (provider periods are contiguous)", async () => {
    const f = await fixture();
    const sub = await subscribe(f, "ordering");
    const start = Date.now() - 2 * DAY;
    await charge(sub, "ordering", start, start + 30 * DAY);
    await expect(charge(sub, "ordering", start + 29 * DAY, start + 59 * DAY)).rejects.toThrow(
      /Overlapping/
    );
  });

  it("the same webhook delivered twice does nothing the second time", async () => {
    const f = await fixture();
    const sub = await subscribe(f, "ordering");
    const now = Date.now();
    const event = "evt_" + crypto.randomUUID();
    const pay = "pay_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
    const call = () =>
      owner<{ g: string }>("select app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7) g", [
        event,
        sub,
        "plan_ordering",
        pay,
        new Date(now - DAY),
        new Date(now + 29 * DAY),
        created(),
      ]);
    const first = (await call())[0]!.g;
    expect((await call())[0]!.g).toBe(first);
    const n = await owner<{ n: number }>(
      "select count(*)::int n from entitlement_grants where organization_id=$1 and capability='ordering.new'",
      [f.outlet.organizationId]
    );
    expect(n[0]!.n).toBe(1);
  });

  it("a full refund of the Kitchen Pro payment ends Kitchen and its bundled ordering, not the separate Ordering month", async () => {
    const f = await fixture();
    const ordering = await subscribe(f, "ordering");
    const now = Date.now();
    await charge(ordering, "ordering", now - 5 * DAY, now + 25 * DAY);
    const kitchen = await subscribe(f, "kitchen_pro");
    const k = await charge(kitchen, "kitchen_pro", now, now + 30 * DAY);
    await owner("select app_private.record_razorpay_refund($1,$2)", [
      "evt_" + crypto.randomUUID(),
      k.payment,
    ]);
    expect(await allowed(f, "kitchen.new")).toBe(false);
    // The still-paid Ordering month keeps ordering on.
    expect(await allowed(f, "ordering.new")).toBe(true);
  });
});
