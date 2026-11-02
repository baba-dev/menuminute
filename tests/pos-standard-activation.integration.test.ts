import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { posContext } from "../src/modules/pos/service";
import { financeRead, financeCommand } from "../src/modules/pos/finance";

describe("POS automatic paid activation", () => {
  it("enables an existing outlet when its Ordering grant becomes active without opening fiscal gates", async () => {
    const f = await fixture();
    const before = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(before.enabled).toBe(false);
    await admin(async (_db, pool) => {
      await pool.query(
        `insert into entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
         values($1,$2,'ordering.new','INR',clock_timestamp()-interval '1 minute',
                clock_timestamp()+interval '2 days','pos-standard-test','Authorized activation test',$3)`,
        [crypto.randomUUID(), f.outlet.organizationId, crypto.randomUUID()]
      );
    });
    const after = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(after.enabled).toBe(true);
    expect(after.seller).toBeNull(); // Ordinary POS must not invent a legal seller registration.
    const financial = await financeRead(f.actor, f.outlet.organizationId, f.outlet.id, {
      view: "context",
    });
    expect(financial).toMatchObject({
      paymentsEnabled: false,
      documentsEnabled: false,
      fiscalApproved: false,
      canCloseShift: true,
    });
    const shift = await financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
      key: crypto.randomUUID(),
      action: "open_shift",
      data: { registerName: "counter", openingMinor: "0" },
    });
    expect(shift).toMatchObject({ state: "open" });
    await expect(
      financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
        key: crypto.randomUUID(),
        action: "issue",
        data: { saleId: "not-a-sale" },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not activate an unentitled outlet on a read", async () => {
    const f = await fixture();
    expect((await posContext(f.actor, f.outlet.organizationId, f.outlet.id)).enabled).toBe(false);
    const settings = await admin(async (_db, pool) =>
      pool.query("select enabled from pos_outlet_settings where outlet_id=$1", [f.outlet.id])
    );
    expect(settings.rows).toEqual([]);
  });
});
