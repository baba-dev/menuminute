import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import {
  posConfigure,
  posContext,
  posSubmit,
  posAttachOrder,
  posWorkspace,
} from "../src/modules/pos/service";
import { getPool } from "../src/db";
import { transitionOutletOrder, submitGuestOrder, recordOutletOrderPayment } from "../src/modules/orders/service";
import { applyEntitlement } from "../src/modules/billing/operator";

async function ready() {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "POS Fixture",
        currency: f.outlet.currency,
        categories: [
          {
            id: "meals",
            name: "Meals",
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
  const context = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
  expect(context.enabled).toBe(false);
  await posConfigure(f.actor, f.outlet.organizationId, f.outlet.id, {
    expectedRevision: context.revision,
    enabled: true,
    legalName: "POS Fixture Restaurant",
    registeredAddress: "A real seller address used in integration fixtures",
    country: "IN",
    taxRegime: "unconfigured",
    taxRegistration: null,
  });
  return { ...f, menuId };
}
function input(menuId: string, key = crypto.randomUUID()) {
  return {
    key,
    selection: {
      menuId,
      expectedRevision: 2,
      lines: [
        {
          dishId: "plate",
          variantId: null,
          groups: [{ groupId: "extras", optionIds: ["bread"] }],
          quantity: 2,
        },
      ],
    },
    fulfillmentMode: "dine_in" as const,
    tableId: null,
    customerName: "Test Walk-in",
    notes: "",
    expectedSubtotalMinor: "28000",
  };
}
describe("POS A/B/C restricted PostgreSQL end-to-end integration", () => {
  it("keeps POS disabled by default; records canonical order and immutable draft snapshots", async () => {
    const f = await ready();
    const initial = await posWorkspace(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(initial.context.enabled).toBe(true);
    expect(initial.menus.some((m) => m.id === f.menuId)).toBe(true);
    const result = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, input(f.menuId));
    expect(result.subtotalMinor).toBe("28000");
    expect(result.status).toBe("pending");
    expect(result.taxAndFeesCalculated).toBe(false);
    const rows = await admin(async (_db, pool) =>
      pool.query(
        "select s.id,s.tax_state,s.origin,o.status,o.payment_status, count(l.id)::int as lines from pos_sales s join orders o on o.id=s.order_id left join pos_sale_lines l on l.sale_id=s.id where s.id=$1 group by s.id,o.id",
        [result.saleId]
      )
    );
    expect(rows.rows[0]).toMatchObject({
      tax_state: "not_calculated",
      origin: "staff",
      status: "pending",
      payment_status: "unpaid",
      lines: 1,
    });
    await expect(getPool().query("select id from pos_sales limit 1")).rejects.toThrow();
    const accepted = await transitionOutletOrder(f.actor, f.outlet.id, result.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    });
    expect(accepted.currentStatus).toBe("accepted");
    await expect(
      posAttachOrder(f.actor, f.outlet.organizationId, f.outlet.id, {
        key: crypto.randomUUID(),
        orderId: result.orderId,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("deduplicates retries and rejects same key with different contents, stale totals and wrong outlet", async () => {
    const f = await ready();
    const x = input(f.menuId);
    const [a, b] = await Promise.all([
      posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, x),
      posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, x),
    ]);
    expect(a.saleId).toBe(b.saleId);
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
    const replay = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, x);
    expect(replay.duplicate).toBe(true);
    await expect(
      posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, { ...x, notes: "Different" })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, {
        ...input(f.menuId),
        expectedSubtotalMinor: "100",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const unrelated = await fixture();
    await expect(
      posContext(f.actor, unrelated.outlet.organizationId, unrelated.outlet.id)
    ).rejects.toMatchObject({ statusCode: 403 });
    const count = await admin(async (_db, pool) =>
      pool.query("select count(*)::int as n from pos_sales where id=$1", [a.saleId])
    );
    expect(count.rows[0]?.n).toBe(1);
  });
  it("attaches an existing accepted QR order exactly once without creating another kitchen ticket", async () => {
    const f = await ready();
    await admin(async (_db, pool) => applyEntitlement(pool, {
      key: crypto.randomUUID(), organizationId: f.outlet.organizationId, operator: "pos-test",
      reason: "Existing order POS integration", action: "grant", capability: "ordering.new",
      billingCurrency: "USD", startsAt: new Date(Date.now()-60000).toISOString(),
      endsAt: new Date(Date.now()+3600000).toISOString(),
    }));
    const guest = await submitGuestOrder(f.outlet.publicId, {
      clientSubmissionKey: crypto.randomUUID(), quotedTotalMinor: 14000, fulfillmentMode: "dine_in",
      items: [{dishId:"plate",selectedAddOns:[{groupId:"extras",optionId:"bread"}],quantity:1}],
    });
    await transitionOutletOrder(f.actor, f.outlet.id, guest.orderId,
      {targetStatus:"accepted",expectedVersion:1});
    const command = {key:crypto.randomUUID(),orderId:guest.orderId};
    const one = await posAttachOrder(f.actor,f.outlet.organizationId,f.outlet.id,command);
    expect(one.orderId).toBe(guest.orderId);
    expect(one.taxAndFeesCalculated).toBe(false);
    const retry = await posAttachOrder(f.actor,f.outlet.organizationId,f.outlet.id,command);
    expect(retry.saleId).toBe(one.saleId); expect(retry.duplicate).toBe(true);
    const snapshot = await posWorkspace(f.actor,f.outlet.organizationId,f.outlet.id);
    expect(snapshot.attachable.some((o)=>o.orderId===guest.orderId)).toBe(false);
    const events = await admin(async (_db,pool)=>pool.query(
      "select count(*)::int as n from outbox_events where type='order.created' and payload->>'orderId'=$1",[guest.orderId]));
    expect(events.rows[0]?.n).toBe(1);
  });
  it("leaves payment and invoice handling unavailable at the draft POS boundary", async () => {
    const f = await ready();
    const sale = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, input(f.menuId));
    const result = await admin(async (_db, pool) =>
      pool.query(
        "select count(*)::int as n from domain_audit where action='pos.sale.created' and details->>'saleId'=$1",
        [sale.saleId]
      )
    );
    expect(result.rows[0]?.n).toBe(1);
    const entries = await admin(async (_db, pool) =>
      pool.query(
        "select count(*)::int as n from outbox_events where type='order.created' and payload->>'orderId'=$1",
        [sale.orderId]
      )
    );
    expect(entries.rows[0]?.n).toBe(1);
    await transitionOutletOrder(f.actor,f.outlet.id,sale.orderId,{targetStatus:"accepted",expectedVersion:1});
    await transitionOutletOrder(f.actor,f.outlet.id,sale.orderId,{targetStatus:"preparing",expectedVersion:2});
    await transitionOutletOrder(f.actor,f.outlet.id,sale.orderId,{targetStatus:"ready",expectedVersion:3});
    await expect(recordOutletOrderPayment(f.actor,f.outlet.id,sale.orderId,f.outlet.organizationId,
      {expectedVersion:4,paymentStatus:"paid",paymentMethod:"cash"})).rejects.toThrow();
    const payment = await admin(async (_db,pool)=>pool.query("select payment_status from orders where id=$1",[sale.orderId]));
    expect(payment.rows[0]?.payment_status).toBe("unpaid");
  });
});
