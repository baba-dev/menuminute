import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";
import {
  dispatchOnce,
  workerPool,
  type Enqueuer,
} from "../src/modules/jobs/worker";

const workerUrl = process.env["WORKER_DATABASE_URL"]!;

async function queuedImport() {
  const f = await fixture();
  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const sourceId = crypto.randomUUID();
  await admin(async (_, pool) => {
    // Prevent pre-existing fixture events from becoming due in this dispatch test.
    await pool.query(
      "update outbox_events set next_attempt_at=now()+interval '1 day' where status in ('pending','dispatched')"
    );
    await pool.query(
      `insert into menu_imports(id,organization_id,outlet_id,created_by,request_key,currency,status,revision)
       values($1,$2,$3,$4,$5,$6,'queued',1)`,
      [id, f.outlet.organizationId, f.outlet.id, f.actor.userId, crypto.randomUUID(), f.outlet.currency]
    );
    await pool.query(
      `insert into menu_import_sources(id,import_id,organization_id,outlet_id,page_index,status,
       request_sha256,request_bytes,stored_sha256,stored_bytes,width,height,storage_key)
       values($1,$2,$3,$4,0,'ready',$5,100,$5,100,64,64,$6)`,
      [sourceId,id,f.outlet.organizationId,f.outlet.id,"a".repeat(64),`imports/${f.outlet.organizationId}/${id}/${sourceId}.webp`]
    );
    await pool.query(
      `insert into outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload,max_attempts)
       values($1,$2,$3,'menu_import.process',1,1,$4::jsonb,3)`,
      [eventId,f.outlet.organizationId,f.outlet.id,JSON.stringify({importId:id})]
    );
  });
  return { f, id, eventId, sourceId };
}

describe("AI import execution fencing and isolated dispatch", () => {
  it("does not settle an active import as an ambiguous retry, and fences a truly lost attempt", async () => {
    const { f, id, eventId } = await queuedImport();
    const pool = workerPool(workerUrl);
    const begin = async () => {
      const r = await pool.query<{ result: Record<string, unknown> }>(
        "select app_private.import_engine_begin($1,$2,$3) as result",
        [eventId,f.outlet.organizationId,"test/vision"]
      );
      return r.rows[0]!.result;
    };
    try {
      const first = await begin();
      expect(first.importId).toBe(id);
      expect(first.executionToken).toMatch(/^[0-9a-f-]{36}$/);
      expect(first.sources).toHaveLength(1);
      const repeated = await begin();
      expect(repeated).toMatchObject({ done:true, active:true });
      const renew = await pool.query<{alive:boolean}>(
        "select app_private.import_engine_heartbeat($1,$2,$3) as alive",
        [eventId,f.outlet.organizationId,first.executionToken]
      );
      expect(renew.rows[0]?.alive).toBe(true);
      const wrongFence = await pool.query<{alive:boolean}>(
        "select app_private.import_engine_heartbeat($1,$2,$3) as alive",
        [eventId,f.outlet.organizationId,crypto.randomUUID()]
      );
      expect(wrongFence.rows[0]?.alive).toBe(false);

      const current = await admin(async (_,owner)=>owner.query(
        "select state from menu_import_ai_usage where event_id=$1",[eventId]
      ));
      expect(current.rows[0]?.state).toBe("started");
      await admin(async (_,owner)=>owner.query(
        "update menu_import_ai_usage set heartbeat_at=clock_timestamp()-interval '3 minutes' where event_id=$1",
        [eventId]
      ));
      const crashed = await begin();
      expect(crashed).toMatchObject({ done:true,ambiguous:true });
      expect(await begin()).toMatchObject({done:true});
      const rows = await admin(async (_,owner)=>owner.query(
        `select u.state,u.error_code,i.status as import_status,e.status as event_status
         from menu_import_ai_usage u join menu_imports i on i.id=u.import_id
         join outbox_events e on e.id=u.event_id where u.event_id=$1`,[eventId]
      ));
      expect(rows.rows[0]).toMatchObject({
        state:"unknown",error_code:"ambiguous_delivery",import_status:"failed",event_status:"completed"
      });
      // A stale worker returning afterward may not publish or recreate a candidate.
      const later = await pool.query(
        "select app_private.import_engine_finish($1,$2,$3::jsonb) as result",
        [eventId,f.outlet.organizationId,JSON.stringify({
          executionToken:first.executionToken,ok:true,
          usage:{requests:1,inputTokens:1,outputTokens:1}
        })]
      );
      expect(later.rows[0]?.result.done).toBe(true);
      const candidate = await admin(async (_,owner)=>owner.query(
        "select 1 from menu_import_candidates where import_id=$1",[id]
      ));
      expect(candidate.rowCount).toBe(0);
    } finally {
      await pool.end();
    }
  });

  it("sends AI events to a separate queue and retains a longer durable retry window", async () => {
    const { eventId } = await queuedImport();
    const pool = workerPool(workerUrl);
    const domain: string[] = [];
    const imports: string[] = [];
    const mock = (to: string[]): Enqueuer => ({
      add: async (name, payload) => {
        to.push(name + ":" + String((payload as {eventId:string}).eventId));
      }
    });
    try {
      await dispatchOnce(pool,mock(domain),mock(imports));
      expect(domain).toEqual([]);
      expect(imports).toEqual(["menu_import.process:"+eventId]);
      const row = await admin(async (_,owner)=>owner.query<{
        status:string; seconds_remaining:number
      }>(`select status,extract(epoch from(next_attempt_at-now()))::int as seconds_remaining
        from outbox_events where id=$1`,[eventId]));
      expect(row.rows[0]?.status).toBe("dispatched");
      expect(row.rows[0]?.seconds_remaining).toBeGreaterThan(105);
    } finally {
      await pool.end();
    }
  });
  it("exposes execution lease RPC only to the restricted worker role", async () => {
    const check = await admin(async (_,pool)=>pool.query<{
      worker:boolean;web:boolean
    }>(`select
      has_function_privilege('menuminute_worker','app_private.import_engine_heartbeat(text,text,text)','EXECUTE') as worker,
      has_function_privilege('menuminute_app','app_private.import_engine_heartbeat(text,text,text)','EXECUTE') as web`));
    expect(check.rows[0]).toMatchObject({worker:true,web:false});
  });
});
