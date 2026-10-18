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
  return f;
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
