import { spawn } from "node:child_process";
import { it, expect } from "vitest";
import { Queue, Worker } from "bullmq";
import { admin, fixture } from "./helpers";
import {
  workerPool,
  verifyWorkerRole,
  claimEvents,
  consumeEvent,
  dispatchOnce,
  redisConnection,
  consumerName,
  type ClaimedEvent,
} from "../src/modules/jobs/worker";
import { retryEvent } from "../src/modules/organizations/service";
const url = process.env["WORKER_DATABASE_URL"]!;
const queueUrl = process.env["REDIS_QUEUE_URL"]!;
const delivery = (e: ClaimedEvent) => ({
  eventId: e.id,
  organizationId: e.organization_id,
  attempt: e.attempts,
  deliverySequence: e.delivery_sequence,
  schemaVersion: 1,
});
async function eventFor(org: string) {
  return admin(
    async (_, p) =>
      (
        await p.query(
          "select id from outbox_events where organization_id=$1 order by aggregate_version desc limit 1",
          [org]
        )
      ).rows[0].id as string
  );
}
async function isolate() {
  await admin(async (_, p) => {
    await p.query(
      "update outbox_events set next_attempt_at=now()+interval '1 day' where status in ('pending','dispatched')"
    );
  });
}
async function due(id: string) {
  await admin(async (_, p) => {
    await p.query(
      "update outbox_events set next_attempt_at=now()-interval '1 second',lease_until=now()-interval '1 second' where id=$1",
      [id]
    );
  });
}
async function state(id: string) {
  return admin(
    async (_, p) => (await p.query("select * from outbox_events where id=$1", [id])).rows[0]
  );
}
async function until(check: () => Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Delivery timed out");
}
it("uses a restricted worker role and exclusive finite leases across concurrent dispatchers", async () => {
  await isolate();
  const { outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const pool = workerPool(url);
  try {
    await verifyWorkerRole(pool);
    await expect(pool.query("select * from users")).rejects.toThrow();
    await expect(pool.query("select * from restaurants")).rejects.toThrow();
    const [a, b] = await Promise.all([claimEvents(pool, 1), claimEvents(pool, 1)]);
    expect([...a, ...b].map((e) => e.id)).toEqual([id]);
    expect((await state(id)).attempts).toBe(1);
    await due(id);
    const reclaimed = (await claimEvents(pool, 1))[0]!;
    expect(reclaimed.id).toBe(id);
    expect(reclaimed.delivery_sequence).toBe(2);
    expect(reclaimed.lease_token).not.toBe([...a, ...b][0]!.lease_token);
  } finally {
    await pool.end();
  }
});
it("rolls back a crash between projection and receipt, deduplicates retries and rejects forged scope", async () => {
  await isolate();
  const { outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const pool = workerPool(url);
  try {
    const e = (await claimEvents(pool, 1))[0]!;
    const data = delivery(e);
    const jobId = `${id}-${e.delivery_sequence}`;
    await expect(
      consumeEvent(pool, { ...data, organizationId: "foreign-org" }, jobId)
    ).rejects.toThrow("scope");
    await expect(
      consumeEvent(pool, data, jobId, async () => {
        throw new Error("Simulated crash");
      })
    ).rejects.toThrow("crash");
    expect(
      (
        await pool.query("select * from domain_projections where organization_id=$1", [
          outlet.organizationId,
        ])
      ).rowCount
    ).toBe(0);
    expect(
      (await pool.query("select * from consumer_receipts where event_id=$1", [id])).rowCount
    ).toBe(0);
    expect(await consumeEvent(pool, data, jobId)).toBe(true);
    expect(await consumeEvent(pool, data, jobId)).toBe(false);
    expect(
      (
        await pool.query("select * from consumer_receipts where event_id=$1 and consumer=$2", [
          id,
          consumerName,
        ])
      ).rowCount
    ).toBe(1);
    expect((await state(id)).status).toBe("completed");
  } finally {
    await pool.end();
  }
});
it("acknowledges validated POS notifications without poisoning the durable queue", async () => {
  const { outlet } = await fixture();
  await isolate();
  const id = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      `insert into outbox_events
       (id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
       values($1,$2,$3,'pos.finance.open_shift',1,1,$4::jsonb)`,
      [
        id,
        outlet.organizationId,
        outlet.id,
        JSON.stringify({ outletId: outlet.id, action: "open_shift" }),
      ]
    );
  });
  const pool = workerPool(url);
  try {
    const event = (await claimEvents(pool, 1))[0]!;
    expect(event.id).toBe(id);
    expect(await consumeEvent(pool, delivery(event), `${id}-${event.delivery_sequence}`)).toBe(
      true
    );
    expect((await state(id)).status).toBe("completed");
    expect(
      (
        await pool.query(
          "select 1 from consumer_receipts where event_id=$1 and consumer='pos-event-v1'",
          [id]
        )
      ).rowCount
    ).toBe(1);
  } finally {
    await pool.end();
  }
});
it("recovers enqueue-before-ack crashes and Redis queue loss from durable state", async () => {
  await isolate();
  const { outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const pool = workerPool(url);
  const queueName = `recovery-${crypto.randomUUID()}`;
  const queue = new Queue(queueName, { connection: redisConnection(queueUrl) });
  let worker: Worker | undefined;
  try {
    await queue.waitUntilReady();
    const e = (await claimEvents(pool, 1))[0]!;
    await queue.add("organization.changed", delivery(e), { jobId: `${id}-${e.delivery_sequence}` }); // process dies before DB acknowledgement
    await queue.obliterate({ force: true }); // isolated queue lost, PostgreSQL retained
    expect((await state(id)).status).toBe("pending");
    await due(id);
    await dispatchOnce(pool, queue);
    expect((await state(id)).status).toBe("dispatched");
    worker = new Worker(queueName, (job) => consumeEvent(pool, job.data, String(job.id)), {
      connection: redisConnection(queueUrl, true),
      concurrency: 1,
    });
    await until(async () => (await state(id)).status === "completed");
    expect(
      (await pool.query("select * from consumer_receipts where event_id=$1", [id])).rowCount
    ).toBe(1);
  } finally {
    await worker?.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await pool.end();
  }
});
it("bounds failures and retries with a fresh delivery ID despite retained failed jobs", async () => {
  await isolate();
  const { actor, outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const pool = workerPool(url);
  const queueName = `retry-${crypto.randomUUID()}`;
  const queue = new Queue(queueName, { connection: redisConnection(queueUrl) });
  let worker: Worker | undefined;
  try {
    await queue.waitUntilReady();
    await admin(async (_, p) => {
      await p.query("update outbox_events set max_attempts=1 where id=$1", [id]);
    });
    worker = new Worker(
      queueName,
      (job) =>
        consumeEvent(pool, job.data, String(job.id), async () => {
          throw new Error("Consumer crash");
        }),
      { connection: redisConnection(queueUrl, true), concurrency: 1 }
    );
    await worker.waitUntilReady();
    await dispatchOnce(pool, queue);
    await until(async () => (await state(id)).status === "failed");
    await until(async () => (await queue.getFailedCount()) === 1);
    await worker.close();
    worker = undefined;
    await retryEvent(actor, outlet.organizationId, id);
    expect((await state(id)).delivery_sequence).toBe(1);
    worker = new Worker(queueName, (job) => consumeEvent(pool, job.data, String(job.id)), {
      connection: redisConnection(queueUrl, true),
      concurrency: 1,
    });
    await dispatchOnce(pool, queue);
    await until(async () => (await state(id)).status === "completed");
    expect((await state(id)).delivery_sequence).toBe(2);
    expect(await queue.getFailedCount()).toBe(1);
  } finally {
    await worker?.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await pool.end();
  }
});
it("does not roll a projection back for out-of-order events and exposes bounded dispatch failure", async () => {
  await isolate();
  const { actor, outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const pool = workerPool(url);
  try {
    await admin(async (_, p) => {
      await p.query("update outbox_events set max_attempts=1 where id=$1", [id]);
    });
    await dispatchOnce(pool, {
      add: async () => {
        throw new Error("Redis unavailable");
      },
    });
    expect((await state(id)).status).toBe("failed");
    expect((await state(id)).last_error).toBe("dispatch_failed");
    await retryEvent(actor, outlet.organizationId, id);
    const e = (await claimEvents(pool, 1))[0]!;
    await pool.query(
      "insert into domain_projections(organization_id,version,snapshot) values($1,999,'{}')",
      [outlet.organizationId]
    );
    await consumeEvent(pool, delivery(e), `${id}-${e.delivery_sequence}`);
    expect(
      (
        await pool.query("select version from domain_projections where organization_id=$1", [
          outlet.organizationId,
        ])
      ).rows[0].version
    ).toBe(999);
  } finally {
    await pool.end();
  }
});

it("runs the production worker bundle and drains on SIGTERM with only worker credentials", async () => {
  await isolate();
  const { outlet } = await fixture();
  const id = await eventFor(outlet.organizationId);
  const child = spawn(process.execPath, ["dist/worker.mjs"], {
    env: {
      PATH: process.env["PATH"],
      NODE_ENV: "production",
      WORKER_DATABASE_URL: url,
      REDIS_QUEUE_URL: queueUrl,
      MEDIA_STORAGE: process.env["MEDIA_STORAGE"],
      MEDIA_ROOT: process.env["MEDIA_ROOT"],
    },
    stdio: "ignore",
  });
  const stopped = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
  try {
    await until(async () => (await state(id)).status === "completed");
    child.kill("SIGTERM");
    expect(
      await Promise.race([
        stopped,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Worker did not drain")), 5000)
        ),
      ])
    ).toBe(0);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await stopped;
  }
}, 20000);
