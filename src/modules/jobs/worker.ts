import { processMedia } from "../media/worker";
import { Pool } from "pg";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { z } from "zod";
const queueData = z
  .object({
    eventId: z.uuid(),
    organizationId: z.string().min(1).max(128),
    deliverySequence: z.number().int().positive(),
    attempt: z.number().int().min(1).max(100),
    schemaVersion: z.literal(1),
  })
  .strict();
const snapshotSchema = z
  .object({
    organizationId: z.string().min(1).max(128),
    name: z.string().min(2).max(100),
    active: z.boolean(),
    version: z.number().int().positive(),
    outletCount: z.number().int().nonnegative(),
    memberCount: z.number().int().nonnegative(),
  })
  .strict();
export const consumerName = "organization-projection-v1";
export function workerPool(url: string) {
  const parsed = new URL(url);
  if (parsed.username !== "menuminute_worker")
    throw new Error("Restricted worker database role required");
  return new Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    lock_timeout: 2000,
  });
}
export async function verifyWorkerRole(pool: Pool) {
  const r = await pool.query<{ unsafe: boolean }>(
    `select (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=current_user)) or has_table_privilege(current_user,'users','SELECT') or has_table_privilege(current_user,'restaurants','SELECT') or has_table_privilege(current_user,'entitlement_grants','UPDATE')) as unsafe from pg_roles where rolname=current_user`
  );
  if (r.rows[0]?.unsafe !== false) throw new Error("Unsafe worker role");
}
export function redisConnection(url: string, worker = false): ConnectionOptions {
  const u = new URL(url);
  if (!["redis:", "rediss:"].includes(u.protocol)) throw new Error("Redis queue URL required");
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    connectTimeout: 3000,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    retryStrategy: (times) => Math.min(times * 250, 3000),
  };
}
export type ClaimedEvent = {
  id: string;
  organization_id: string;
  attempts: number;
  lease_token: string;
  delivery_sequence: number;
  type: string;
};
export async function claimEvents(pool: Pool, limit = 25): Promise<ClaimedEvent[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Invalid batch size");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `with exhausted as(select id from outbox_events where status in ('pending','dispatched') and attempts>=max_attempts and next_attempt_at<=now() and (lease_until is null or lease_until<=now()) for update skip locked limit 50) update outbox_events e set status='failed',last_error='attempts_exhausted',lease_token=null,lease_until=null from exhausted where e.id=exhausted.id`
    );
    const r = await client.query<ClaimedEvent>(
      `with due as(select id from outbox_events where status in ('pending','dispatched') and attempts<max_attempts and next_attempt_at<=now() and (lease_until is null or lease_until<=now()) order by next_attempt_at,id for update skip locked limit $1) update outbox_events e set attempts=e.attempts+1,delivery_sequence=e.delivery_sequence+1,lease_token=gen_random_uuid()::text,lease_until=now()+interval '30 seconds',next_attempt_at=now()+interval '30 seconds' from due where e.id=due.id returning e.id,e.organization_id,e.attempts,e.lease_token,e.delivery_sequence,e.type`,
      [limit]
    );
    await client.query("COMMIT");
    return r.rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export type Enqueuer = {
  add: (
    name: string,
    data: unknown,
    options: { jobId: string; attempts: number; removeOnComplete: number; removeOnFail: number }
  ) => Promise<unknown>;
};
export async function dispatchOnce(pool: Pool, queue: Enqueuer) {
  const events = await claimEvents(pool);
  for (const event of events) {
    try {
      await queue.add(
        event.type,
        {
          eventId: event.id,
          organizationId: event.organization_id,
          attempt: event.attempts,
          deliverySequence: event.delivery_sequence,
          schemaVersion: 1,
        },
        {
          jobId: `${event.id}-${event.delivery_sequence}`,
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      );
      await pool.query(
        `update outbox_events set status='dispatched',lease_token=null,lease_until=null,next_attempt_at=now()+interval '60 seconds',last_error=null where id=$1 and lease_token=$2 and status in ('pending','dispatched')`,
        [event.id, event.lease_token]
      );
    } catch {
      await pool.query(
        `update outbox_events set status=case when attempts>=max_attempts then 'failed' else 'pending' end,lease_token=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>least(300,power(2,least(attempts,8))::int)+random()*3),last_error='dispatch_failed' where id=$1 and lease_token=$2 and status in ('pending','dispatched')`,
        [event.id, event.lease_token]
      );
    }
  }
  return events.length;
}
/** PostgreSQL effect and receipt share one commit. Hooks are dependency injection for crash tests only. */
export async function consumeEvent(
  pool: Pool,
  raw: unknown,
  jobId: string,
  afterEffect?: () => Promise<void>
) {
  const data = queueData.parse(raw);
  if (jobId !== `${data.eventId}-${data.deliverySequence}`)
    throw new Error("Invalid delivery identity");
  const stored = (
    await pool.query(
      "select type,schema_version,delivery_sequence,attempts,max_attempts from outbox_events where id=$1 and organization_id=$2",
      [data.eventId, data.organizationId]
    )
  ).rows[0];
  if (!stored || data.deliverySequence > stored.delivery_sequence)
    throw new Error("Delivery scope mismatch");
  if (stored.type === "media.process" && stored.schema_version === 1) {
    try {
      return await processMedia(pool, data.eventId, data.organizationId);
    } catch (e) {
      await pool.query(
        "update outbox_events set status=case when attempts>=max_attempts then 'failed' else 'pending' end,lease_token=null,lease_until=null,next_attempt_at=now()+interval '5 seconds',last_error='media_processing_failed' where id=$1 and organization_id=$2 and delivery_sequence=$3 and status<>'completed'",
        [data.eventId, data.organizationId, data.deliverySequence]
      );
      if (stored.attempts >= stored.max_attempts)
        await pool.query("select app_private.media_job($1,$2,$3::jsonb)", [
          data.eventId,
          data.organizationId,
          JSON.stringify({ error: "processing_failed" }),
        ]);
      throw e;
    }
  }
  const client = await pool.connect();
  let permanent = false;
  try {
    await client.query("BEGIN");
    const event = (
      await client.query(`select * from outbox_events where id=$1 for update`, [data.eventId])
    ).rows[0];
    if (
      !event ||
      event.organization_id !== data.organizationId ||
      data.deliverySequence > event.delivery_sequence
    )
      throw new Error("Delivery scope mismatch");
    const isOrderEvent = ["order.created", "order.status_changed", "order.payment_changed"].includes(event.type);
    const receiptConsumer = isOrderEvent ? "order-event-v1" : consumerName;
    if (
      (
        await client.query("select 1 from consumer_receipts where event_id=$1 and consumer=$2", [
          event.id,
          receiptConsumer,
        ])
      ).rowCount
    ) {
      await client.query("COMMIT");
      return false;
    }
    if (event.schema_version !== 1) {
      permanent = true;
      throw new Error("Unsupported durable event schema");
    }
    if (isOrderEvent) {
      const payload = z.object({
        orderId: z.string().min(1).max(128),
      }).passthrough().safeParse(event.payload);
      if (!payload.success || event.aggregate_version < 1) {
        permanent = true;
        throw new Error("Invalid ordering event");
      }
      // The durable record is the notification source; the live board reconciles
      // against PostgreSQL. Never acknowledge a forged queue body instead of the row.
    } else {
      if (event.type !== "organization.changed") {
        permanent = true;
        throw new Error("Unsupported durable event");
      }
      const payload = snapshotSchema.safeParse(event.payload);
      if (
        !payload.success ||
        payload.data.organizationId !== event.organization_id ||
        payload.data.version !== event.aggregate_version
      ) {
        permanent = true;
        throw new Error("Invalid durable event");
      }
      await client.query(
        `insert into domain_projections(organization_id,version,snapshot) values($1,$2,$3) on conflict(organization_id) do update set version=excluded.version,snapshot=excluded.snapshot,updated_at=now() where domain_projections.version<excluded.version`,
        [event.organization_id, event.aggregate_version, JSON.stringify(payload.data)]
      );
    }
    if (afterEffect) await afterEffect();
    await client.query(
      "insert into consumer_receipts(event_id,consumer,organization_id) values($1,$2,$3)",
      [event.id, receiptConsumer, event.organization_id]
    );
    await client.query(
      "update outbox_events set status='completed',completed_at=now(),lease_token=null,lease_until=null,last_error=null where id=$1",
      [event.id]
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    // A mismatched/forged queue message cannot modify another scope's event.
    await client.query(
      `update outbox_events set status=case when $4 or attempts>=max_attempts then 'failed' else 'pending' end,lease_token=null,lease_until=null,next_attempt_at=now()+interval '5 seconds',last_error=$5 where id=$1 and organization_id=$2 and delivery_sequence=$3 and status<>'completed'`,
      [
        data.eventId,
        data.organizationId,
        data.deliverySequence,
        permanent,
        permanent ? "invalid_event" : "consumer_failed",
      ]
    );
    throw e;
  } finally {
    client.release();
  }
}
export async function startWorker(
  databaseUrl: string,
  queueUrl: string,
  queueName = "menuminute-domain-v1"
) {
  const pool = workerPool(databaseUrl);
  await verifyWorkerRole(pool);
  const producer = new Queue(queueName, { connection: redisConnection(queueUrl) });
  const worker = new Worker(queueName, (job) => consumeEvent(pool, job.data, String(job.id)), {
    connection: redisConnection(queueUrl, true),
    concurrency: 2,
    maxStalledCount: 2,
  });
  // Do not log payloads, URLs, provider errors or session data.
  worker.on("error", () => console.error("Queue worker connection error"));
  worker.on("failed", () => console.error("Queue delivery failed; durable state retained"));
  producer.on("error", () => console.error("Queue producer connection error"));
  let stopping = false;
  let pending: Promise<unknown> | undefined;
  const tick = () => {
    if (stopping || pending) return;
    pending = pool
      .query("select app_private.reconcile_media_uploads()")
      .then(() => pool.query("select app_private.expire_pending_orders()"))
      .then(() => dispatchOnce(pool, producer))
      .catch(() => console.error("Durable dispatcher unavailable"))
      .finally(() => {
        pending = undefined;
      });
  };
  const timer = setInterval(tick, 1000);
  tick();
  return {
    pool,
    worker,
    producer,
    async close() {
      stopping = true;
      clearInterval(timer);
      await pending;
      await worker.close();
      await producer.close();
      await pool.end();
    },
  };
}
