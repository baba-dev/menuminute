import { describe, it, expect } from "vitest";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu, qrCommand, publicProduct } from "../src/modules/menu-product/service";
import {
  submitGuestOrder,
  getGuestOrderTracking,
  listOutletOrders,
  transitionOutletOrder,
} from "../src/modules/orders/service";
import { getPool } from "../src/db";

async function publishedOutlet(entitled = true) {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Order test menu",
        currency: f.outlet.currency,
        categories: [
          {
            id: "food",
            name: "Food",
            items: [
              {
                id: "plate",
                name: "Paneer Plate",
                priceMinor: 12500,
                addOnGroups: [
                  {
                    id: "extras",
                    name: "Extras",
                    min: 0,
                    max: 1,
                    options: [{ id: "bread", name: "Bread", priceMinor: 1500 }],
                  },
                ],
              },
            ],
          },
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
  if (entitled) {
    await admin(async (_, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "ordering-test",
        reason: "Ordering integration test",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "USD",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
  }
  return { ...f, menuId };
}

function submission(key = crypto.randomUUID()) {
  return {
    clientSubmissionKey: key,
    quotedTotalMinor: 14000,
    fulfillmentMode: "dine_in",
    items: [
      {
        dishId: "plate",
        quantity: 1,
        selectedAddOns: [{ groupId: "extras", optionId: "bread" }],
      },
    ],
  };
}

describe("Core online ordering restricted-role integration", () => {
  it("requires an explicit ordering entitlement and preserves the free menu", async () => {
    const f = await publishedOutlet(false);
    expect((await publicProduct(f.outlet.publicId))?.outlet.orderingEnabled).toBe(false);
    await expect(submitGuestOrder(f.outlet.publicId, submission())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("submits, scopes and tracks an order, persists the table and rejects cross-outlet access", async () => {
    const f = await publishedOutlet();
    const point = await qrCommand(f.actor, f.outlet.id, {
      key: crypto.randomUUID(),
      action: "create",
      data: { label: "Table ordering", pointLabel: "Table 4" },
    });
    const order = await submitGuestOrder(point.token!, submission());
    expect(order.status).toBe("pending");
    expect(order.totalMinor).toBe(14000);
    const details = (await getGuestOrderTracking(
      point.token!,
      order.orderId,
      order.trackingToken
    )) as {
      order: { status: string };
      items: Array<{ itemName: string; selectedOptions: unknown[] }>;
    };
    expect(details.order.status).toBe("pending");
    expect(details.items[0]?.itemName).toBe("Paneer Plate");
    expect(details.items[0]?.selectedOptions).toHaveLength(1);
    const rows = await listOutletOrders(f.actor, f.outlet.id, "active", f.outlet.organizationId);
    expect(rows.find((r) => r.id === order.orderId)?.tableId).toBeTruthy();
    expect(JSON.stringify(rows)).not.toContain(order.trackingToken);
    await expect(listOutletOrders(f.actor, f.outlet.id, "active", "wrong-org")).rejects.toThrow();
    await expect(
      getGuestOrderTracking(f.outlet.publicId, order.orderId, "bad-token")
    ).rejects.toThrow();
    await expect(
      getPool().query(
        "insert into orders(id,restaurant_id,order_number) values('forbidden','not-real',1)"
      )
    ).rejects.toThrow();
  });

  it("reconciles duplicate and concurrent submissions without duplicating committed orders", async () => {
    const f = await publishedOutlet();
    const payload = submission();
    const both = await Promise.all([
      submitGuestOrder(f.outlet.publicId, payload),
      submitGuestOrder(f.outlet.publicId, payload),
    ]);
    expect(both[0]!.orderId).toBe(both[1]!.orderId);
    expect([both[0]!.isDuplicate, both[1]!.isDuplicate].sort()).toEqual([false, true]);
    const again = await submitGuestOrder(f.outlet.publicId, payload);
    expect(again.orderId).toBe(both[0]!.orderId);
    expect(again.isDuplicate).toBe(true);
    await expect(
      submitGuestOrder(f.outlet.publicId, {
        ...payload,
        notes: "Different cart",
      })
    ).rejects.toThrow();
    const rows = await admin(async (_, pool) =>
      pool.query("select id from orders where restaurant_id=$1 and client_submission_key=$2", [
        f.outlet.id,
        payload.clientSubmissionKey,
      ])
    );
    expect(rows.rowCount).toBe(1);
  });

  it("rejects a stale guest quote after a published price change without writing an order", async () => {
    const f = await publishedOutlet();
    const original = submission();
    await commandMenu(f.actor, f.outlet.id, f.menuId, {
      key: crypto.randomUUID(),
      expectedRevision: 2,
      action: "save",
      data: {
        document: {
          name: "Updated order test menu",
          currency: f.outlet.currency,
          categories: [
            {
              id: "food",
              name: "Food",
              items: [
                {
                  id: "plate",
                  name: "Paneer Plate",
                  priceMinor: 14500,
                  addOnGroups: [
                    {
                      id: "extras",
                      name: "Extras",
                      min: 0,
                      max: 1,
                      options: [{ id: "bread", name: "Bread", priceMinor: 1500 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    await commandMenu(f.actor, f.outlet.id, f.menuId, {
      key: crypto.randomUUID(),
      expectedRevision: 3,
      action: "publish",
      data: {},
    });
    await expect(submitGuestOrder(f.outlet.publicId, original)).rejects.toMatchObject({
      statusCode: 409,
    });
    const ghost = await admin(async (_, pool) =>
      pool.query<{ count: number }>(
        "select count(*)::int as count from orders where restaurant_id=$1 and client_submission_key=$2",
        [f.outlet.id, original.clientSubmissionKey]
      )
    );
    expect(ghost.rows[0]?.count).toBe(0);
    const accepted = await submitGuestOrder(f.outlet.publicId, {
      ...submission(),
      quotedTotalMinor: 16000,
    });
    expect(accepted.totalMinor).toBe(16000);
  });

  it("enforces pricing, add-ons, staff state/version transitions and separates finance permission", async () => {
    const f = await publishedOutlet();
    await expect(
      submitGuestOrder(f.outlet.publicId, {
        ...submission(),
        quotedTotalMinor: 12500,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      submitGuestOrder(f.outlet.publicId, {
        ...submission(),
        items: [
          {
            dishId: "plate",
            quantity: 1,
            selectedAddOns: [{ groupId: "other", optionId: "bread" }],
          },
        ],
      })
    ).rejects.toThrow();
    const order = await submitGuestOrder(f.outlet.publicId, submission());
    await expect(
      transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
        targetStatus: "accepted",
        paymentStatus: "paid",
        expectedVersion: 1,
      })
    ).rejects.toThrow("Payment updates require");
    const accept = await transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    });
    expect(accept.currentStatus).toBe("accepted");
    await expect(
      transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
        targetStatus: "ready",
        expectedVersion: 2,
      })
    ).rejects.toThrow();
    await expect(
      transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
        targetStatus: "preparing",
        expectedVersion: 1,
      })
    ).rejects.toThrow();
    const prep = await transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
      targetStatus: "preparing",
      expectedVersion: 2,
    });
    expect(prep.currentStatus).toBe("preparing");
    const ready = await transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
      targetStatus: "ready",
      expectedVersion: 3,
    });
    expect(ready.currentStatus).toBe("ready");
    const served = await transitionOutletOrder(f.actor, f.outlet.id, order.orderId, {
      targetStatus: "served",
      expectedVersion: 4,
    });
    expect(served.currentStatus).toBe("served");
  });
});

describe("Service Counter outlet-scoped read models", () => {
  it("separates accurate pulse, active rail, history and canonical events", async () => {
    const f = await publishedOutlet();
    const {
      listServiceRail,
      servicePulse,
      listServiceHistory,
      serviceOrderActivity,
      historyQuerySchema,
    } = await import("../src/modules/orders/workspace");
    const submissionResult = await submitGuestOrder(f.outlet.publicId, submission());
    const active = await listServiceRail(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(active.overflow).toBe(false);
    expect(active.orders.some((item) => item.id === submissionResult.orderId)).toBe(true);
    expect((await servicePulse(f.actor, f.outlet.organizationId, f.outlet.id)).pending).toBe(1);
    const filter = historyQuerySchema.parse({ status: "completed" });
    expect(
      (await listServiceHistory(f.actor, f.outlet.organizationId, f.outlet.id, filter)).total
    ).toBe(0);
    await transitionOutletOrder(
      f.actor,
      f.outlet.id,
      submissionResult.orderId,
      { targetStatus: "accepted", expectedVersion: 1 },
      f.outlet.organizationId
    );
    await transitionOutletOrder(
      f.actor,
      f.outlet.id,
      submissionResult.orderId,
      { targetStatus: "preparing", expectedVersion: 2 },
      f.outlet.organizationId
    );
    await transitionOutletOrder(
      f.actor,
      f.outlet.id,
      submissionResult.orderId,
      { targetStatus: "ready", expectedVersion: 3 },
      f.outlet.organizationId
    );
    await transitionOutletOrder(
      f.actor,
      f.outlet.id,
      submissionResult.orderId,
      { targetStatus: "served", expectedVersion: 4 },
      f.outlet.organizationId
    );
    const pulse = await servicePulse(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(pulse.active).toBe(0);
    expect(pulse.completedToday).toBe(1);
    const history = await listServiceHistory(f.actor, f.outlet.organizationId, f.outlet.id, filter);
    expect(history.total).toBe(1);
    expect(history.orders[0]?.status).toBe("served");
    const activity = await serviceOrderActivity(
      f.actor,
      f.outlet.organizationId,
      f.outlet.id,
      submissionResult.orderId
    );
    expect(activity.events.map((event) => event.toStatus)).toContain("served");
    await expect(
      listServiceRail(f.actor, "not-this-organization", f.outlet.id)
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      serviceOrderActivity(f.actor, f.outlet.organizationId, f.outlet.id, "not-an-order")
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it("identifies kitchen-managed tickets beyond the legacy 100-ticket lookup cap", async () => {
    const f = await publishedOutlet();
    const { listServiceRail, servicePulse } = await import("../src/modules/orders/workspace");
    const stationId = "station-" + crypto.randomUUID();
    await admin(async (_, pool) => {
      await pool.query(
        "insert into kitchen_stations(id,outlet_id,name) values($1,$2,'Bulk kitchen')",
        [stationId, f.outlet.id]
      );
      await pool.query(
        `insert into orders(id,restaurant_id,order_number,status,created_at)
         select 'bulk-' || $1 || '-' || n::text,$1,1000+n,'accepted',
           now() - interval '2 hours' + n * interval '1 second'
         from generate_series(1,105) n`,
        [f.outlet.id]
      );
      await pool.query(
        `insert into order_items(id,order_id,restaurant_id,dish_id,item_name,unit_price_paise,total_paise)
         select 'item-' || id,id,restaurant_id,'plate','Bulk kitchen item',0,0
         from orders where restaurant_id=$1 and id like 'bulk-' || $1 || '-%'`,
        [f.outlet.id]
      );
      await pool.query(
        `insert into kitchen_work(id,outlet_id,order_id,order_item_id,station_id,rule_version)
         select 'work-' || o.id,o.restaurant_id,o.id,i.id,$2,1
         from orders o join order_items i on i.order_id=o.id
         where o.restaurant_id=$1 and o.id like 'bulk-' || $1 || '-%'`,
        [f.outlet.id, stationId]
      );
    });

    const rail = await listServiceRail(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(rail.overflow).toBe(false);
    expect(rail.orders).toHaveLength(105);
    expect(rail.orders.every((order) => order.kitchenManaged)).toBe(true);
    expect(rail.orders.every((order) => order.canAccept)).toBe(true);
    expect((await servicePulse(f.actor, f.outlet.organizationId, f.outlet.id)).preparing).toBe(105);
  });
});
