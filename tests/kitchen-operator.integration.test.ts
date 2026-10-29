import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";
import { kitchenAdmin } from "../src/modules/kitchen/service";
import { commandMenu } from "../src/modules/menu-product/service";

const sentinel = "9999-12-31T23:59:59.000Z";
const reason = "Kitchen operator approval in isolated production test";
const evidenceUrl = "https://github.com/baba-dev/menuminute/issues/76";
const releaseSha = "b".repeat(40);

async function operator() {
  const id = crypto.randomUUID(),
    sessionId = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      "INSERT INTO users(id,name,email,email_verified,two_factor_enabled,is_super_admin) VALUES($1,'Kitchen operator',$2,true,true,true)",
      [id, id + "@operator.invalid"]
    );
    await pool.query(
      "INSERT INTO sessions(id,token,user_id,expires_at) VALUES($1,$2,$3,now()+interval '2 hours')",
      [sessionId, crypto.randomUUID(), id]
    );
  });
  return { id, sessionId, actor: { userId: id, sessionId } };
}
async function proof(id: string, sessionId: string) {
  await admin(async (_, pool) => {
    await pool.query(
      "INSERT INTO auth_step_up(session_id,user_id,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(session_id) DO UPDATE SET expires_at=excluded.expires_at",
      [sessionId, id]
    );
  });
}
function grantPayload(term: "trial_7" | "permanent") {
  const start = new Date();
  return {
    term,
    billingCurrency: "INR",
    startsAt: start.toISOString(),
    endsAt:
      term === "permanent" ? sentinel : new Date(start.getTime() + 7 * 86400000).toISOString(),
    reason,
  };
}

describe("Kitchen operator grant security boundary", () => {
  it("rejects unprivileged grants and requires a single-use password/TOTP proof", async () => {
    const f = await fixture();
    const op = await operator();
    const payload = JSON.stringify(grantPayload("trial_7"));
    const key = crypto.randomUUID();
    const issue = (actor: { userId: string; sessionId?: string }) =>
      withActor(actor, (tx) =>
        tx.execute<{ data: { id: string; term: string } }>(sql`
        SELECT app_private.kitchen_operator_grant(${f.outlet.organizationId},${payload}::jsonb,${key}) AS data
      `)
      );
    await expect(issue(f.actor)).rejects.toThrow();
    await expect(issue(op.actor)).rejects.toThrow();
    await proof(op.id, op.sessionId);
    const granted = await issue(op.actor);
    expect(granted.rows[0]?.data.term).toBe("trial_7");
    expect((await issue(op.actor)).rows[0]?.data.id).toBe(granted.rows[0]?.data.id);
    const raw = await admin(async (_, pool) =>
      pool.query<{ capability: string; revoked_at: Date | null }>(
        "SELECT capability,revoked_at FROM entitlement_grants WHERE id=$1",
        [granted.rows[0]?.data.id]
      )
    );
    expect(raw.rows[0]?.capability).toBe("kitchen.new");
    const flags = await admin(async (_, pool) =>
      pool.query<{ enabled: boolean }>(
        "SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=$1",
        [f.outlet.id]
      )
    );
    expect(flags.rows[0]?.enabled ?? false).toBe(false);
  });

  it("issues a revocable permanent grant but rejects changed idempotency payloads", async () => {
    const f = await fixture();
    const op = await operator();
    const payload = grantPayload("permanent");
    const key = crypto.randomUUID();
    const grant = async (body: typeof payload) =>
      withActor(op.actor, (tx) =>
        tx.execute<{ data: { id: string; term: string } }>(sql`
      SELECT app_private.kitchen_operator_grant(
        ${f.outlet.organizationId},${JSON.stringify(body)}::jsonb,${key}
      ) AS data`)
      );
    await proof(op.id, op.sessionId);
    const created = await grant(payload);
    expect(created.rows[0]?.data.term).toBe("permanent");
    await expect(grant({ ...payload, reason: reason + " tampered" })).rejects.toThrow();
    const values = await admin(async (_, pool) =>
      pool.query<{ ends_at: string }>("SELECT ends_at::text FROM entitlement_grants WHERE id=$1", [
        created.rows[0]?.data.id,
      ])
    );
    expect(values.rows[0]?.ends_at.startsWith("9999-12-31")).toBe(true);
  });

  it("refuses activation without kitchen readiness and refuses invalid evidence", async () => {
    const f = await fixture();
    const op = await operator();
    await proof(op.id, op.sessionId);
    const payload = {
      releaseSha,
      evidenceUrl,
      reason,
    };
    const invoke = (body: typeof payload) =>
      withActor(op.actor, (tx) =>
        tx.execute(sql`
      SELECT app_private.kitchen_operator_activate(
        ${f.outlet.id},${JSON.stringify(body)}::jsonb,${crypto.randomUUID()}
      )`)
      );
    await expect(invoke({ ...payload, evidenceUrl: "https://example.invalid" })).rejects.toThrow();
    await expect(invoke(payload)).rejects.toThrow();
    const record = await admin(async (_, pool) =>
      pool.query<{ enabled: boolean }>(
        "SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=$1",
        [f.outlet.id]
      )
    );
    expect(record.rows[0]?.enabled ?? false).toBe(false);
  });

  it("continues to reject a non-superadmin even with a valid station and published dish", async () => {
    const f = await fixture();
    const menuId = crypto.randomUUID();
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: crypto.randomUUID(),
      expectedRevision: 0,
      action: "create",
      data: {
        document: {
          name: "Operator security",
          currency: f.outlet.currency,
          categories: [
            {
              id: "mains",
              name: "Mains",
              items: [{ id: "sole-test-dish", name: "Test Dish", priceMinor: 15000 }],
            },
          ],
        },
      },
    });
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: crypto.randomUUID(),
      expectedRevision: 1,
      action: "publish",
      data: {},
    });
    const station = (await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "station.create",
      data: { name: "Main Kitchen" },
    })) as { stationId: string };
    await kitchenAdmin(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "route.assign",
      data: { dishId: "sole-test-dish", stationId: station.stationId },
    });
    await expect(
      withActor(f.actor, (tx) =>
        tx.execute(sql`
      SELECT app_private.kitchen_operator_activate(
        ${f.outlet.id},
        ${JSON.stringify({ releaseSha, evidenceUrl, reason })}::jsonb,${crypto.randomUUID()}
      )`)
      )
    ).rejects.toThrow();
  });
});
