import { it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { fixture, admin } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";
import { manageOrganization } from "../src/modules/organizations/service";
import { ForbiddenError } from "../src/lib/errors";
it("rejects ordinary sessions for ownership transfer and consumes a matching enrolled MFA proof only once", async () => {
  const { actor, outlet } = await fixture();
  const sessionId = crypto.randomUUID();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 day')",
      [sessionId, crypto.randomUUID(), actor.userId]
    );
    await pool.query(
      "insert into auth_step_up(session_id,user_id,expires_at) values($1,$2,now()+interval '5 minutes')",
      [sessionId, actor.userId]
    );
  });
  const current = { userId: actor.userId, sessionId };
  await expect(
    manageOrganization(current, outlet.organizationId, {
      key: crypto.randomUUID(),
      expectedVersion: 1,
      command: { action: "owner.transfer", data: { memberId: "not-a-member" } },
    })
  ).rejects.toBeInstanceOf(ForbiddenError);
  // Synthetic fixture only: native Better Auth is the sole production path that sets the flag.
  await admin(async (_db, pool) => {
    await pool.query("update users set two_factor_enabled=true where id=$1", [actor.userId]);
  });
  const take = () =>
    withActor(current, async (tx) => {
      const result = await tx.execute<{ allowed: boolean }>(
        sql`select app_private.require_step_up() as allowed`
      );
      return result.rows[0]?.allowed;
    });
  expect(await take()).toBe(true);
  expect(await take()).toBe(false);
});
