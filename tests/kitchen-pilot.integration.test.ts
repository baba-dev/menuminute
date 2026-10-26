import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { fixture, admin } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";
import {
  findKitchenPilotTargets,
  kitchenPilotFailureMessage,
  pilotCommandSchema,
} from "../src/modules/kitchen/activation";

const sha = "a".repeat(40);
const evidenceUrl = "https://github.com/baba-dev/menuminute/issues/76";
const reason = "Independent evidence review for isolated pilot";
const command = (outletId: string, action: string) => ({
  outletId,
  action,
  releaseSha: sha,
  evidenceUrl,
  reason,
  key: crypto.randomUUID(),
});

describe("Kitchen pilot command contracts", () => {
  it("validates outlet ids, review evidence, exact release identity and one-use keys", () => {
    expect(pilotCommandSchema.safeParse(command("valid-outlet", "request")).success).toBe(true);
    expect(
      pilotCommandSchema.safeParse({
        ...command("a", "request"),
        evidenceUrl: "https://attacker.invalid",
      }).success
    ).toBe(false);
    expect(
      pilotCommandSchema.safeParse({ ...command("a", "approve"), releaseSha: "partial" }).success
    ).toBe(false);
    expect(pilotCommandSchema.safeParse({ ...command("../other", "drain") }).success).toBe(false);
    expect(
      pilotCommandSchema.safeParse({ ...command("a", "activate"), key: "not-uuid" }).success
    ).toBe(false);
    expect(pilotCommandSchema.safeParse({ ...command("a", "finalize"), reason: "x" }).success).toBe(
      false
    );
  });
  it("maps database failures without exposing internal SQL or credentials", () => {
    expect(kitchenPilotFailureMessage(new Error("random SQL SELECT hidden"))).not.toContain(
      "SELECT"
    );
    expect(
      kitchenPilotFailureMessage(
        new Error("Separate operator must review exact requested evidence and SHA")
      )
    ).toContain("second superadmin");
  });
});

describe("Kitchen pilot PostgreSQL authorization", () => {
  it("defaults disabled and denies all pilot reads/writes to ordinary outlet owners", async () => {
    const f = await fixture();
    const settings = await admin(async (_, pool) =>
      pool.query<{ enabled: boolean }>(
        "select enabled from kitchen_outlet_settings where outlet_id=$1",
        [f.outlet.id]
      )
    );
    expect(settings.rows[0]?.enabled ?? false).toBe(false);
    await expect(
      withActor(f.actor, (tx) =>
        tx.execute(sql`select app_private.kitchen_pilot_status(${f.outlet.id})`)
      )
    ).rejects.toThrow();
    await expect(
      withActor(f.actor, (tx) =>
        tx.execute(sql`select app_private.kitchen_pilot_command(
        ${f.outlet.id}, 'request', ${JSON.stringify(command(f.outlet.id, "request"))}::jsonb, ${crypto.randomUUID()})`)
      )
    ).rejects.toThrow();
    const privileges = await admin(async (_, pool) =>
      pool.query<{ can_write: boolean }>(
        "select has_table_privilege('menuminute_app','kitchen_pilot_outlets','UPDATE') as can_write"
      )
    );
    expect(privileges.rows[0]?.can_write).toBe(false);
  });

  it("requires two different verified superadmins, consumes MFA and denies activation without readiness", async () => {
    const f = await fixture();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const sessions = [crypto.randomUUID(), crypto.randomUUID()];
    await admin(async (_, pool) => {
      for (let i = 0; i < 2; i++) {
        await pool.query(
          "insert into users(id,name,email,email_verified,two_factor_enabled,is_super_admin) values($1,$2,$3,true,true,true)",
          [ids[i], "Isolated reviewer " + i, ids[i] + "@review.invalid"]
        );
        await pool.query(
          "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
          [sessions[i], crypto.randomUUID(), ids[i]]
        );
      }
    });
    const actor = (index: number) => ({ userId: ids[index]!, sessionId: sessions[index]! });
    const stepUp = async (index: number) =>
      admin(async (_, pool) => {
        await pool.query(
          "insert into auth_step_up(session_id,user_id,expires_at) values($1,$2,now()+interval '5 minutes') on conflict(session_id) do update set expires_at=excluded.expires_at",
          [sessions[index], ids[index]]
        );
      });
    const execute = (index: number, action: string, key: string = crypto.randomUUID()) =>
      withActor(actor(index), (tx) =>
        tx.execute<{ data: { state: string; revision: number } }>(
          sql`select app_private.kitchen_pilot_command(
          ${f.outlet.id},${action},
          ${JSON.stringify({ releaseSha: sha, evidenceUrl, reason })}::jsonb,
          ${key}) as data`
        )
      );
    await expect(execute(0, "request")).rejects.toThrow();
    await stepUp(0);
    const key = crypto.randomUUID();
    const requested = await execute(0, "request", key);
    expect(requested.rows[0]?.data.state).toBe("requested");
    expect((await execute(0, "request", key)).rows[0]?.data.state).toBe("requested");
    await stepUp(0);
    await expect(execute(0, "approve")).rejects.toThrow();
    await stepUp(1);
    const approved = await execute(1, "approve");
    expect(approved.rows[0]?.data.state).toBe("approved");
    await stepUp(0);
    await expect(execute(0, "activate")).rejects.toThrow();
    const stillDisabled = await admin(async (_, pool) =>
      pool.query<{ enabled: boolean }>(
        "select enabled from kitchen_outlet_settings where outlet_id=$1",
        [f.outlet.id]
      )
    );
    expect(stillDisabled.rows[0]?.enabled ?? false).toBe(false);
  });
});

// Search names are free-form, but the query must treat SQL wildcard characters literally.
it("searches scoped outlet names with literal wildcard characters", async () => {
  const f = await fixture();
  const uid = crypto.randomUUID();
  const session = crypto.randomUUID();
  const needle = "pilot_%_" + crypto.randomUUID().slice(0, 8);
  await admin(async (_, pool) => {
    await pool.query(
      "update restaurants set name=$1 where id=$2",
      [needle, f.outlet.id]
    );
    await pool.query(
      "insert into users(id,name,email,email_verified,two_factor_enabled,is_super_admin) values($1,'Reviewer',$2,true,true,true)",
      [uid, uid + "@pilot.invalid"]
    );
    await pool.query(
      "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
      [session, crypto.randomUUID(), uid]
    );
  });
  const matches = await findKitchenPilotTargets(
    { id: uid, name: "Reviewer", email: uid + "@pilot.invalid", twoFactorEnabled: true, sessionId: session },
    needle
  );
  expect(matches.some((item) => item.id === f.outlet.id && item.name === needle)).toBe(true);
});
