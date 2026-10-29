import { expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { kitchenAdmin, kitchenSnapshot } from "../src/modules/kitchen/service";

// Owner-only transaction; rolls back the global launch flag and all provider
// fixtures so parallel tests never see a commercially enabled test environment.
it("verified Kitchen charge grants bundled ordering and automatically activates only a ready outlet", async () => {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Paid Kitchen Menu",
        currency: f.outlet.currency,
        categories: [
          {
            id: "mains",
            name: "Mains",
            items: [{ id: "paid-dish", name: "Paid dish", priceMinor: 12000 }],
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
  const station = (await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "station.create",
    data: { name: "Paid prep" },
  })) as { stationId: string };
  const snap = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
  const owner = snap.members.find((m) => m.role === "owner");
  expect(owner).toBeDefined();
  await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "member.assign",
    data: { stationId: station.stationId, memberId: owner!.id },
  });
  await admin(async (_, pool) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE app_private.kitchen_commercial_release SET enabled=true WHERE singleton"
      );
      const sub = "sub_" + crypto.randomUUID().replace(/-/g, "");
      const plan = "plan_paid_kitchen_test";
      await client.query(
        "INSERT INTO app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by) VALUES($1,$2,'kitchen_pro',$3,$4)",
        [sub, f.outlet.organizationId, plan, f.actor.userId]
      );
      const now = Date.now(),
        start = new Date(now - 30000),
        end = new Date(now + 28 * 86400000);
      const created = new Date(now - 1000);
      const charge = async () =>
        client.query<{ grant: string }>(
          "SELECT app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7) AS grant",
          [
            "evt_" + crypto.randomUUID(),
            sub,
            plan,
            "pay_" + crypto.randomUUID(),
            start,
            end,
            created,
          ]
        );
      // Incomplete outlet: provider grant is issued, but no Kitchen live flag.
      const first = await charge();
      expect(first.rows[0]?.grant).toBeTruthy();
      const flags = await client.query<{ enabled: boolean }>(
        "SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=$1",
        [f.outlet.id]
      );
      expect(flags.rows[0]?.enabled ?? false).toBe(false);
      const bundled = await client.query<{ capability: string }>(
        "SELECT capability FROM entitlement_grants WHERE organization_id=$1 AND revoked_at IS NULL",
        [f.outlet.organizationId]
      );
      expect(bundled.rows.map((x) => x.capability).sort()).toEqual(["kitchen.new", "ordering.new"]);
      const status = await client.query<{ ready: boolean }>(
        "SELECT app_private.kitchen_commercial_ready($1) AS ready",
        [f.outlet.id]
      );
      expect(status.rows[0]?.ready).toBe(false);
      // New route makes the configuration ready, activating Kitchen automatically.
      await client.query(
        "INSERT INTO kitchen_routes(outlet_id,dish_id,station_id) VALUES($1,$2,$3)",
        [f.outlet.id, "paid-dish", station.stationId]
      );
      const activated = await client.query<{ enabled: boolean }>(
        "SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=$1",
        [f.outlet.id]
      );
      expect(activated.rows[0]?.enabled).toBe(true);
      // Configuration can become invalid after activation. Effective paid
      // readiness must fail closed until the route is restored.
      await client.query("DELETE FROM kitchen_routes WHERE outlet_id=$1 AND dish_id=$2", [
        f.outlet.id,
        "paid-dish",
      ]);
      const deconfigured = await client.query<{ ready: boolean }>(
        "SELECT app_private.kitchen_commercial_ready($1) AS ready",
        [f.outlet.id]
      );
      expect(deconfigured.rows[0]?.ready).toBe(false);
      await client.query(
        "INSERT INTO kitchen_routes(outlet_id,dish_id,station_id) VALUES($1,$2,$3)",
        [f.outlet.id, "paid-dish", station.stationId]
      );
      // Paused billing revokes Kitchen and its provider-bundled ordering grant.
      await client.query("SELECT app_private.record_razorpay_status($1,$2,'paused',$3)", [
        "evt_" + crypto.randomUUID(),
        sub,
        new Date(now + 1000),
      ]);
      const revoked = await client.query<{ capability: string }>(
        "SELECT capability FROM entitlement_grants WHERE organization_id=$1 AND revoked_at IS NULL",
        [f.outlet.organizationId]
      );
      expect(revoked.rows).toHaveLength(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

it("blocks unapproved paid Kitchen charge before it creates any entitlement", async () => {
  const f = await fixture();
  await admin(async (_, pool) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sub = "sub_" + crypto.randomUUID().replace(/-/g, "");
      const plan = "plan_paid_kitchen_test";
      await client.query(
        "INSERT INTO app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by) VALUES($1,$2,'kitchen_pro',$3,$4)",
        [sub, f.outlet.organizationId, plan, f.actor.userId]
      );
      const now = Date.now();
      await expect(
        client.query("SELECT app_private.record_razorpay_charge($1,$2,$3,$4,$5,$6,$7)", [
          "evt_" + crypto.randomUUID(),
          sub,
          plan,
          "pay_" + crypto.randomUUID(),
          new Date(now - 30000),
          new Date(now + 28 * 86400000),
          new Date(now - 1000),
        ])
      ).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
