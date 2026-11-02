import { describe, expect, it, vi } from "vitest";

// Plan storage caps apply only while plan limits are enforced; enable that for this file only.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return { ...mod, env: { ...mod.env, PLAN_LIMITS_ENFORCED: true } };
});

import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { uploadDishPhoto } from "../src/modules/media/product-service";
import { getPlanUsageView } from "../src/modules/plans/usage";

type F = Awaited<ReturnType<typeof fixture>>;
const MB = 1024 * 1024;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
/** Fill an outlet's photo store with `megabytes` of records, 5 MiB (the per-file maximum) at a time. */
async function fill(f: F, megabytes: number) {
  for (let left = megabytes; left > 0; left -= 5)
    await owner(
      `insert into dish_media(id,organization_id,outlet_id,actor_id,size_bytes,source_key,rights,status)
       values($1,$2,$3,$4,$5,$6,'Owner photo rights confirmed','ready')`,
      [
        crypto.randomUUID(),
        f.outlet.organizationId,
        f.outlet.id,
        f.actor.userId,
        Math.min(5, left) * MB,
        `${f.outlet.organizationId}/${crypto.randomUUID()}/original`,
      ]
    );
}
const upload = (f: F, bytes = 1024) =>
  uploadDishPhoto(f.actor, f.outlet.id, Buffer.alloc(bytes, 1), "Owner photo rights confirmed");
const grant = (f: F, capability: "ordering.new" | "kitchen.new") =>
  admin(async (_db, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "storage-test",
      reason: "Storage cap test",
      action: "grant",
      capability,
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });

describe("photo storage per plan: 100 MB Free, 300 MB Ordering, 500 MB Kitchen Pro", () => {
  it("accepts an upload while there is room", async () => {
    const f = await fixture();
    await fill(f, 95);
    await expect(upload(f, 2 * MB)).resolves.toMatchObject({ status: "queued" });
  });

  it("refuses an upload that would pass the Free 100 MB cap, naming the cap and the next plan", async () => {
    const f = await fixture();
    await fill(f, 100);
    await expect(upload(f)).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      resource: "MB of photo storage",
      limit: 100,
      upgradeTo: "Ordering",
    });
  });

  it("an upgrade lifts it immediately: Ordering holds 300 MB", async () => {
    const f = await fixture();
    await fill(f, 100);
    await expect(upload(f)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    await grant(f, "ordering.new");
    await expect(upload(f)).resolves.toMatchObject({ status: "queued" });
    await fill(f, 200); // now at 300 MB
    await expect(upload(f)).rejects.toMatchObject({ limit: 300, upgradeTo: "Kitchen Pro" });
  });

  it("Kitchen Pro holds 500 MB and has no self-serve upgrade above it", async () => {
    const f = await fixture();
    await grant(f, "kitchen.new");
    await fill(f, 500);
    await expect(upload(f)).rejects.toMatchObject({ limit: 500, upgradeTo: null });
  });

  it("shows the storage meter, full at the cap", async () => {
    const f = await fixture();
    await fill(f, 100);
    expect(
      (await getPlanUsageView(f.actor, f.outlet.id))?.meters.find((m) => m.key === "storage")
    ).toMatchObject({
      used: 100,
      cap: 100,
      state: "full",
    });
  });

  it("keeps the generic hourly upload limit as its own message", async () => {
    const f = await fixture();
    await grant(f, "kitchen.new");
    for (let i = 0; i < 30; i++)
      await owner(
        `insert into dish_media(id,organization_id,outlet_id,actor_id,size_bytes,source_key,rights)
         values($1,$2,$3,$4,1024,$5,'Owner photo rights confirmed')`,
        [
          crypto.randomUUID(),
          f.outlet.organizationId,
          f.outlet.id,
          f.actor.userId,
          `k/${crypto.randomUUID()}`,
        ]
      );
    await expect(upload(f)).rejects.toMatchObject({
      message: expect.stringContaining("temporarily limited"),
    });
  });
});
