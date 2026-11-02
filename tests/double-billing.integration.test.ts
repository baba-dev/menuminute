import { afterEach, describe, expect, it, vi } from "vitest";

// Use the real restricted billing identity, exactly as the webhook does.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return {
    ...mod,
    env: {
      ...mod.env,
      RAZORPAY_ENABLED: true,
      RAZORPAY_KEY_ID: "rzp_test_double",
      RAZORPAY_KEY_SECRET: "secret_double",
      BILLING_DATABASE_URL: `postgresql://menuminute_billing:isolated-ci-billing-password@127.0.0.1:${
        new URL(process.env["MIGRATION_DATABASE_URL"]!).port || "5432"
      }/menuminute_test`,
    },
  };
});

import { admin, fixture } from "./helpers";
import { supersedeOrderingSubscriptions } from "../src/modules/billing/razorpay";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const subId = () => "sub_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);

/** A subscription row, optionally with a recorded verified charge (as the webhook would leave it). */
async function subscription(
  f: F,
  product: "ordering" | "kitchen_pro",
  opts: { charged?: boolean; status?: string } = {}
) {
  const id = subId();
  await owner(
    "insert into app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by,status) values($1,$2,$3,'plan_double_test',$4,$5)",
    [id, f.outlet.organizationId, product, f.actor.userId, opts.status ?? "active"]
  );
  if (opts.charged) {
    const grantId = crypto.randomUUID();
    await owner(
      "insert into entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key) values($1,$2,$3,'INR',now()-interval '1 day',now()+interval '29 days','razorpay-webhook','test charge',$4)",
      [
        grantId,
        f.outlet.organizationId,
        product === "ordering" ? "ordering.new" : "kitchen.new",
        crypto.randomUUID(),
      ]
    );
    await owner(
      "insert into app_private.razorpay_charges(event_id,subscription_id,payment_id,grant_id) values($1,$2,$3,$4)",
      ["evt_" + crypto.randomUUID(), id, "pay_" + crypto.randomUUID(), grantId]
    );
  }
  return id;
}
const cancelRequested = async (id: string) =>
  (
    await owner<{ c: Date | null }>(
      "select cancel_requested_at c from app_private.razorpay_subscriptions where subscription_id=$1",
      [id]
    )
  )[0]!.c;

const fetchMock = vi.fn();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});
const providerOk = (id: string) => new Response(JSON.stringify({ id }), { status: 200 });

describe("Kitchen Pro replaces Ordering without double billing", () => {
  it("stops the Ordering subscription at the provider (end of cycle) and records it", async () => {
    const f = await fixture();
    const ordering = await subscription(f, "ordering", { charged: true });
    const kitchen = await subscription(f, "kitchen_pro", { charged: true });
    fetchMock.mockImplementation(async (url: string) => providerOk(url.split("/")[5]!));
    vi.stubGlobal("fetch", fetchMock);
    expect(await supersedeOrderingSubscriptions(kitchen)).toEqual([ordering]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.razorpay.com/v1/subscriptions/${ordering}/cancel`);
    expect(JSON.parse(init.body)).toEqual({ cancel_at_cycle_end: true });
    expect(await cancelRequested(ordering)).not.toBeNull();
    // Kitchen's own subscription is never touched, and a repeat does nothing further.
    expect(await cancelRequested(kitchen)).toBeNull();
    fetchMock.mockClear();
    expect(await supersedeOrderingSubscriptions(kitchen)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing until the Kitchen Pro payment is verified, and never crosses organizations", async () => {
    const f = await fixture();
    const other = await fixture();
    await subscription(f, "ordering", { charged: true });
    const stranger = await subscription(other, "ordering", { charged: true });
    const unpaidKitchen = await subscription(f, "kitchen_pro"); // checkout started, no charge
    vi.stubGlobal("fetch", fetchMock);
    expect(await supersedeOrderingSubscriptions(unpaidKitchen)).toEqual([]);
    const paidKitchen = await subscription(f, "kitchen_pro", { charged: true });
    fetchMock.mockImplementation(async (url: string) => providerOk(url.split("/")[5]!));
    const done = await supersedeOrderingSubscriptions(paidKitchen);
    expect(done).toHaveLength(1);
    expect(done).not.toContain(stranger);
    expect(await cancelRequested(stranger)).toBeNull();
  });

  it("skips Ordering subscriptions that are already stopping, never charged, or already over", async () => {
    const f = await fixture();
    const stopping = await subscription(f, "ordering", { charged: true });
    await owner(
      "update app_private.razorpay_subscriptions set cancel_requested_at=now() where subscription_id=$1",
      [stopping]
    );
    await subscription(f, "ordering", { status: "created" });
    await subscription(f, "ordering", { charged: true, status: "cancelled" });
    const kitchen = await subscription(f, "kitchen_pro", { charged: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await supersedeOrderingSubscriptions(kitchen)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a subscription the provider already ended or scheduled to end as done", async () => {
    const f = await fixture();
    const ordering = await subscription(f, "ordering", { charged: true });
    const kitchen = await subscription(f, "kitchen_pro", { charged: true });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 })).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "active", has_scheduled_changes: true }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await supersedeOrderingSubscriptions(kitchen)).toEqual([ordering]);
    expect(await cancelRequested(ordering)).not.toBeNull();
  });

  it("fails loudly, and records nothing, when the provider really cannot stop it, so the webhook retries", async () => {
    const f = await fixture();
    const ordering = await subscription(f, "ordering", { charged: true });
    const kitchen = await subscription(f, "kitchen_pro", { charged: true });
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "active" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(supersedeOrderingSubscriptions(kitchen)).rejects.toThrow(/Unable to stop/);
    expect(await cancelRequested(ordering)).toBeNull();
    // The retry succeeds and still finds the subscription.
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => providerOk(url.split("/")[5]!));
    expect(await supersedeOrderingSubscriptions(kitchen)).toEqual([ordering]);
  });

  it("only the restricted billing identity can run the two functions", async () => {
    const f = await fixture();
    const { getPool } = await import("../src/db");
    await expect(
      getPool().query("select app_private.subscriptions_superseded_by($1)", [subId()])
    ).rejects.toThrow();
    await expect(
      getPool().query("select app_private.mark_subscription_superseded($1,$2)", [subId(), subId()])
    ).rejects.toThrow();
    expect(f.outlet.id).toBeTruthy();
  });
});
