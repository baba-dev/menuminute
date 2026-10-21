import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { getPool } from "../src/db";
import { withActor } from "../src/modules/tenancy/service";
import { runAdminCommand, type AdminActor } from "../src/lib/admin-guard";

// The test bootstraps a synthetic privileged actor through the isolated DB
// owner only. No application code may directly promote an account.
const ownerUrl = process.env["MIGRATION_DATABASE_URL"];
const rootId = crypto.randomUUID();
const memberId = crypto.randomUUID();
const rootSession = crypto.randomUUID();
const memberSession = crypto.randomUUID();
const orgId = crypto.randomUUID();
const email = `test-control-${rootId}@example.test`;
let owner: Pool;
const actor: AdminActor = {
  id: rootId,
  email,
  name: "Isolated platform admin",
  twoFactorEnabled: true,
  sessionId: rootSession,
};
const proof = async () =>
  owner.query(
    "insert into auth_step_up(session_id,user_id,expires_at) values($1,$2,now()+interval '5 minutes') on conflict(session_id) do update set expires_at=excluded.expires_at",
    [rootSession, rootId]
  );

beforeAll(async () => {
  if (!ownerUrl || !new URL(ownerUrl).pathname.endsWith("/menuminute_test"))
    throw new Error("An explicitly isolated menuminute_test migration-owner database is required");
  owner = new Pool({ connectionString: ownerUrl, max: 1 });
  await owner.query(
    `insert into users(id,name,email,email_verified,two_factor_enabled,is_super_admin)
     values($1,'Isolated platform admin',$2,true,true,true),
           ($3,'Isolated guest',$4,true,false,false)`,
    [rootId, email, memberId, `guest-${memberId}@example.test`]
  );
  await owner.query(
    "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour'),($4,$5,$6,now()+interval '1 hour')",
    [rootSession, crypto.randomUUID(), rootId, memberSession, crypto.randomUUID(), memberId]
  );
  await owner.query("insert into organizations(id,name) values($1,'Isolated platform tenant')", [
    orgId,
  ]);
}, 30000);
afterAll(async () => {
  await owner?.end();
});

describe("restricted-role platform command integration", () => {
  it("does not allow the runtime role to promote a user directly", async () => {
    await expect(
      getPool().query("update users set is_super_admin=true where id=$1", [memberId])
    ).rejects.toThrow();
    const actual = await owner.query("select is_super_admin from users where id=$1", [memberId]);
    expect(actual.rows[0]?.is_super_admin).toBe(false);
  });

  it("does not expose unrelated tenant data to a non-admin actor", async () => {
    const result = await withActor({ userId: memberId, sessionId: memberSession }, (tx) =>
      tx.execute<{ total: number }>(
        sql`select count(*)::int as total from organizations where id=${orgId}`
      )
    );
    expect(result.rows[0]?.total).toBe(0);
    const adminResult = await withActor({ userId: rootId, sessionId: rootSession }, (tx) =>
      tx.execute<{ total: number }>(
        sql`select count(*)::int as total from organizations where id=${orgId}`
      )
    );
    expect(adminResult.rows[0]?.total).toBe(1);
  });

  it("requires and consumes a one-use step-up, replays the exact receipt without a second mutation", async () => {
    const key = crypto.randomUUID();
    await expect(
      runAdminCommand(actor, "organization.mfa", orgId, { mfaRequired: false }, key)
    ).rejects.toThrow();
    await proof();
    const first = await runAdminCommand(
      actor,
      "organization.mfa",
      orgId,
      { mfaRequired: false },
      key
    );
    expect(first).toMatchObject({ id: orgId, mfaRequired: false });
    const replay = await runAdminCommand(
      actor,
      "organization.mfa",
      orgId,
      { mfaRequired: false },
      key
    );
    expect(replay).toEqual(first);
    await expect(
      runAdminCommand(actor, "organization.mfa", orgId, { mfaRequired: true }, key)
    ).rejects.toThrow();
    const audit = await withActor({ userId: rootId, sessionId: rootSession }, (tx) =>
      tx.execute<{ total: number }>(
        sql`select count(*)::int as total from admin_audit_logs where target_id=${orgId} and action='organization.mfa'`
      )
    );
    expect(audit.rows[0]?.total).toBe(1);
    await expect(
      runAdminCommand(actor, "organization.mfa", orgId, { mfaRequired: true }, crypto.randomUUID())
    ).rejects.toThrow();
  });

  it("retries failed outbox only once and clears the lease in the audited transaction", async () => {
    const eventId = crypto.randomUUID();
    await owner.query(
      "insert into outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload,status,attempts,max_attempts,lease_token,lease_until) values($1,$2,null,'test.failed',1,1,'{}','failed',2,20,'stale',now()-interval '1 minute')",
      [eventId, orgId]
    );
    await proof();
    await expect(runAdminCommand(actor, "outbox.retry", eventId)).resolves.toMatchObject({
      success: true,
    });
    const state = await owner.query(
      "select status,attempts,lease_token,lease_until from outbox_events where id=$1",
      [eventId]
    );
    expect(state.rows[0]).toMatchObject({
      status: "pending",
      attempts: 0,
      lease_token: null,
      lease_until: null,
    });
    await proof();
    await expect(runAdminCommand(actor, "outbox.retry", eventId)).rejects.toThrow();
    const audit = await withActor({ userId: rootId, sessionId: rootSession }, (tx) =>
      tx.execute<{ total: number }>(
        sql`select count(*)::int as total from admin_audit_logs where target_id=${eventId} and action='outbox.retry'`
      )
    );
    expect(audit.rows[0]?.total).toBe(1);
  });

  it("keeps commercial Kitchen Pro activation disabled", async () => {
    await proof();
    const start = new Date(Date.now() + 3600000).toISOString();
    const end = new Date(Date.now() + 86400000).toISOString();
    await expect(
      runAdminCommand(actor, "entitlement.grant", orgId, {
        capability: "kitchen.new",
        billingCurrency: "USD",
        startsAt: start,
        endsAt: end,
        reason: "Release gates not approved",
      })
    ).rejects.toThrow();
    const result = await owner.query(
      "select count(*)::int as total from entitlement_grants where organization_id=$1",
      [orgId]
    );
    expect(result.rows[0]?.total).toBe(0);
  });
});
