import { describe, it, expect } from "vitest";
import { fixture, admin } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { submitGuestOrder, transitionOutletOrder } from "../src/modules/orders/service";
import {
  kitchenAdmin,
  kitchenSnapshot,
  kitchenChanges,
  kitchenWorkCommand,
} from "../src/modules/kitchen/service";

async function setup(routed = true) {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Kitchen acceptance fixture",
        currency: f.outlet.currency,
        categories: [
          {
            id: "food",
            name: "Food",
            items: [{ id: "paneer", name: "Paneer Tikka", priceMinor: 12000 }],
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
  for (const capability of ["ordering.new", "kitchen.new"] as const) {
    await admin(async (_, pool) =>
      applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "kitchen-ci",
        reason: "Restricted Kitchen Pro integration fixture",
        action: "grant",
        capability,
        billingCurrency: "USD",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      })
    );
  }
  const a = (await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "station.create",
    data: { name: "Grill" },
  })) as { stationId: string };
  const b = (await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
    action: "station.create",
    data: { name: "Tandoor" },
  })) as { stationId: string };
  if (routed)
    for (const s of [a, b]) {
      await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
        action: "route.assign",
        data: { dishId: "paneer", stationId: s.stationId },
      });
    }
  // A–D has no public activation command. Only the isolated migration-owner fixture can enable work.
  if (routed)
    await admin(async (_, pool) => {
      await pool.query("insert into kitchen_outlet_settings(outlet_id,enabled) values($1,true)", [
        f.outlet.id,
      ]);
    });
  return { ...f, a: a.stationId, b: b.stationId };
}
async function place(f: Awaited<ReturnType<typeof setup>>) {
  return submitGuestOrder(f.outlet.publicId, {
    clientSubmissionKey: crypto.randomUUID(),
    quotedTotalMinor: 12000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: "paneer", quantity: 1, selectedAddOns: [] }],
  });
}
describe("Kitchen Pro restricted PostgreSQL integration", () => {
  it("retains legacy ordering when not enabled and creates no phantom work", async () => {
    const f = await setup(false);
    const o = await place(f);
    await transitionOutletOrder(f.actor, f.outlet.id, o.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    });
    const board = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(board.enabled).toBe(false);
    expect(board.work).toHaveLength(0);
  });
  it("atomically creates two station tickets, version-checks work and blocks merchant bypass", async () => {
    const f = await setup();
    const before = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(before.enabled).toBe(true);
    expect(before.routes).toHaveLength(2);
    const o = await place(f);
    const accepted = await transitionOutletOrder(f.actor, f.outlet.id, o.orderId, {
      targetStatus: "accepted",
      expectedVersion: 1,
    });
    expect(accepted.currentStatus).toBe("accepted");
    const board = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(board.work).toHaveLength(2);
    expect(new Set(board.work.map((w) => w.id)).size).toBe(2);
    expect(new Set(board.work.map((w) => w.stationId))).toEqual(new Set([f.a, f.b]));
    const changes = await kitchenChanges(
      f.actor,
      f.outlet.organizationId,
      f.outlet.id,
      before.cursor
    );
    expect(changes.events.length).toBeGreaterThanOrEqual(2);
    expect(changes.events.every((e, i, a) => i === 0 || e.seq > a[i - 1]!.seq)).toBe(true);
    const first = board.work[0]!;
    await expect(
      kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
        workId: first.id,
        action: "complete",
        expectedVersion: 0,
      })
    ).rejects.toThrow();
    const started = await kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
      workId: first.id,
      action: "start",
      expectedVersion: 0,
    });
    expect(started.status).toBe("preparing");
    await expect(
      kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
        workId: first.id,
        action: "start",
        expectedVersion: 0,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const finished = await kitchenWorkCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
      workId: first.id,
      action: "complete",
      expectedVersion: 1,
    });
    expect(finished.status).toBe("complete");
    const updated = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(updated.work.find((w) => w.id === first.id)?.status).toBe("complete");
    expect(updated.work.find((w) => w.id !== first.id)?.status).toBe("queued");
    await transitionOutletOrder(f.actor, f.outlet.id, o.orderId, {
      targetStatus: "preparing",
      expectedVersion: 2,
    });
    await expect(
      transitionOutletOrder(f.actor, f.outlet.id, o.orderId, {
        targetStatus: "ready",
        expectedVersion: 3,
      })
    ).rejects.toThrow();
    const state = await admin(async (_, pool) =>
      pool.query<{ status: string }>("select status from orders where id=$1", [o.orderId])
    );
    expect(state.rows[0]?.status).toBe("preparing");
  });
  it("rejects cross-outlet scope, invalid cursors and free-form unauthorized station access", async () => {
    const f = await setup();
    const other = await fixture();
    await expect(
      kitchenSnapshot(other.actor, f.outlet.organizationId, f.outlet.id)
    ).rejects.toThrow();
    await expect(kitchenSnapshot(f.actor, "incorrect-org", f.outlet.id)).rejects.toThrow();
    await expect(
      kitchenChanges(f.actor, f.outlet.organizationId, f.outlet.id, 999999999)
    ).rejects.toThrow();
    const forbidden = await admin(async (_, pool) =>
      pool.query("select has_table_privilege('menuminute_app','kitchen_work','INSERT') as allowed")
    );
    expect(forbidden.rows[0]?.allowed).toBe(false);
  });
  it("limits kitchen staff to assigned stations and revokes access immediately", async () => {
    const f = await setup();
    const userId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    await admin(async (_, pool) => {
      await pool.query("insert into users(id,name,email,email_verified) values($1,'Kitchen staff',$2,true)", [
        userId, `kitchen-staff-${userId}@test.invalid`,
      ]);
      await pool.query("insert into organization_members(id,organization_id,user_id,role,is_active) values($1,$2,$3,'member',true)", [
        memberId, f.outlet.organizationId, userId,
      ]);
      await pool.query("insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,ARRAY['kitchen']::text[])", [
        f.outlet.organizationId, memberId, f.outlet.id,
      ]);
    });
    const staff = { userId };
    await expect(kitchenSnapshot(staff, f.outlet.organizationId, f.outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    const ownerView = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(ownerView.members.some((m) => m.id === memberId)).toBe(true);
    await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "member.assign", data: { memberId, stationId: f.a },
    });
    const assigned = await kitchenSnapshot(staff, f.outlet.organizationId, f.outlet.id);
    expect(assigned.stations.map((station) => station.id)).toEqual([f.a]);
    const o = await place(f);
    await transitionOutletOrder(f.actor, f.outlet.id, o.orderId, {
      targetStatus: "accepted", expectedVersion: 1,
    });
    const scoped = await kitchenSnapshot(staff, f.outlet.organizationId, f.outlet.id);
    expect(scoped.work).toHaveLength(1);
    expect(scoped.work[0]?.stationId).toBe(f.a);
    const full = await kitchenSnapshot(f.actor, f.outlet.organizationId, f.outlet.id);
    const tandoor = full.work.find((w) => w.stationId === f.b)!;
    await expect(kitchenWorkCommand(staff, f.outlet.organizationId, f.outlet.id, {
      workId: tandoor.id, action: "start", expectedVersion: 0,
    })).rejects.toMatchObject({ statusCode: 403 });
    await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "member.remove", data: { memberId, stationId: f.a },
    });
    await expect(kitchenSnapshot(staff, f.outlet.organizationId, f.outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
