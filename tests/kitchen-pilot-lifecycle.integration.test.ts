import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { applyEntitlement } from "../src/modules/billing/operator";
import {
  kitchenAdmin,
  kitchenSnapshot,
  kitchenWorkCommand,
  kitchenExpoRelease,
} from "../src/modules/kitchen/service";
import { submitGuestOrder, transitionOutletOrder } from "../src/modules/orders/service";
import { withActor } from "../src/modules/tenancy/service";

it("activates only after reviewed route/staff readiness, drains new intake and completes accepted kitchen work", async () => {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Piloted menu",
        currency: f.outlet.currency,
        categories: [
          {
            id: "mains",
            name: "Mains",
            items: [{ id: "piloted-dish", name: "Piloted dish", priceMinor: 15000 }],
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
  await admin(async (_, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "isolated-operator",
      reason: "E2E pilot approval test",
      action: "grant",
      capability: "ordering.new",
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });
  const station = (await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "station.create",
    data: { name: "Pilot station" },
  })) as { stationId: string };
  await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "route.assign",
    data: { stationId: station.stationId, dishId: "piloted-dish" },
  });
  const memberId = crypto.randomUUID(),
    memberUser = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Pilot cook',$2,true)",
      [memberUser, memberUser + "@pilot.invalid"]
    );
    await pool.query(
      "insert into organization_members(id,organization_id,user_id,role,is_active) values($1,$2,$3,'member',true)",
      [memberId, f.outlet.organizationId, memberUser]
    );
    await pool.query(
      "insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,array['kitchen']::text[])",
      [f.outlet.organizationId, memberId, f.outlet.id]
    );
  });
  await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "member.assign",
    data: { stationId: station.stationId, memberId },
  });
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const sessions = [crypto.randomUUID(), crypto.randomUUID()];
  await admin(async (_, pool) => {
    for (let i = 0; i < 2; i++) {
      await pool.query(
        "insert into users(id,name,email,email_verified,two_factor_enabled,is_super_admin) values($1,$2,$3,true,true,true)",
        [ids[i], "Pilot reviewer " + i, ids[i] + "@pilot.invalid"]
      );
      await pool.query(
        "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '2 hours')",
        [sessions[i], crypto.randomUUID(), ids[i]]
      );
    }
  });
  const proof = async (index: number) =>
    admin(async (_, pool) => {
      await pool.query(
        "insert into auth_step_up(session_id,user_id,expires_at) values($1,$2,now()+interval '5 minutes') on conflict(session_id) do update set expires_at=excluded.expires_at",
        [sessions[index], ids[index]]
      );
    });
  const payload = {
    releaseSha: "b".repeat(40),
    evidenceUrl: "https://github.com/baba-dev/menuminute/issues/76",
    reason: "Isolated Kitchen pilot operational acceptance test",
  };
  const command = async (index: number, action: string) =>
    withActor({ userId: ids[index]!, sessionId: sessions[index]! }, (tx) =>
      tx.execute<{
        state: {
          state: string;
          enabled: boolean;
          openKitchenOrders: number;
          configurationReady: boolean;
        };
      }>(
        sql`select app_private.kitchen_pilot_command(
        ${f.outlet.id},${action},${JSON.stringify(payload)}::jsonb,${crypto.randomUUID()}
      ) as state`
      )
    );
  await proof(0);
  const requested = await command(0, "request");
  expect(requested.rows[0]!.state.configurationReady).toBe(true);
  await proof(1);
  expect((await command(1, "approve")).rows[0]!.state.state).toBe("approved");
  await proof(0);
  const activated = await command(0, "activate");
  expect(activated.rows[0]!.state).toMatchObject({ state: "active", enabled: true });
  // The preexisting manager command must not silently bypass the operator pilot.
  await expect(
    kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "settings.disable",
      data: {},
    })
  ).rejects.toThrow();
  const acceptedOrder = await submitGuestOrder(f.outlet.publicId, {
    clientSubmissionKey: crypto.randomUUID(),
    quotedTotalMinor: 15000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: "piloted-dish", quantity: 1, selectedAddOns: [] }],
  });
  await transitionOutletOrder(f.actor, f.outlet.id, acceptedOrder.orderId, {
    targetStatus: "accepted",
    expectedVersion: 1,
  });
  await proof(0);
  const draining = await command(0, "drain");
  expect(draining.rows[0]!.state).toMatchObject({
    state: "draining",
    enabled: true,
    openKitchenOrders: 1,
  });
  const pendingOrder = await submitGuestOrder(f.outlet.publicId, {
    clientSubmissionKey: crypto.randomUUID(),
    quotedTotalMinor: 15000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: "piloted-dish", quantity: 1, selectedAddOns: [] }],
  });
  await expect(
    transitionOutletOrder(f.actor, f.outlet.id, pendingOrder.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    })
  ).rejects.toThrow();
  await proof(0);
  await expect(command(0, "finalize")).rejects.toThrow();
  const snapshot = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
  const work = snapshot.work.find((w) => w.orderId === acceptedOrder.orderId);
  expect(work).toBeDefined();
  await transitionOutletOrder(f.actor, f.outlet.id, acceptedOrder.orderId, {
    targetStatus: "preparing",
    expectedVersion: 2,
  });
  await kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "start",
    workId: work!.id,
    expectedVersion: 0,
  });
  await kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "complete",
    workId: work!.id,
    expectedVersion: 1,
  });
  await kitchenExpoRelease(f.actor, f.outlet.organizationId, f.outlet.id, {
    orderId: acceptedOrder.orderId,
    expectedVersion: 3,
    key: crypto.randomUUID(),
  });
  await proof(0);
  const disabled = await command(0, "finalize");
  expect(disabled.rows[0]!.state).toMatchObject({
    state: "disabled",
    enabled: false,
    openKitchenOrders: 0,
  });
  const preserved = await admin(async (_, pool) =>
    pool.query<{ count: string }>(
      "select count(*)::text as count from kitchen_work where order_id=$1",
      [acceptedOrder.orderId]
    )
  );
  expect(Number(preserved.rows[0]!.count)).toBe(1);
});
