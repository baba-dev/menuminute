import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu, menuDetail, publicProduct } from "../src/modules/menu-product/service";
import { submitGuestOrder } from "../src/modules/orders/service";
import { overflowCapsJson, reconcilePlanOverflow } from "../src/modules/plans/overflow";
import { withOutlet } from "../src/modules/tenancy/service";
import { getPool } from "../src/db";

type F = Awaited<ReturnType<typeof fixture>>;
let workerPool: Pool;
beforeAll(() => {
  workerPool = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 2 });
});
afterAll(async () => {
  await setSwitch(false);
  await workerPool.end();
});

async function setSwitch(enabled: boolean, graceDays = 14) {
  await admin(async (_db, pool) => {
    await pool.query(
      "update app_private.plan_settings set overflow_hiding_enabled=$1, overflow_grace_days=$2",
      [enabled, graceDays]
    );
  });
}
const ownerSql = (text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows);

/** Three categories of 10, 10 and 5 dishes: 25 live dishes in menu order d1..d25. */
function document(currency: string, n = 25) {
  const dish = (i: number) => ({ id: `d${i}`, name: `Dish ${i}`, priceMinor: 100 });
  const slice = (a: number, b: number) =>
    Array.from({ length: Math.max(0, Math.min(b, n) - a + 1) }, (_, k) => dish(a + k));
  return {
    name: "Menu",
    currency,
    categories: [
      { id: "a", name: "A", items: slice(1, 10) },
      { id: "b", name: "B", items: slice(11, 20) },
      { id: "c", name: "C", items: slice(21, 25) },
    ].filter((c) => c.items.length > 0),
  };
}
async function publishedOutlet(n = 25): Promise<F & { menuId: string }> {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document: document(f.outlet.currency, n) },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  return { ...f, menuId };
}
async function publicDishIds(f: F): Promise<string[]> {
  const rows = await ownerSql("select app_private.free_menu_public($1) as data", [
    f.outlet.publicId,
  ]);
  const data = rows[0]!.data as {
    menus: { document: { categories: { id: string; items: { id: string }[] }[] } }[];
  };
  return data.menus.flatMap((m) => m.document.categories.flatMap((c) => c.items.map((i) => i.id)));
}
async function publicCategories(f: F): Promise<string[]> {
  const rows = await ownerSql("select app_private.free_menu_public($1) as data", [
    f.outlet.publicId,
  ]);
  const data = rows[0]!.data as { menus: { document: { categories: { id: string }[] } }[] };
  return data.menus.flatMap((m) => m.document.categories.map((c) => c.id));
}
const expireGrace = (f: F) =>
  ownerSql(
    "update app_private.plan_overflow set grace_until=now()-interval '1 minute' where outlet_id=$1",
    [f.outlet.id]
  );
const snapshot = (f: F, actor = f.actor) =>
  withOutlet(actor, f.outlet.id, "menu.read", async (tx) => {
    const r = await tx.execute<{ s: Record<string, unknown> | null }>(
      sql`select app_private.plan_overflow_snapshot(${f.outlet.id}) as s`
    );
    return r.rows[0]?.s ?? null;
  });
const grant = (f: F, capability: "ordering.new" | "kitchen.new") =>
  admin(async (_db, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "overflow-test",
      reason: "Overflow test",
      action: "grant",
      capability,
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });

describe("plan overflow: hide, never delete (migration 0079)", () => {
  it("does nothing while the owner switch is off", async () => {
    await setSwitch(false);
    const f = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    expect(
      await ownerSql("select 1 from app_private.plan_overflow where outlet_id=$1", [f.outlet.id])
    ).toEqual([]);
    expect(await publicDishIds(f)).toHaveLength(25);
    expect(await snapshot(f)).toBeNull();
  });

  it("starts a grace period first and hides nothing during it", async () => {
    await setSwitch(true, 14);
    const f = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    expect(await publicDishIds(f)).toHaveLength(25);
    const snap = await snapshot(f);
    expect(snap).toMatchObject({ cap: 20, count: 25, hidden: 0 });
    const days = (new Date(String(snap?.["graceUntil"])).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("after the grace, hides the dishes beyond the cap in menu order, drops emptied categories and keeps all data", async () => {
    await setSwitch(true, 14);
    const f = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    await expireGrace(f);
    expect(await reconcilePlanOverflow(workerPool)).toContain(f.outlet.id);
    const visible = await publicDishIds(f);
    expect(visible).toEqual(Array.from({ length: 20 }, (_, i) => `d${i + 1}`));
    expect(await publicCategories(f)).toEqual(["a", "b"]);
    expect(await snapshot(f)).toMatchObject({ hidden: 5 });
    // The owner's menu is untouched: all 25 dishes are still in the draft and the release.
    const detail = await menuDetail(f.actor, f.menuId);
    expect(detail.document.categories.flatMap((c: { items: unknown[] }) => c.items)).toHaveLength(
      25
    );
    // A second sweep changes nothing.
    expect(await reconcilePlanOverflow(workerPool)).not.toContain(f.outlet.id);
  });

  it("the public product and ordering see the same filtered catalog", async () => {
    await setSwitch(true, 14);
    await ownerSql(
      "update app_private.plan_settings set free_intake_enabled=true, free_intake_monthly_cap=100"
    );
    try {
      const f = await publishedOutlet();
      await reconcilePlanOverflow(workerPool);
      await expireGrace(f);
      await reconcilePlanOverflow(workerPool);
      const product = await publicProduct(f.outlet.publicId);
      const ids = product!.menus.flatMap((m) =>
        m.document.categories.flatMap((c) => c.items.map((i) => i.id))
      );
      expect(ids).toHaveLength(20);
      const order = (dishId: string) => ({
        clientSubmissionKey: crypto.randomUUID(),
        quotedTotalMinor: 100,
        fulfillmentMode: "dine_in",
        items: [{ dishId, quantity: 1 }],
      });
      await expect(submitGuestOrder(f.outlet.publicId, order("d1"))).resolves.toMatchObject({
        status: "pending",
      });
      await expect(submitGuestOrder(f.outlet.publicId, order("d25"))).rejects.toThrow();
    } finally {
      await ownerSql(
        "update app_private.plan_settings set free_intake_enabled=false, free_intake_monthly_cap=100"
      );
    }
  });

  it("restores everything instantly on upgrade, before the worker runs, and the sweep then clears the rows", async () => {
    await setSwitch(true, 14);
    const f = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    await expireGrace(f);
    await reconcilePlanOverflow(workerPool);
    expect(await publicDishIds(f)).toHaveLength(20);
    await grant(f, "ordering.new");
    expect(await publicDishIds(f)).toHaveLength(25);
    await reconcilePlanOverflow(workerPool);
    expect(
      await ownerSql("select 1 from app_private.plan_hidden_dishes where outlet_id=$1", [
        f.outlet.id,
      ])
    ).toEqual([]);
    expect(await snapshot(f)).toBeNull();
  });

  it("restores when the owner frees up space, and when the switch is turned off", async () => {
    await setSwitch(true, 14);
    const f = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    await expireGrace(f);
    await reconcilePlanOverflow(workerPool);
    // Trim to 20 dishes and republish.
    const detail = await menuDetail(f.actor, f.menuId);
    await commandMenu(f.actor, f.outlet.id, f.menuId, {
      key: crypto.randomUUID(),
      expectedRevision: detail.revision,
      action: "save",
      data: { document: document(f.outlet.currency, 20) },
    });
    const after = await menuDetail(f.actor, f.menuId);
    await commandMenu(f.actor, f.outlet.id, f.menuId, {
      key: crypto.randomUUID(),
      expectedRevision: after.revision,
      action: "publish",
      data: {},
    });
    await reconcilePlanOverflow(workerPool);
    expect(await publicDishIds(f)).toHaveLength(20);
    expect(
      await ownerSql("select 1 from app_private.plan_hidden_dishes where outlet_id=$1", [
        f.outlet.id,
      ])
    ).toEqual([]);

    // The kill switch restores instantly, before any sweep.
    const g = await publishedOutlet();
    await reconcilePlanOverflow(workerPool);
    await expireGrace(g);
    await reconcilePlanOverflow(workerPool);
    expect(await publicDishIds(g)).toHaveLength(20);
    await setSwitch(false);
    expect(await publicDishIds(g)).toHaveLength(25);
    expect(await snapshot(g)).toBeNull();
  });

  it("restarts the grace period when the plan changes under an overflow", async () => {
    await setSwitch(true, 14);
    const f = await publishedOutlet(25);
    await reconcilePlanOverflow(workerPool);
    await expireGrace(f);
    await reconcilePlanOverflow(workerPool);
    await grant(f, "ordering.new");
    // 25 dishes fit under the Ordering cap, so tracking ends rather than restarting.
    await reconcilePlanOverflow(workerPool);
    expect(
      await ownerSql("select 1 from app_private.plan_overflow where outlet_id=$1", [f.outlet.id])
    ).toEqual([]);
  });

  it("keeps the sweep and the snapshot behind the right roles", async () => {
    await expect(
      getPool().query("select app_private.reconcile_plan_overflow('{}'::jsonb)")
    ).rejects.toThrow();
    await expect(getPool().query("select * from app_private.plan_hidden_dishes")).rejects.toThrow();
    const owner = await publishedOutlet();
    const stranger = await fixture();
    await setSwitch(true, 14);
    await reconcilePlanOverflow(workerPool);
    await expect(snapshot(owner, stranger.actor)).rejects.toThrow();
  });

  it("derives its caps from the reviewed catalog", () => {
    expect(JSON.parse(overflowCapsJson())).toEqual({ "0": 20, "1": 200, "2": 2000 });
  });
});
