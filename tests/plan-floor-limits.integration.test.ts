import { describe, expect, it, vi } from "vitest";

// Plan caps are a no-op unless PLAN_LIMITS_ENFORCED is on; enable it for this file only.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return { ...mod, env: { ...mod.env, PLAN_LIMITS_ENFORCED: true } };
});

import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { qrCommand } from "../src/modules/menu-product/service";
import { addChairs, createTable } from "../src/modules/hospitality/floor-service";
import { getPlanUsageView } from "../src/modules/plans/usage";
import { sql } from "drizzle-orm";
import { withOutlet } from "../src/modules/tenancy/service";

const table = (name: string, chairCount: number) => ({
  name,
  sectionId: null,
  shape: "round" as const,
  chairCount,
  chairKind: "standard" as const,
});
async function counts(f: Awaited<ReturnType<typeof fixture>>) {
  return withOutlet(f.actor, f.outlet.id, "menu.read", async (tx) => {
    const r = await tx.execute<{ t: number; c: number }>(sql`
      select (select count(*)::int from restaurant_tables
              where restaurant_id=${f.outlet.id} and is_active and display_number is not null) t,
             (select count(*)::int from restaurant_chairs
              where outlet_id=${f.outlet.id} and is_active) c`);
    return r.rows[0]!;
  });
}

describe("dining floor plan caps (tables and chairs)", () => {
  it("Free allows 2 tables and 6 chairs and rolls back anything beyond", async () => {
    const f = await fixture();
    await createTable(f.actor, f.outlet.id, table("T1", 4));
    // A second table with 3 chairs would make 7 chairs: the whole table is rejected.
    await expect(createTable(f.actor, f.outlet.id, table("T2", 3))).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      resource: "chairs",
      limit: 6,
      upgradeTo: "Ordering",
    });
    expect(await counts(f)).toEqual({ t: 1, c: 4 });
    await createTable(f.actor, f.outlet.id, table("T2", 2));
    expect(await counts(f)).toEqual({ t: 2, c: 6 });
    await expect(createTable(f.actor, f.outlet.id, table("T3", 0))).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      resource: "tables",
      limit: 2,
    });
    await expect(
      addChairs(f.actor, f.outlet.id, { count: 1, kind: "standard", tableId: null })
    ).rejects.toMatchObject({ code: "LIMIT_REACHED", resource: "chairs" });
    expect(await counts(f)).toEqual({ t: 2, c: 6 });
  });

  it("does not count legacy QR-only tables toward the floor cap", async () => {
    const f = await fixture();
    await qrCommand(f.actor, f.outlet.id, {
      key: crypto.randomUUID(),
      action: "create",
      data: { label: "Table A", pointLabel: "Table A" },
    });
    await createTable(f.actor, f.outlet.id, table("Floor 1", 1));
    await createTable(f.actor, f.outlet.id, table("Floor 2", 1));
    expect((await counts(f)).t).toBe(2);
  });

  it("follows a paid ordering grant to 10 tables and 30 chairs and shows the meters", async () => {
    const f = await fixture();
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "floor-test",
        reason: "Floor cap test",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    for (let i = 1; i <= 3; i++) await createTable(f.actor, f.outlet.id, table(`T${i}`, 5));
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.plan).toBe("ordering");
    expect(view?.meters.find((m) => m.key === "tables")).toMatchObject({ used: 3, cap: 10 });
    expect(view?.meters.find((m) => m.key === "chairs")).toMatchObject({ used: 15, cap: 30 });
  });

  it("lets an outlet already over its cap keep working but not grow", async () => {
    const f = await fixture();
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "floor-test",
        reason: "Floor cap test",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    for (let i = 1; i <= 4; i++) await createTable(f.actor, f.outlet.id, table(`T${i}`, 0));
    // Revoke the grant: the outlet is now Free with 4 tables (cap 2).
    await admin(async (_db, pool) => {
      await pool.query(
        "update entitlement_grants set revoked_at=clock_timestamp() where organization_id=$1",
        [f.outlet.organizationId]
      );
    });
    await expect(createTable(f.actor, f.outlet.id, table("T5", 0))).rejects.toMatchObject({
      code: "LIMIT_REACHED",
    });
    expect((await counts(f)).t).toBe(4);
  });
});
