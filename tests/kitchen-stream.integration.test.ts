import { describe, it, expect } from "vitest";
import { fixture, admin } from "./helpers";
import { kitchenChanges } from "../src/modules/kitchen/service";
import { getPool } from "../src/db";

describe("kitchen cursor paging, read authorization and bounded retention", () => {
  it("does not skip a 100-event page and explicitly resyncs pruned event history", async () => {
    const f = await fixture();
    const { firstSeq, lastSeq } = await admin(async (_, pool) => {
      const s = await pool.query<{ last_seq: string }>(
        `insert into kitchen_event_counters(outlet_id,last_seq) values($1,125)
         on conflict(outlet_id) do update
           set last_seq=kitchen_event_counters.last_seq+125
         returning last_seq::text`,
        [f.outlet.id]
      );
      const lastSeq = Number(s.rows[0]!.last_seq);
      const firstSeq = lastSeq - 124;
      await pool.query(
        `insert into kitchen_events(outlet_id,seq,event_id,kind)
         select $1,generate_series($2::bigint,$3::bigint),gen_random_uuid()::text,
         'station.changed'`,
        [f.outlet.id, firstSeq, lastSeq]
      );
      return { firstSeq, lastSeq };
    });
    const read = (cursor: number) =>
      kitchenChanges(f.actor, f.outlet.organizationId, f.outlet.id, cursor);
    const page1 = await read(firstSeq - 1);
    expect(page1.events).toHaveLength(100);
    expect(page1.cursor).toBe(firstSeq + 99);
    expect(page1.resync).toBe(false);
    const page2 = await read(page1.cursor);
    expect(page2.events).toHaveLength(25);
    expect(page2.events[0]?.seq).toBe(firstSeq + 100);
    expect(page2.cursor).toBe(lastSeq);
    await admin(async (_, pool) => {
      await pool.query("delete from kitchen_events where outlet_id=$1", [f.outlet.id]);
    });
    const pruned = await read(firstSeq);
    expect(pruned.events).toHaveLength(0);
    expect(pruned.resync).toBe(true);
    expect(pruned.cursor).toBe(lastSeq);
    const recovered = await read(lastSeq);
    expect(recovered.resync).toBe(false);
    expect(recovered.events).toHaveLength(0);
  });

  it("cannot call the maintenance function through web role but grants only EXECUTE to worker", async () => {
    const web = await getPool().query<{ allowed: boolean }>(
      "select has_function_privilege('menuminute_app','app_private.kitchen_prune_events()','EXECUTE') as allowed"
    );
    expect(web.rows[0]?.allowed).toBe(false);
    const worker = await admin(async (_, pool) =>
      pool.query<{ allowed: boolean }>(
        "select has_function_privilege('menuminute_worker','app_private.kitchen_prune_events()','EXECUTE') as allowed"
      )
    );
    expect(worker.rows[0]?.allowed).toBe(true);
  });
});
