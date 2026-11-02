import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { submitGuestOrder } from "../src/modules/orders/service";
import {
  guestPushOutlet,
  guestPushState,
  guestPushSubscribe,
  guestPushUnsubscribe,
} from "../src/modules/guest-push/service";
import { pushEndpointHash } from "../src/modules/pwa/vapid";
import { env } from "../src/lib/config/env";
import { getPool } from "../src/db";

const endpoint = () =>
  "https://fcm.googleapis.com/fcm/send/" + crypto.randomUUID() + "-" + "x".repeat(20);

async function placedOrder() {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Push menu",
        currency: f.outlet.currency,
        categories: [
          { id: "food", name: "Food", items: [{ id: "plate", name: "Plate", priceMinor: 10000 }] },
        ],
      },
    },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  await admin(async (_db, pool) =>
    applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "push-test",
      reason: "Guest push integration",
      action: "grant",
      capability: "ordering.new",
      billingCurrency: "USD",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    })
  );
  const order = await submitGuestOrder(f.outlet.publicId, {
    clientSubmissionKey: crypto.randomUUID(),
    quotedTotalMinor: 10000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: "plate", quantity: 1 }],
  });
  return { f, token: f.outlet.publicId, orderId: order.orderId, tracking: order.trackingToken };
}

async function statusEvent(orderId: string, outletId: string, to: string) {
  await admin(async (_db, pool) => {
    await pool.query(
      `insert into order_status_events(id,order_id,restaurant_id,from_status,to_status,status)
       values($1,$2,$3,'pending',$4,$4)`,
      [crypto.randomUUID(), orderId, outletId, to]
    );
  });
}
const deliveries = (orderId: string) =>
  admin(
    async (_db, pool) =>
      (
        await pool.query<{ kind: string; status: string }>(
          `select d.kind,d.status from guest_push_deliveries d
         join guest_push_subscriptions s on s.id=d.subscription_id where s.order_id=$1 order by d.created_at`,
          [orderId]
        )
      ).rows
  );

describe("guest order push (migration 0105)", () => {
  it("subscribes through the order's tracking capability only", async () => {
    const o = await placedOrder();
    const e = endpoint();
    await expect(
      guestPushSubscribe(o.orderId, { token: o.token, trackingToken: "x".repeat(24), endpoint: e })
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      guestPushSubscribe(o.orderId, {
        token: o.token,
        trackingToken: o.tracking,
        endpoint: "https://evil.example/push/" + "y".repeat(30),
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      guestPushSubscribe(o.orderId, { token: o.token, trackingToken: o.tracking, endpoint: e })
    ).resolves.toEqual({ subscribed: true });
    expect(
      (await guestPushState(o.token, o.orderId, o.tracking, pushEndpointHash(e))).subscribed
    ).toBe(true);
    expect(
      (await guestPushState(o.token, o.orderId, o.tracking, pushEndpointHash(endpoint())))
        .subscribed
    ).toBe(false);
    // Another restaurant's menu token cannot see or use this order's capability.
    const other = await placedOrder();
    await expect(guestPushState(other.token, o.orderId, o.tracking, null)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(getPool().query("select * from guest_push_subscriptions")).rejects.toThrow();
  });

  it("captures a delivery per status change for subscribed orders only", async () => {
    const a = await placedOrder();
    const b = await placedOrder();
    await guestPushSubscribe(a.orderId, {
      token: a.token,
      trackingToken: a.tracking,
      endpoint: endpoint(),
    });
    for (const status of ["accepted", "preparing", "served"])
      await statusEvent(a.orderId, a.f.outlet.id, status);
    await statusEvent(b.orderId, b.f.outlet.id, "accepted");
    expect((await deliveries(a.orderId)).map((d) => d.kind)).toEqual(["accepted", "preparing"]);
    expect(await deliveries(b.orderId)).toEqual([]);
  });

  it("lets the isolated worker role lease one endpoint at a time and honours outlet rollout", async () => {
    const o = await placedOrder();
    const e = endpoint();
    await guestPushSubscribe(o.orderId, { token: o.token, trackingToken: o.tracking, endpoint: e });
    await statusEvent(o.orderId, o.f.outlet.id, "ready");
    const worker = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 1 });
    try {
      await expect(worker.query("select * from guest_push_subscriptions")).rejects.toThrow();
      const claim = (outlets: string[]) =>
        worker
          .query<{ data: { id: string; endpoint: string; lease: string } | null }>(
            "select app_private.guest_push_claim($1::text[]) as data",
            [outlets]
          )
          .then((r) => r.rows[0]!.data);
      expect(await claim([crypto.randomUUID()])).toBeNull();
      const job = (await claim([o.f.outlet.id]))!;
      expect(job.endpoint).toBe(e);
      // A leased delivery is not handed out twice.
      expect(await claim([o.f.outlet.id])).toBeNull();
      await worker.query("select app_private.guest_push_finish($1,$2,'accepted')", [
        job.id,
        job.lease,
      ]);
      expect((await deliveries(o.orderId))[0]).toMatchObject({ kind: "ready", status: "accepted" });
      // A stale lease cannot overwrite a finished delivery.
      await worker.query("select app_private.guest_push_finish($1,$2,'failed')", [
        job.id,
        job.lease,
      ]);
      expect((await deliveries(o.orderId))[0]!.status).toBe("accepted");

      // A permanently gone endpoint disables the subscription and stops further deliveries.
      await statusEvent(o.orderId, o.f.outlet.id, "cancelled");
      const second = (await claim([o.f.outlet.id]))!;
      await worker.query("select app_private.guest_push_finish($1,$2,'gone')", [
        second.id,
        second.lease,
      ]);
      await statusEvent(o.orderId, o.f.outlet.id, "accepted");
      expect(await claim([o.f.outlet.id])).toBeNull();
    } finally {
      await worker.end();
    }
  });

  it("refuses finished orders, the demo tenant and too many devices, and unsubscribes", async () => {
    const o = await placedOrder();
    for (let i = 0; i < 3; i++)
      await guestPushSubscribe(o.orderId, {
        token: o.token,
        trackingToken: o.tracking,
        endpoint: endpoint(),
      });
    await expect(
      guestPushSubscribe(o.orderId, {
        token: o.token,
        trackingToken: o.tracking,
        endpoint: endpoint(),
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    const e = endpoint();
    const solo = await placedOrder();
    await guestPushSubscribe(solo.orderId, {
      token: solo.token,
      trackingToken: solo.tracking,
      endpoint: e,
    });
    await guestPushUnsubscribe(solo.orderId, {
      token: solo.token,
      trackingToken: solo.tracking,
      endpoint: e,
    });
    await statusEvent(solo.orderId, solo.f.outlet.id, "accepted");
    expect(await deliveries(solo.orderId)).toEqual([]);

    await admin(async (_db, pool) => {
      await pool.query("update orders set status='served' where id=$1", [solo.orderId]);
    });
    await expect(
      guestPushSubscribe(solo.orderId, {
        token: solo.token,
        trackingToken: solo.tracking,
        endpoint: endpoint(),
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    const demo = await placedOrder();
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_demo_data=true where id=$1", [demo.f.outlet.id]);
    });
    await expect(
      guestPushSubscribe(demo.orderId, {
        token: demo.token,
        trackingToken: demo.tracking,
        endpoint: endpoint(),
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("shares the staff rollout gate and prunes expired subscriptions", async () => {
    const o = await placedOrder();
    const before = { enabled: env.PWA_PUSH_ENABLED, ids: [...env.PWA_PUSH_OUTLET_IDS] };
    try {
      (env as { PWA_PUSH_ENABLED: boolean }).PWA_PUSH_ENABLED = false;
      expect(await guestPushOutlet(o.token)).toBeNull();
      (env as { PWA_PUSH_ENABLED: boolean }).PWA_PUSH_ENABLED = true;
      (env as { PWA_PUSH_OUTLET_IDS: string[] }).PWA_PUSH_OUTLET_IDS = [crypto.randomUUID()];
      expect(await guestPushOutlet(o.token)).toBeNull();
      (env as { PWA_PUSH_OUTLET_IDS: string[] }).PWA_PUSH_OUTLET_IDS = [o.f.outlet.id];
      expect(await guestPushOutlet(o.token)).toBe(o.f.outlet.id);
    } finally {
      (env as { PWA_PUSH_ENABLED: boolean }).PWA_PUSH_ENABLED = before.enabled;
      (env as { PWA_PUSH_OUTLET_IDS: string[] }).PWA_PUSH_OUTLET_IDS = before.ids;
    }
    await guestPushSubscribe(o.orderId, {
      token: o.token,
      trackingToken: o.tracking,
      endpoint: endpoint(),
    });
    await admin(async (_db, pool) => {
      await pool.query(
        "update guest_push_subscriptions set expires_at=now()-interval '2 days' where order_id=$1",
        [o.orderId]
      );
      await pool.query("select app_private.guest_push_prune()");
      expect(
        (await pool.query("select 1 from guest_push_subscriptions where order_id=$1", [o.orderId]))
          .rowCount
      ).toBe(0);
    });
  });
});
