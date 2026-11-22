import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";
import {
  getOutletReceiptPayment,
  saveOutletReceiptPayment,
} from "../src/modules/receipt-payment/service";

const command = (expectedRevision: number, over: Record<string, unknown> = {}) => ({
  expectedRevision,
  upiId: "Spiceroute@OkHDFC",
  payeeName: "Spice Route Kitchen",
  enabled: true,
  ...over,
});

async function addMember(organizationId: string, outletId: string, grant?: string[]) {
  const userId = crypto.randomUUID();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Member',$2,true)",
      [userId, `${userId}@test.invalid`]
    );
    const memberId = crypto.randomUUID();
    await pool.query(
      "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'member')",
      [memberId, organizationId, userId]
    );
    if (grant)
      await pool.query(
        "insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,$4)",
        [organizationId, memberId, outletId, grant]
      );
  });
  return { userId };
}

describe("outlet receipt payment profile (real PostgreSQL)", () => {
  it("starts unconfigured, saves with compare-and-swap and keeps history", async () => {
    const { actor, outlet } = await fixture("INR");
    const org = outlet.organizationId;
    expect(await getOutletReceiptPayment(actor, org, outlet.id)).toMatchObject({
      configured: false,
      upiId: null,
      enabled: false,
      revision: 0,
    });
    const first = await saveOutletReceiptPayment(actor, org, outlet.id, command(0));
    expect(first).toMatchObject({
      configured: true,
      upiId: "spiceroute@okhdfc",
      payeeName: "Spice Route Kitchen",
      enabled: true,
      revision: 1,
    });
    await expect(
      saveOutletReceiptPayment(actor, org, outlet.id, command(0, { enabled: false }))
    ).rejects.toMatchObject({ statusCode: 409 });
    const second = await saveOutletReceiptPayment(
      actor,
      org,
      outlet.id,
      command(1, { enabled: false })
    );
    expect(second).toMatchObject({ revision: 2, enabled: false });
    const history = await admin(async (_db, pool) =>
      pool.query(
        "select revision from app_private.outlet_receipt_payment_profiles_history where outlet_id=$1 order by revision",
        [outlet.id]
      )
    );
    expect(history.rows.map((r) => r.revision)).toEqual([1, 2]);
    // Like the audit trail, history never keeps the full UPI ID (only a masked hint).
    const historyText = JSON.stringify(
      (
        await admin(async (_db, pool) =>
          pool.query(
            "select * from app_private.outlet_receipt_payment_profiles_history where outlet_id=$1",
            [outlet.id]
          )
        )
      ).rows
    );
    expect(historyText).not.toMatch(/spiceroute/i);
    expect(historyText).toMatch(/@okhdfc/);
  });

  it("audits the change without ever storing the UPI ID", async () => {
    const { actor, outlet } = await fixture("INR");
    await saveOutletReceiptPayment(actor, outlet.organizationId, outlet.id, command(0));
    const audit = await admin(async (_db, pool) =>
      pool.query(
        "select details::text as details from domain_audit where organization_id=$1 and action='outlet.receipt_payment.settings'",
        [outlet.organizationId]
      )
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].details).not.toMatch(/spiceroute|okhdfc/i);
    expect(JSON.parse(audit.rows[0].details)).toMatchObject({
      outletId: outlet.id,
      revision: 1,
      enabled: true,
    });
  });

  it("lets receipt readers read but only managers write; strangers do neither", async () => {
    const { actor, outlet } = await fixture("INR");
    const org = outlet.organizationId;
    await saveOutletReceiptPayment(actor, org, outlet.id, command(0));
    const cashier = await addMember(org, outlet.id, ["service"]);
    expect(await getOutletReceiptPayment(cashier, org, outlet.id)).toMatchObject({
      configured: true,
      revision: 1,
    });
    await expect(
      saveOutletReceiptPayment(cashier, org, outlet.id, command(1, { enabled: false }))
    ).rejects.toMatchObject({ statusCode: 403 });
    const ungranted = await addMember(org, outlet.id);
    await expect(getOutletReceiptPayment(ungranted, org, outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      saveOutletReceiptPayment(ungranted, org, outlet.id, command(1))
    ).rejects.toMatchObject({ statusCode: 403 });
    const other = await fixture("INR");
    await expect(getOutletReceiptPayment(other.actor, org, outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      saveOutletReceiptPayment(other.actor, org, outlet.id, command(1))
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("refuses to configure a demo outlet", async () => {
    const { actor, outlet } = await fixture("INR");
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_demo_data=true where id=$1", [outlet.id]);
    });
    await expect(
      saveOutletReceiptPayment(actor, outlet.organizationId, outlet.id, command(0))
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("hides the table from the application role and rejects malformed rows at the database", async () => {
    const { outlet } = await fixture("INR");
    const app = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    try {
      await expect(
        app.query("select * from app_private.outlet_receipt_payment_profiles")
      ).rejects.toThrow(/permission denied/);
    } finally {
      await app.end();
    }
    await admin(async (_db, pool) => {
      const owner = (
        await pool.query("select user_id from organization_members where organization_id=$1", [
          outlet.organizationId,
        ])
      ).rows[0].user_id;
      await expect(
        pool.query(
          "insert into app_private.outlet_receipt_payment_profiles(outlet_id,organization_id,upi_id,payee_name,enabled,revision,updated_by) values($1,$2,'bad id@x','Cafe',true,1,$3)",
          [outlet.id, outlet.organizationId, owner]
        )
      ).rejects.toMatchObject({ code: "23514" });
    });
  });
});
