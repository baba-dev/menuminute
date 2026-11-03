import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";

/**
 * Runs under real PostgreSQL with 0106 migrated. Signoffs below are isolated
 * TEST FIXTURES ONLY: no invoice, IRN or statutory credit is ever issued.
 */
describe("India GST statutory ledger permissions and concurrency", () => {
  it("defaults closed and refuses app-role fiscal table reads and serial allocation", async () => {
    const f = await fixture();
    const result = await withActor(f.actor, async (tx) => {
      await tx.execute(sql\`select set_config('app.outlet_id',\${f.outlet.id},true)\`);
      const x = await tx.execute<{ result: {
        statutoryIssuanceAvailable: boolean;
        registeredOperatorRelease: boolean;
        invoiceCount: number;
      } }>(sql\`select app_private.india_gst_ledger_readiness(\${f.outlet.id}) as result\`);
      return x.rows[0]?.result;
    });
    expect(result).toMatchObject({
      registeredOperatorRelease: false,
      statutoryIssuanceAvailable: false,
      invoiceCount: 0,
    });
    await expect(withActor(f.actor, async (tx) => {
      await tx.execute(sql\`select set_config('app.outlet_id',\${f.outlet.id},true)\`);
      await tx.execute(sql\`select * from app_private.india_gst_statutory_records\`);
    })).rejects.toThrow();
    await expect(withActor(f.actor, async (tx) => {
      await tx.execute(sql\`select set_config('app.outlet_id',\${f.outlet.id},true)\`);
      await tx.execute(sql\`select app_private.india_gst_allocate_serial(
        \${f.outlet.id},'08ABCDE1234F1Z5','INV',
        (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date
      )\`);
    })).rejects.toThrow();
  });

  it("does not expose another merchant's GST release status", async () => {
    const owner = await fixture();
    const other = await fixture();
    await expect(withActor(owner.actor, async (tx) => {
      await tx.execute(sql\`select set_config('app.outlet_id',\${other.outlet.id},true)\`);
      await tx.execute(sql\`select app_private.india_gst_ledger_readiness(\${other.outlet.id})\`);
    })).rejects.toThrow();
  });

  it("operator-only numbering is unique across outlets sharing a GSTIN", async () => {
    const a = await fixture();
    const b = await fixture();
    const gstin = "08ABCDE1234F1Z5";
    for (const f of [a,b]) {
      await admin(async (_db,pool) => {
        await pool.query(
          "insert into app_private.india_gst_operator_releases("+
          "organization_id,outlet_id,supplier_gstin,legal_signoff,finance_signoff,"+
          "jurisdiction_verified,irp_applicability_verified,adapter_verified,"+
          "signing_verified,printer_acceptance,release_enabled,approved_at,approved_by) "+
          "values($1,$2,$3,true,true,true,true,true,true,true,true,clock_timestamp(),$4)",
          [f.outlet.organizationId, f.outlet.id, gstin, f.actor.userId]
        );
      });
    }
    const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 8 });
    try {
      const requests = Array.from({ length: 20 }, (_v,i) => {
        const outlet = i % 2 ? a.outlet.id : b.outlet.id;
        return pool.query<{ result: {
          serial: number; documentNumber: string; supplierGstin: string;
        } }>(
          "select app_private.india_gst_allocate_serial("+
          "$1,$2,'INV',(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date) as result",
          [outlet,gstin]
        );
      });
      const allocated = (await Promise.all(requests)).map(x => x.rows[0]!.result);
      expect(new Set(allocated.map(x => x.serial)).size).toBe(20);
      expect(allocated.map(x => x.serial).sort((x,y) => x-y)).toEqual(
        Array.from({ length:20 },(_v,i)=>i+1)
      );
      expect(new Set(allocated.map(x => x.documentNumber)).size).toBe(20);
      expect(allocated.every(x => x.supplierGstin===gstin)).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("release cannot be enabled without signed-off mandatory controls", async () => {
    const f=await fixture();
    await expect(admin(async (_db,pool) => pool.query(
      "insert into app_private.india_gst_operator_releases("+
      "organization_id,outlet_id,supplier_gstin,release_enabled) values($1,$2,$3,true)",
      [f.outlet.organizationId,f.outlet.id,"08ABCDE1234F1Z5"]
    ))).rejects.toThrow();
    await expect(admin(async (_db,pool) => pool.query(
      "select app_private.india_gst_allocate_serial("+
      "$1,$2,'INV',(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date)",
      [f.outlet.id,"08ABCDE1234F1Z5"]
    ))).rejects.toThrow();
  });
});
