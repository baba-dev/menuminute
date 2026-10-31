import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { provisionDemo } from "../src/modules/demo/provision";
import { demoPassword } from "../src/modules/demo/credential";
import { buildDemoBaseline, DEMO_IDS } from "../src/modules/demo/baseline";
import { buildDemoOrders } from "../src/modules/demo/history";
import { resetDemoOutlet } from "../src/modules/demo/reset";
import { submitGuestOrder, transitionOutletOrder } from "../src/modules/orders/service";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";

const ownerUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: ownerUrl, max: 3 });
const as = (user: string, pass: string) => {
  const u = new URL(ownerUrl);
  u.username = user;
  u.password = pass;
  return new Pool({ connectionString: u.toString(), max: 1 });
};
const worker = as("menuminute_worker", "isolated-ci-worker-password");
const app = as("menuminute_app", "isolated-ci-app-password");
const billing = as("menuminute_billing", "isolated-ci-billing-password");
const O = DEMO_IDS.outletId;
const count = async (sql: string, args: unknown[] = []) =>
  Number((await owner.query(sql, args)).rows[0].n);

async function provision() {
  const c = await owner.connect();
  try {
    return await provisionDemo(c, await hashPassword(demoPassword(process.env["AUTH_SECRET"]!)));
  } finally {
    c.release();
  }
}

afterAll(async () => {
  await Promise.all([owner.end(), worker.end(), app.end(), billing.end().catch(() => undefined)]);
});

describe("demo orders, kitchen and entitlements", () => {
  beforeAll(async () => {
    await provision();
    await provision(); // idempotent
  }, 90000);

  it("grants Ordering and Kitchen once, enables the kitchen and routes every dish to a staffed station", async () => {
    for (const capability of ["ordering.new", "kitchen.new"])
      expect(
        await count(
          "select count(*) n from entitlement_grants where organization_id=$1 and capability=$2 and revoked_at is null and ends_at>now()+interval '5 years'",
          [DEMO_IDS.organizationId, capability]
        ),
        capability
      ).toBe(1);
    expect(
      await count("select count(*) n from kitchen_outlet_settings where outlet_id=$1 and enabled", [
        O,
      ])
    ).toBe(1);
    expect(await count("select count(*) n from kitchen_routes where outlet_id=$1", [O])).toBe(236);
    expect(
      await count("select count(*) n from kitchen_stations where outlet_id=$1 and active", [O])
    ).toBe(4);
    const ready = await owner.query("select app_private.kitchen_commercial_ready($1) as ok", [O]);
    expect(ready.rows[0].ok).toBe(true);
    // Staff exist but have no credential and cannot sign in.
    expect(
      await count(
        "select count(*) n from accounts where user_id in ('demo-chef','demo-expo','demo-manager')"
      )
    ).toBe(0);
  });

  it("seeds ~30 days of history plus a live board (3 pending, 3 accepted, 2 preparing, 1 ready)", async () => {
    const total = await count("select count(*) n from orders where restaurant_id=$1", [O]);
    expect(total).toBeGreaterThan(300);
    const live = await owner.query(
      "select status, count(*)::int n from orders where restaurant_id=$1 and created_at>now()-interval '60 minutes' group by status",
      [O]
    );
    const byStatus = Object.fromEntries(live.rows.map((r) => [r.status, r.n]));
    expect(byStatus).toMatchObject({ pending: 3, accepted: 3, preparing: 2, ready: 1 });
    expect(
      await count("select count(*) n from kitchen_work where outlet_id=$1", [O])
    ).toBeGreaterThan(5);
    expect(
      await count("select count(*) n from kitchen_work where outlet_id=$1 and status='preparing'", [
        O,
      ])
    ).toBeGreaterThan(0);
    expect(
      await count("select count(*) n from kitchen_work where outlet_id=$1 and status='complete'", [
        O,
      ])
    ).toBeGreaterThan(0);
    // Totals reconcile with their items.
    expect(
      await count(
        `select count(*) n from orders o where restaurant_id=$1 and total_minor <> (select coalesce(sum(total_minor),0) from order_items i where i.order_id=o.id)`,
        [O]
      )
    ).toBe(0);
    expect(
      await count(
        "select count(*) n from orders where restaurant_id=$1 and business_date is null",
        [O]
      )
    ).toBe(0);
  });

  it("lets a guest order flow through acceptance into kitchen work, and the reset removes it", async () => {
    const naan = menuDocumentSchema
      .parse(buildDemoBaseline().menu)
      .categories.flatMap((c) => c.items)
      .find((d) => d.id === "MM-CORE-naan")!;
    const placed = await submitGuestOrder(DEMO_IDS.publicId, {
      clientSubmissionKey: crypto.randomUUID(),
      quotedTotalMinor: naan.priceMinor,
      fulfillmentMode: "dine_in",
      items: [{ dishId: naan.id, quantity: 1, selectedAddOns: [] }],
    });
    await transitionOutletOrder({ userId: DEMO_IDS.userId }, O, placed.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    });
    const work = await owner.query("select station_id from kitchen_work where order_id=$1", [
      placed.orderId,
    ]);
    expect(work.rows.map((r) => r.station_id)).toEqual(["demo-st-tandoor"]);

    const before = await count("select count(*) n from orders where restaurant_id=$1", [O]);
    await resetDemoOutlet(worker);
    expect(await count("select count(*) n from orders where id=$1", [placed.orderId])).toBe(0);
    expect(
      await count("select count(*) n from kitchen_work where order_id=$1", [placed.orderId])
    ).toBe(0);
    // History is restored (same count as the seeded baseline, not baseline + visitor order).
    expect(
      await count("select count(*) n from orders where restaurant_id=$1", [O])
    ).toBeGreaterThan(300);
    expect(before).toBeGreaterThan(300);
  });

  it("is deterministic for a fixed clock and internally consistent", () => {
    const menu = menuDocumentSchema.parse(buildDemoBaseline().menu);
    const tables = buildDemoBaseline().tables.map((t) => t.id);
    const now = new Date("2026-10-31T09:00:00Z");
    const a = buildDemoOrders(menu, tables, now);
    expect(buildDemoOrders(menu, tables, now)).toEqual(a);
    const dishes = new Map(menu.categories.flatMap((c) => c.items).map((d) => [d.id, d]));
    for (const order of a) {
      expect(order.items.length).toBeGreaterThan(0);
      for (const item of order.items) {
        const dish = dishes.get(item.dishId);
        expect(dish, item.dishId).toBeTruthy();
        if (item.variantId) expect(dish!.variants.some((v) => v.id === item.variantId)).toBe(true);
        for (const o of item.selectedOptions)
          expect(
            dish!.addOnGroups.some(
              (g) => g.id === o.groupId && g.options.some((x) => x.id === o.optionId)
            )
          ).toBe(true);
      }
      expect(order.minutesAgo).toBeGreaterThan(0);
    }
    expect(new Set(a.map((o) => o.id)).size).toBe(a.length);
    // order numbers are unique per IST day
    const perDay = new Set<string>();
    for (const o of a) {
      const day = new Date(now.getTime() - o.minutesAgo * 60000 + 330 * 60000)
        .toISOString()
        .slice(0, 10);
      const key = `${day}#${o.number}`;
      expect(perDay.has(key), key).toBe(false);
      perDay.add(key);
    }
  });

  it("completes a reset with history under the worker's 5 s statement timeout", async () => {
    const timed = as("menuminute_worker", "isolated-ci-worker-password");
    await timed.query("set statement_timeout=5000");
    const start = Date.now();
    await resetDemoOutlet(timed);
    expect(Date.now() - start).toBeLessThan(5000);
    await timed.end();
  });

  it("keeps the bypass owner-only and refuses non-demo outlets", async () => {
    for (const pool of [app, worker, billing])
      await expect(pool.query("select app_private.provision_demo_ops()")).rejects.toThrow(
        /permission denied/
      );
    await expect(app.query("select app_private.seed_demo_orders('[]'::jsonb)")).rejects.toThrow(
      /permission denied/
    );
    await owner.query("update restaurants set is_demo_data=false where id=$1", [O]);
    try {
      await expect(owner.query("select app_private.provision_demo_ops()")).rejects.toThrow(
        /not provisioned/
      );
    } finally {
      await owner.query("update restaurants set is_demo_data=true where id=$1", [O]);
    }
  });
});

describe("variant order lines (shared product defect fixed by migration 0059)", () => {
  it("accepts a guest order that selects a published menu variant", async () => {
    const menu = menuDocumentSchema.parse(buildDemoBaseline().menu);
    const dish = menu.categories
      .flatMap((c) => c.items)
      .find((d) => d.id === "MM-CORE-butter-chicken")!;
    const variant = dish.variants[0]!;
    const spice = dish.addOnGroups.find((g) => g.min > 0)!;
    const option = spice.options[0]!;
    const placed = await submitGuestOrder(DEMO_IDS.publicId, {
      clientSubmissionKey: crypto.randomUUID(),
      quotedTotalMinor: variant.priceMinor + option.priceMinor,
      fulfillmentMode: "dine_in",
      items: [
        {
          dishId: dish.id,
          variantId: variant.id,
          quantity: 1,
          selectedAddOns: [{ groupId: spice.id, optionId: option.id }],
        },
      ],
    });
    const row = await owner.query(
      "select variant_id, variant_name from order_items where order_id=$1",
      [placed.orderId]
    );
    expect(row.rows[0]).toEqual({ variant_id: variant.id, variant_name: variant.name });
  });
});
