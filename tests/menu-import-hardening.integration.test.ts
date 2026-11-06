import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { withActor } from "../src/modules/tenancy/service";
import { admin, fixture } from "./helpers";
import { createImport, cancelImport } from "../src/modules/menu-import/service";

const workerUrl = process.env["WORKER_DATABASE_URL"]!;

async function seedQueued(credits: number) {
  const f = await fixture();
  const id = crypto.randomUUID(),
    eventId = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      "update outbox_events set next_attempt_at=now()+interval '1 day' where status in ('pending','dispatched')"
    );
    await pool.query(
      `insert into menu_imports(id,organization_id,outlet_id,created_by,request_key,currency,status,revision,credits_charged)
       values($1,$2,$3,$4,$5,$6,'queued',1,$7)`,
      [
        id,
        f.outlet.organizationId,
        f.outlet.id,
        f.actor.userId,
        crypto.randomUUID(),
        f.outlet.currency,
        credits,
      ]
    );
    for (let page = 0; page < 3; page++) {
      const sourceId = crypto.randomUUID();
      await pool.query(
        `insert into menu_import_sources(id,import_id,organization_id,outlet_id,page_index,status,
         request_sha256,request_bytes,stored_sha256,stored_bytes,width,height,storage_key)
         values($1,$2,$3,$4,$5,'ready',$6,100,$6,100,64,64,$7)`,
        [
          sourceId,
          id,
          f.outlet.organizationId,
          f.outlet.id,
          page,
          "a".repeat(64),
          `imports/${f.outlet.organizationId}/${id}/${sourceId}.webp`,
        ]
      );
    }
    await pool.query(
      `insert into app_private.ai_credit_usage(organization_id,month,used)
       values($1,(date_trunc('month',now() at time zone 'UTC'))::date,10)
       on conflict (organization_id,month) do update set used=10`,
      [f.outlet.organizationId]
    );
    await pool.query(
      `insert into outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload,max_attempts)
       values($1,$2,$3,'menu_import.process',1,1,$4::jsonb,3)`,
      [eventId, f.outlet.organizationId, f.outlet.id, JSON.stringify({ importId: id })]
    );
  });
  return { f, id, eventId };
}
const used = (org: string) =>
  admin(
    async (_, pool) =>
      (
        await pool.query<{ used: number }>(
          "select used from app_private.ai_credit_usage where organization_id=$1 and month=(date_trunc('month',now() at time zone 'UTC'))::date",
          [org]
        )
      ).rows[0]!.used
  );

it("stops renewing the lease when the import is cancelled and returns credits for unsent pages", async () => {
  const { f, id, eventId } = await seedQueued(3);
  const org = f.outlet.organizationId;
  const pool = new Pool({ connectionString: workerUrl, max: 1 });
  try {
    const begun = (
      await pool.query("select app_private.import_engine_begin($1,$2,$3) as r", [
        eventId,
        org,
        "test/vision",
      ])
    ).rows[0].r;
    const beat = async () =>
      (
        await pool.query("select app_private.import_engine_heartbeat($1,$2,$3) as alive", [
          eventId,
          org,
          begun.executionToken,
        ])
      ).rows[0].alive;
    expect(await beat()).toBe(true);
    await admin((_, p) =>
      p.query("update menu_imports set status='cancelled',revision=revision+1 where id=$1", [id])
    );
    expect(await beat()).toBe(false);
    // One page was sent before the cancel was noticed; the other two are returned.
    await pool.query("select app_private.import_engine_finish($1,$2,$3::jsonb)", [
      eventId,
      org,
      JSON.stringify({
        ok: false,
        error: "provider_unavailable",
        usage: { requests: 1, inputTokens: null, outputTokens: null },
        executionToken: begun.executionToken,
      }),
    ]);
    expect(await used(org)).toBe(8);
    // Releasing is once-only.
    await admin((_, p) => p.query("update menu_imports set credits_charged=0 where id=$1", [id]));
    expect(await used(org)).toBe(8);
  } finally {
    await pool.end();
  }
});

it("returns every credit when an import is cancelled before any page is sent", async () => {
  const { f, id, eventId } = await seedQueued(3);
  const org = f.outlet.organizationId;
  await admin((_, p) => p.query("update menu_imports set status='cancelled' where id=$1", [id]));
  const pool = new Pool({ connectionString: workerUrl, max: 1 });
  try {
    const r = await pool.query("select app_private.import_engine_begin($1,$2,$3) as r", [
      eventId,
      org,
      "test/vision",
    ]);
    expect(r.rows[0].r).toMatchObject({ done: true });
    expect(await used(org)).toBe(7);
    await pool.query("select app_private.import_engine_begin($1,$2,$3)", [eventId, org, "m/v"]);
    expect(await used(org)).toBe(7);
  } finally {
    await pool.end();
  }
});

it("does not count cancelled, failed or applied imports against the retained-source budget", async () => {
  const f = await fixture();
  const made = async () =>
    createImport(f.actor, f.outlet.id, { id: crypto.randomUUID(), key: crypto.randomUUID() });
  const reserve = (importId: string, page: number) =>
    withActor(f.actor, (tx) =>
      tx.execute(
        sql`select app_private.import_source_reserve(${f.outlet.id},${importId},${crypto.randomUUID()},${page},${"a".repeat(64)},${100}) as result`
      )
    );
  const first = await made(),
    second = await made(),
    third = await made();
  for (let page = 0; page < 12; page++) await reserve(first.id, page);
  for (let page = 0; page < 12; page++) await reserve(second.id, page);
  for (let page = 0; page < 6; page++) await reserve(third.id, page);
  // Age the reservations past the hourly limit so only the retained-source budget (30) can refuse.
  await admin((_, p) =>
    p.query(
      "update menu_import_sources set created_at=now()-interval '2 hours' where outlet_id=$1",
      [f.outlet.id]
    )
  );
  const fourth = await made();
  const refused = await reserve(fourth.id, 0).catch((error: Error) => error);
  expect((refused as Error & { cause?: Error }).cause?.message).toMatch(
    /Retained import storage budget/
  );
  // Cancelling a session releases its share of the budget.
  await cancelImport(f.actor, f.outlet.id, first.id, { expectedRevision: first.revision ?? 1 });
  await reserve(fourth.id, 0);
  const remaining = await admin(
    async (_, p) =>
      (
        await p.query<{ n: number }>(
          "select count(*)::int n from menu_import_sources where outlet_id=$1",
          [f.outlet.id]
        )
      ).rows[0]!.n
  );
  expect(remaining).toBe(31); // private bytes and rows are retained; only the budget is released
});
