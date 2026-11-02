import { describe, expect, it, vi } from "vitest";

// Plan caps are a no-op unless PLAN_LIMITS_ENFORCED is on; enable it for this file only.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return { ...mod, env: { ...mod.env, PLAN_LIMITS_ENFORCED: true } };
});

import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
import { getPlanUsageView } from "../src/modules/plans/usage";

type F = Awaited<ReturnType<typeof fixture>>;
async function addOutlet(f: F, name: string) {
  const version = (await listOrganizations(f.actor)).find(
    (o) => o.id === f.outlet.organizationId
  )!.version;
  return manageOrganization(f.actor, f.outlet.organizationId, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: {
      action: "outlet.create",
      data: {
        name,
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
        fulfillmentModes: ["dine_in"],
      },
    },
  });
}
const grant = (f: F, capability: "ordering.new" | "kitchen.new") =>
  admin(async (_db, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "outlet-test",
      reason: "Outlet cap test",
      action: "grant",
      capability,
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });

describe("outlet limit: 1 on Free and Ordering, 10 on Kitchen Pro", () => {
  it("lets Free have one outlet and refuses a second with an upgrade pointer", async () => {
    const f = await fixture();
    await expect(addOutlet(f, "Second")).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      resource: "outlets",
      limit: 1,
      upgradeTo: "Kitchen Pro",
    });
  });

  it("applies the same single-outlet limit on Ordering", async () => {
    const f = await fixture();
    await grant(f, "ordering.new");
    await expect(addOutlet(f, "Second")).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      limit: 1,
    });
  });

  it("lets Kitchen Pro grow to ten outlets and stops there", async () => {
    const f = await fixture();
    await grant(f, "kitchen.new");
    for (let i = 2; i <= 10; i++) await addOutlet(f, `Outlet ${i}`);
    await expect(addOutlet(f, "Outlet 11")).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      limit: 10,
    });
    // The meter appears once an organization can have several outlets.
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.meters.find((m) => m.key === "outlets")).toMatchObject({ used: 10, cap: 10 });
  });

  it("shows no outlet meter for the normal single-outlet case", async () => {
    const f = await fixture();
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.meters.map((m) => m.key)).not.toContain("outlets");
  });
});
