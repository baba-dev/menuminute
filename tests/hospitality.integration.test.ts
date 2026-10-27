import { describe, it, expect } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import {
  callGuestService,
  guestServiceState,
  staffServiceRequests,
  staffServiceRequestAction,
  kitchenAvailableDishes,
  kitchenSetAvailability,
} from "../src/modules/hospitality/service";
import { getOutletFloorMatrix } from "../src/modules/hospitality/floor-matrix";

async function seeded() {
  const f = await fixture();
  const tableId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const trackingToken = crypto.randomUUID();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into restaurant_tables(id,restaurant_id,table_number,is_active) values($1,$2,'77',true)",
      [tableId, f.outlet.id]
    );
    await pool.query(
      `insert into orders(id,restaurant_id,table_id,tracking_token,order_number,
   status,fulfillment_mode,payment_status,currency,total_minor)
   values($1,$2,$3,$4,77,'served','dine_in','unpaid','INR',21000)`,
      [orderId, f.outlet.id, tableId, trackingToken]
    );
  });
  return { ...f, tableId, orderId, trackingToken };
}
describe("Hospitality DB invariants (restricted application role)", () => {
  it("serializes concurrent guest bells, requires acknowledgements and maintains tenant scope", async () => {
    const f = await seeded();
    const input = {
      token: f.outlet.publicId,
      trackingToken: f.trackingToken,
      signal: "call_server" as const,
    };
    const [a, b] = await Promise.all([
      callGuestService(f.orderId, input),
      callGuestService(f.orderId, input),
    ]);
    expect(a.requestId).toBe(b.requestId);
    expect([a.debounced, b.debounced].filter(Boolean)).toHaveLength(1);
    const list = await staffServiceRequests(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(list.find((x) => x.id === a.requestId)).toMatchObject({
      status: "requested",
      tableNumber: "77",
    });
    await expect(
      staffServiceRequestAction(f.actor, f.outlet.organizationId, f.outlet.id, {
        requestId: a.requestId,
        action: "resolve",
      })
    ).rejects.toThrow();
    await staffServiceRequestAction(f.actor, f.outlet.organizationId, f.outlet.id, {
      requestId: a.requestId,
      action: "acknowledge",
    });
    expect((await guestServiceState(f.orderId, input.token, input.trackingToken))[0]?.status).toBe(
      "acknowledged"
    );
    await staffServiceRequestAction(f.actor, f.outlet.organizationId, f.outlet.id, {
      requestId: a.requestId,
      action: "resolve",
    });
    expect(
      await staffServiceRequests(f.actor, f.outlet.organizationId, f.outlet.id)
    ).not.toContainEqual(expect.objectContaining({ id: a.requestId }));
    const stranger = await fixture();
    await expect(
      staffServiceRequests(stranger.actor, stranger.outlet.organizationId, f.outlet.id)
    ).rejects.toThrow();
    await expect(
      callGuestService(f.orderId, { ...input, trackingToken: crypto.randomUUID() })
    ).rejects.toThrow();
  });
  it("does not hide unpaid served tickets on old tables", async () => {
    const f = await seeded();
    await admin(async (_db, pool) =>
      pool.query("update orders set created_at=now()-interval '3 days' where id=$1", [f.orderId])
    );
    const matrix = await getOutletFloorMatrix(f.actor, f.outlet.organizationId, f.outlet.id);
    const table = matrix.find((t) => t.id === f.tableId);
    expect(table).toMatchObject({ unpaidOrders: 1, dueMinor: "21000", activeOrders: 0 });
  });
  it("validates exact published dish and maintains a scoped override", async () => {
    const f = await fixture();
    const menuId = crypto.randomUUID();
    await commandMenu(f.actor, f.outlet.id, menuId, {
      action: "create",
      expectedRevision: 0,
      key: crypto.randomUUID(),
      data: {
        document: {
          name: "Hospitality",
          currency: "INR",
          categories: [
            {
              id: "food",
              name: "Food",
              items: [
                { id: "dish-a", name: "Same Name", priceMinor: 18000 },
                { id: "dish-b", name: "Same Name", priceMinor: 19000 },
              ],
            },
          ],
        },
      },
    });
    await commandMenu(f.actor, f.outlet.id, menuId, {
      action: "publish",
      expectedRevision: 1,
      key: crypto.randomUUID(),
      data: {},
    });
    const before = await kitchenAvailableDishes(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(before.filter((x) => x.menuId === menuId)).toHaveLength(2);
    await expect(
      kitchenSetAvailability(f.actor, f.outlet.organizationId, f.outlet.id, {
        menuId,
        dishId: "not-in-published-release",
        soldOut: true,
      })
    ).rejects.toThrow();
    await kitchenSetAvailability(f.actor, f.outlet.organizationId, f.outlet.id, {
      menuId,
      dishId: "dish-a",
      soldOut: true,
    });
    const after = await kitchenAvailableDishes(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(after.find((x) => x.menuId === menuId && x.id === "dish-a")?.soldOut).toBe(true);
    expect(after.find((x) => x.menuId === menuId && x.id === "dish-b")?.soldOut).toBe(false);
  });
});
