import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { withOutlet } from "../src/modules/tenancy/service";

describe("PWA H: restricted PostgreSQL push delivery", () => {
  it("authorizes the current outlet/session and stops delivering after session revocation", async () => {
    const f = await fixture();
    const sessionId = crypto.randomUUID();
    const endpoint = "https://web.push.apple.com/QP/" + crypto.randomUUID();
    const hash = createHash("sha256").update(endpoint).digest("hex");
    await admin(async (_, pool) => {
      await pool.query(
        `insert into sessions(id,token,user_id,expires_at)
         values($1,$2,$3,now()+interval '1 hour')`,
        [sessionId, crypto.randomUUID(), f.actor.userId]
      );
    });
    const actor = { userId: f.actor.userId, sessionId };
    const saved = await withOutlet(actor, f.outlet.id, "orders.read", (tx) =>
      tx.execute<{ id: string }>(
        sql`select app_private.pwa_push_subscribe(
          ${f.outlet.id}, ${endpoint}, ${hash}, true, false
        ) as id`
      )
    );
    expect(saved.rows[0]?.id).toBeTruthy();
    const eventId = crypto.randomUUID();
    await admin(async (_, pool) => {
      const subscriptions = await pool.query<{ user_id: string; session_id: string }>(
        "select user_id,session_id from pwa_push_subscriptions where endpoint_hash=$1",
        [hash]
      );
      expect(subscriptions.rows).toMatchObject([
        { user_id: f.actor.userId, session_id: sessionId },
      ]);
      await pool.query(
        `insert into outbox_events(id,organization_id,outlet_id,type,
         schema_version,aggregate_version,payload)
         values($1,$2,$3,'order.created',1,1,$4::jsonb)`,
        [
          eventId,
          f.outlet.organizationId,
          f.outlet.id,
          JSON.stringify({ orderId: crypto.randomUUID() }),
        ]
      );
      const queued = await pool.query<{ status: string }>(
        "select status from pwa_push_deliveries where event_id=$1",
        [eventId]
      );
      expect(queued.rows).toHaveLength(1);
      expect(queued.rows[0]?.status).toBe("pending");
      const claimed = await pool.query<{ result: { id: string; endpoint: string; lease: string } }>(
        "select app_private.pwa_push_claim($1::text[]) as result",
        [[f.outlet.id]]
      );
      expect(claimed.rows[0]?.result?.endpoint).toBe(endpoint);
      await pool.query("delete from sessions where id=$1", [sessionId]);
      const pending = await pool.query(
        "select 1 from pwa_push_subscriptions where endpoint_hash=$1",
        [hash]
      );
      expect(pending.rowCount).toBe(0);
      const remainingDelivery = await pool.query(
        "select 1 from pwa_push_deliveries where event_id=$1",
        [eventId]
      );
      expect(remainingDelivery.rowCount).toBe(0);
    });
  });

  it("denies another outlet and permits worker-only leasing without table SELECT", async () => {
    const first = await fixture();
    const second = await fixture();
    const actor = { userId: first.actor.userId, sessionId: crypto.randomUUID() };
    await expect(
      withOutlet(actor, second.outlet.id, "orders.read", (tx) =>
        tx.execute(sql`select app_private.pwa_push_list(${second.outlet.id})`)
      )
    ).rejects.toBeTruthy();

    await admin(async (_, pool) => {
      const grants = await pool.query<{
        web_lease: boolean;
        worker_lease: boolean;
        worker_select: boolean;
      }>(
        `select
        has_function_privilege('menuminute_app','app_private.pwa_push_claim(text[])','EXECUTE') as web_lease,
        has_function_privilege('menuminute_worker','app_private.pwa_push_claim(text[])','EXECUTE') as worker_lease,
        has_table_privilege('menuminute_worker','pwa_push_subscriptions','SELECT') as worker_select`
      );
      expect(grants.rows[0]).toEqual({
        web_lease: false,
        worker_lease: true,
        worker_select: false,
      });
    });
  });
});
