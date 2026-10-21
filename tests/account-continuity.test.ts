import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixture, admin } from "./helpers";
import { getPool } from "../src/db";
import { accountWorkspacePreferences } from "../src/db/schema";
import { withActor } from "../src/modules/tenancy/service";
import { createRestaurant, getDefaultOrActiveRestaurant } from "../src/modules/restaurants/service";
import { readWorkspacePreference, selectWorkspacePreference } from "../src/modules/organizations/workspace-preferences";
import { describeDevice, listDevices, revokeDeviceSessions } from "../src/lib/device-sessions";

describe("per-account continuity is not authorization", () => {
  it("restores a validated preference across devices and rejects cross-user writes", async () => {
    const first = await fixture();
    const other = await createRestaurant(first.actor.userId, {
      name: "Second Kitchen", country: "IN", currency: "INR", timezone: "Asia/Kolkata",
      outletType: "restaurant",
    });
    const foreign = await fixture();
    await selectWorkspacePreference(first.actor, other.organizationId, other.id);
    const persisted = await readWorkspacePreference(first.actor.userId);
    expect(persisted).toEqual({ organizationId: other.organizationId, outletId: other.id });
    // A different device's legacy outlet cookie cannot override an authorized DB preference.
    expect((await getDefaultOrActiveRestaurant(first.actor.userId, first.outlet.id))?.id).toBe(other.id);
    const isolated = await withActor(foreign.actor, (tx) =>
      tx.select().from(accountWorkspacePreferences)
        .where(eq(accountWorkspacePreferences.userId, first.actor.userId))
    );
    expect(isolated).toEqual([]);
    await expect(selectWorkspacePreference(foreign.actor, other.organizationId, other.id))
      .rejects.toThrow();
    expect(await readWorkspacePreference(foreign.actor.userId)).toBeNull();
    await admin(async (_db,pool) => {
      await pool.query("update organization_members set is_active=false where organization_id=$1 and user_id=$2",
        [other.organizationId, first.actor.userId]);
    });
    // Stale stored ID is never used once membership is revoked.
    expect((await getDefaultOrActiveRestaurant(first.actor.userId, other.id))?.id).toBe(first.outlet.id);
  });
  it("uses same-user organization preference when its last outlet becomes unavailable", async () => {
    const first = await fixture();
    const extra = await createRestaurant(first.actor.userId, {
      name: "Backup Kitchen", country: "IN", currency: "INR", timezone: "Asia/Kolkata",
      outletType: "restaurant",
    });
    await selectWorkspacePreference(first.actor, extra.organizationId, extra.id);
    await admin(async (_db,pool) => {
      await pool.query("update restaurants set is_active=false where id=$1", [extra.id]);
    });
    expect((await getDefaultOrActiveRestaurant(first.actor.userId, extra.id))?.id).toBe(first.outlet.id);
  });
});

describe("revocation is atomic, user-scoped and does not expose tokens", () => {
  it("labels devices, keeps current session, records revocations and denies cross-account targets", async () => {
    const user = await fixture();
    const stranger = await fixture();
    const current = crypto.randomUUID(), previous = crypto.randomUUID(), foreign = crypto.randomUUID();
    await admin(async (_db,pool) => {
      for (const [id, owner, agent] of [
        [current, user.actor.userId, "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/122.0"],
        [previous, user.actor.userId, "Mozilla/5.0 (iPhone; CPU iPhone OS 17) AppleWebKit/605.1.15 Safari/605.1"],
        [foreign, stranger.actor.userId, "Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0"],
      ]) {
        await pool.query(
          "insert into sessions(id,token,user_id,expires_at,user_agent) values($1,$2,$3,now()+interval '30 days',$4)",
          [id, crypto.randomUUID(), owner, agent]
        );
      }
    });
    expect(describeDevice(null).platform).toBe("Unknown device");
    const listed = await listDevices(user.actor.userId,current);
    expect(listed.some(d => d.id === current && d.current)).toBe(true);
    expect(listed.some(d => d.id === previous && d.browser === "Safari")).toBe(true);
    expect(JSON.stringify(listed)).not.toContain("token");
    expect(listed.every(d => d.id !== foreign)).toBe(true);
    await expect(revokeDeviceSessions(user.actor.userId,current,current)).rejects.toThrow();
    await expect(revokeDeviceSessions(user.actor.userId,current,foreign)).rejects.toThrow();
    expect(await revokeDeviceSessions(user.actor.userId,current,previous)).toBe(1);
    expect(await revokeDeviceSessions(user.actor.userId,current,"others")).toBe(0);
    const rows = await getPool().query<{id:string}>(
      "select id from sessions where id=ANY($1::text[]) order by id",
      [[current,previous,foreign]]
    );
    expect(rows.rows.map(r=>r.id)).toEqual([current,foreign].sort());
    const audit = await getPool().query(
      "select 1 from auth_security_events where user_id=$1 and session_id=$2 and kind='session.revoked'",
      [user.actor.userId,previous]
    );
    expect(audit.rowCount).toBe(1);
  });
});
