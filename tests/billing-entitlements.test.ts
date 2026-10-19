import { it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { billingState, withEntitledOutlet } from "../src/modules/billing/service";
import { withActor, withOutlet } from "../src/modules/tenancy/service";
import { getPublicMenu } from "../src/modules/restaurants/service";
const grant = (organizationId: string, starts = -1000, ends = 3600000) => ({
  key: crypto.randomUUID(),
  organizationId,
  operator: "test-operator",
  reason: "Isolated entitlement test",
  action: "grant",
  capability: "ordering.new",
  billingCurrency: "USD",
  startsAt: new Date(Date.now() + starts).toISOString(),
  endsAt: new Date(Date.now() + ends).toISOString(),
});
it("uses explicit DB-time windows, immutable idempotent grants and owner-only billing separate from outlet currency", async () => {
  const { actor, outlet } = await fixture("OMR");
  const org = outlet.organizationId;
  expect((await billingState(actor, org)).ordering).toBe(false);
  await expect(
    withEntitledOutlet(actor, outlet.id, "orders.accept", "ordering.new", async () => true)
  ).rejects.toMatchObject({ statusCode: 403 });
  await admin(async (_, pool) => {
    const input = grant(org);
    const a = await applyEntitlement(pool, input);
    expect(await applyEntitlement(pool, input)).toEqual(a);
    await expect(applyEntitlement(pool, { ...input, billingCurrency: "INR" })).rejects.toThrow(
      "conflict"
    );
    await expect(
      applyEntitlement(pool, { ...grant(org), billingCurrency: "OMR" })
    ).rejects.toThrow();
  });
  expect((await billingState(actor, org)).ordering).toBe(true);
  expect(outlet.currency).toBe("OMR");
  expect(
    await withEntitledOutlet(actor, outlet.id, "orders.accept", "ordering.new", async () => true)
  ).toBe(true);
  await expect(
    withActor(actor, (tx) =>
      tx.execute(
        sql`update entitlement_grants set ends_at=now()+interval '1 year' where organization_id=${org}`
      )
    )
  ).rejects.toThrow();
  const adminUser = crypto.randomUUID();
  await admin(async (_, p) => {
    await p.query(
      "insert into users(id,name,email,email_verified) values($1,'Billing admin',$2,true)",
      [adminUser, `${adminUser}@test.invalid`]
    );
    await p.query(
      "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'admin')",
      [crypto.randomUUID(), org, adminUser]
    );
  });
  await expect(billingState({ userId: adminUser }, org)).rejects.toMatchObject({ statusCode: 403 });
  const another = await fixture();
  await expect(billingState(another.actor, org)).rejects.toMatchObject({ statusCode: 403 });
});
it("expiration/revocation gates new work, preserves accepted completion and free QR", async () => {
  const { actor, outlet } = await fixture();
  const org = outlet.organizationId;
  await admin(async (_, p) => {
    await p.query("update restaurants set is_published=true where id=$1", [outlet.id]);
    await applyEntitlement(p, grant(org, -10000, -5000));
    await applyEntitlement(p, grant(org, 60000, 120000));
  });
  expect((await billingState(actor, org)).ordering).toBe(false);
  expect(await getPublicMenu(outlet.publicId)).not.toBeNull();
  await admin(async (_, p) => {
    const g = await applyEntitlement(p, grant(org));
    const revoke = {
      action: "revoke",
      key: crypto.randomUUID(),
      organizationId: org,
      grantId: g.grantId,
      operator: "test-operator",
      reason: "Explicit revocation test",
    };
    await applyEntitlement(p, revoke);
    expect(await applyEntitlement(p, revoke)).toEqual({ grantId: g.grantId });
  });
  await expect(
    withEntitledOutlet(actor, outlet.id, "orders.accept", "ordering.new", async () => true)
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(await withOutlet(actor, outlet.id, "orders.complete", async () => true)).toBe(true);
  expect(await getPublicMenu(outlet.publicId)).not.toBeNull();
});
it("serializes entitlement revocation against an already checked new-work transaction", async () => {
  const { actor, outlet } = await fixture();
  const org = outlet.organizationId;
  await admin(async (_, p) => {
    const g = await applyEntitlement(p, grant(org));
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const checked = new Promise<void>((r) => (entered = r));
    const creating = withEntitledOutlet(
      actor,
      outlet.id,
      "orders.accept",
      "ordering.new",
      async () => {
        entered();
        await gate;
        return true;
      }
    );
    await checked;
    let revoked = false;
    const revoking = applyEntitlement(p, {
      action: "revoke",
      key: crypto.randomUUID(),
      organizationId: org,
      grantId: g.grantId,
      operator: "test-operator",
      reason: "Revocation race test",
    }).then(() => {
      revoked = true;
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(revoked).toBe(false);
    release();
    expect(await creating).toBe(true);
    await revoking;
  });
  await expect(
    withEntitledOutlet(actor, outlet.id, "orders.accept", "ordering.new", async () => true)
  ).rejects.toMatchObject({ statusCode: 403 });
});
it("evaluates entitlement expiry after waiting for an organization lock", async () => {
  const { actor, outlet } = await fixture();
  const org = outlet.organizationId;
  await admin(async (_, p) => {
    await applyEntitlement(p, grant(org, -1000, 150));
    const lock = await p.connect();
    try {
      await lock.query("begin");
      await lock.query("select id from organizations where id=$1 for update", [org]);
      const outcome = withEntitledOutlet(
        actor,
        outlet.id,
        "orders.accept",
        "ordering.new",
        async () => true
      ).then(
        (v) => v,
        (e) => e
      );
      await new Promise((r) => setTimeout(r, 250));
      await lock.query("commit");
      expect(await outcome).toMatchObject({ statusCode: 403 });
    } finally {
      lock.release();
    }
  });
});
