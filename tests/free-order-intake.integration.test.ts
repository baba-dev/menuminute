import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu, publicProduct } from "../src/modules/menu-product/service";
import { dashboardNavigation } from "../src/modules/menu-product/dashboard-data";
import { submitGuestOrder, transitionOutletOrder } from "../src/modules/orders/service";
import { PLAN_LIMITS } from "../src/modules/plans/catalog";
import { getPool } from "../src/db";

async function setIntake(enabled: boolean, cap?: number) {
  await admin(async (_db, pool) => {
    await pool.query(
      "update app_private.plan_settings set free_intake_enabled=$1, free_intake_monthly_cap=coalesce($2,free_intake_monthly_cap)",
      [enabled, cap ?? null]
    );
  });
}

async function publishedFreeOutlet() {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  const doc = {
    name: "Intake menu",
    currency: f.outlet.currency,
    categories: [
      { id: "food", name: "Food", items: [{ id: "plate", name: "Plate", priceMinor: 10000 }] },
    ],
  };
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document: doc },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  return f;
}

const order = (key = crypto.randomUUID()) => ({
  clientSubmissionKey: key,
  quotedTotalMinor: 10000,
  fulfillmentMode: "dine_in",
  items: [{ dishId: "plate", quantity: 1 }],
});

let defaultCap = 0;
beforeAll(async () => {
  defaultCap = await admin(async (_db, pool) =>
    Number(
      (
        await pool.query<{ c: number }>(
          "select free_intake_monthly_cap as c from app_private.plan_settings"
        )
      ).rows[0]!.c
    )
  );
});
afterAll(async () => {
  // The switch is global database state: always restore the shipped default (OFF, cap 100).
  await setIntake(false, 100);
});

describe("Free order intake (migration 0077)", () => {
  it("ships OFF with the approved cap and is invisible to application roles", async () => {
    expect(defaultCap).toBe(PLAN_LIMITS.free.ordersPerMonth);
    await expect(getPool().query("select * from app_private.plan_settings")).rejects.toThrow();
    const f = await publishedFreeOutlet();
    expect((await publicProduct(f.outlet.publicId))?.outlet.orderingEnabled).toBe(false);
    await expect(submitGuestOrder(f.outlet.publicId, order())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(
      (await dashboardNavigation(f.actor, f.outlet.organizationId, f.outlet.id)).ordering
    ).toBe(false);
  });

  it("accepts guest orders on a Free outlet up to the monthly cap, then stops", async () => {
    await setIntake(true, 3);
    const f = await publishedFreeOutlet();
    expect((await publicProduct(f.outlet.publicId))?.outlet.orderingEnabled).toBe(true);
    expect(
      (await dashboardNavigation(f.actor, f.outlet.organizationId, f.outlet.id)).ordering
    ).toBe(true);
    const replayKey = crypto.randomUUID();
    const first = await submitGuestOrder(f.outlet.publicId, order(replayKey));
    await submitGuestOrder(f.outlet.publicId, order());
    await submitGuestOrder(f.outlet.publicId, order());
    await expect(submitGuestOrder(f.outlet.publicId, order())).rejects.toMatchObject({
      statusCode: 403,
      message: "This restaurant is not taking new online orders right now.",
    });
    // The owner's workspace stays available at the cap so existing orders can be managed.
    expect(
      (await dashboardNavigation(f.actor, f.outlet.organizationId, f.outlet.id)).ordering
    ).toBe(true);
    // A retried submission of an already-accepted order stays idempotent at the cap.
    const again = await submitGuestOrder(f.outlet.publicId, order(replayKey));
    expect(again).toMatchObject({ orderId: first.orderId, isDuplicate: true });
  });

  it("hides checkout on a fresh public read once the cap is reached", async () => {
    // orderingEnabled is part of the 180s public-menu cache (same lag as a revoked paid grant),
    // so read it only after the cap is hit. The server rejection above is the authority.
    await setIntake(true, 1);
    const f = await publishedFreeOutlet();
    await submitGuestOrder(f.outlet.publicId, order());
    expect((await publicProduct(f.outlet.publicId))?.outlet.orderingEnabled).toBe(false);
  });

  it("frees capacity when an order is rejected", async () => {
    await setIntake(true, 1);
    const f = await publishedFreeOutlet();
    const first = await submitGuestOrder(f.outlet.publicId, order());
    await expect(submitGuestOrder(f.outlet.publicId, order())).rejects.toMatchObject({
      statusCode: 403,
    });
    await transitionOutletOrder(f.actor, f.outlet.id, first.orderId, {
      targetStatus: "rejected",
      expectedVersion: 1,
      reason: "test",
    });
    await expect(submitGuestOrder(f.outlet.publicId, order())).resolves.toMatchObject({
      status: "pending",
    });
  });

  it("never overshoots the cap under concurrent submissions", async () => {
    await setIntake(true, 2);
    const f = await publishedFreeOutlet();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => submitGuestOrder(f.outlet.publicId, order()))
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(4);
  });

  it("does not limit outlets with a paid ordering grant", async () => {
    await setIntake(true, 1);
    const f = await publishedFreeOutlet();
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "intake-test",
        reason: "Paid outlet is not subject to the free cap",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    for (let i = 0; i < 3; i++)
      await expect(submitGuestOrder(f.outlet.publicId, order())).resolves.toBeTruthy();
  });

  it("returns to paid-only behaviour when the switch is turned off again", async () => {
    await setIntake(false);
    const f = await publishedFreeOutlet();
    expect((await publicProduct(f.outlet.publicId))?.outlet.orderingEnabled).toBe(false);
    await expect(submitGuestOrder(f.outlet.publicId, order())).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
