import { describe, expect, it, vi } from "vitest";

// The usage reader is a no-op unless PLAN_LIMITS_ENFORCED is on; enable it for this file only.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return { ...mod, env: { ...mod.env, PLAN_LIMITS_ENFORCED: true } };
});

import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu, qrCommand } from "../src/modules/menu-product/service";
import { getPlanUsageView } from "../src/modules/plans/usage";
import { withOutlet } from "../src/modules/tenancy/service";
import { sql } from "drizzle-orm";

async function outletWithDishes(n: number) {
  const f = await fixture();
  const items = Array.from({ length: n }, (_, i) => ({
    id: `d${i + 1}`,
    name: `Dish ${i + 1}`,
    priceMinor: 100,
  }));
  await commandMenu(f.actor, f.outlet.id, crypto.randomUUID(), {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Menu",
        currency: f.outlet.currency,
        categories: [{ id: "all", name: "All", items }],
      },
    },
  });
  return f;
}

describe("plan usage reader (slice 2c)", () => {
  it("reports real counts for a Free outlet with honest meters", async () => {
    const f = await outletWithDishes(17);
    await qrCommand(f.actor, f.outlet.id, {
      key: crypto.randomUUID(),
      action: "create",
      data: { label: "Table 1", pointLabel: "Table 1" },
    });
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.plan).toBe("free");
    const dishes = view?.meters.find((m) => m.key === "dishes");
    expect(dishes).toMatchObject({ used: 17, cap: 20, state: "near" });
    expect(view?.meters.find((m) => m.key === "qrCodes")?.used).toBeGreaterThanOrEqual(1);
    // No AI, storage or seat meters: only enforced limits are shown.
    expect(view?.meters.map((m) => m.key)).not.toContain("aiCreditsPerMonth");
  });

  it("follows a paid ordering grant and shows no Free order meter", async () => {
    const f = await outletWithDishes(3);
    await admin(async (_db, pool) => {
      await applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "usage-test",
        reason: "Usage reader test",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      });
    });
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.plan).toBe("ordering");
    expect(view?.meters.find((m) => m.key === "dishes")?.cap).toBe(200);
    expect(view?.meters.map((m) => m.key)).not.toContain("orders");
  });

  it("returns nothing for someone who cannot read the outlet", async () => {
    const owner = await fixture();
    const stranger = await fixture();
    expect(await getPlanUsageView(stranger.actor, owner.outlet.id)).toBeNull();
  });

  it("exposes the free-intake snapshot only to members of the outlet", async () => {
    const owner = await fixture();
    const stranger = await fixture();
    const read = (actor: { userId: string }) =>
      withOutlet(actor, owner.outlet.id, "menu.read", async (tx) => {
        const r = await tx.execute<{ snap: unknown }>(
          sql`select app_private.free_intake_snapshot(${owner.outlet.id}) as snap`
        );
        return r.rows[0]?.snap;
      });
    expect(await read(owner.actor)).toMatchObject({
      enabled: expect.any(Boolean),
      used: 0,
      cap: expect.any(Number),
    });
    await expect(read(stranger.actor)).rejects.toThrow();
  });
});
