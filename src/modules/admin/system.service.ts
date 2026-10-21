import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { redisHealth } from "@/lib/redis";
import { env } from "@/lib/config/env";
import { type AdminActor, recordAdminAction } from "@/lib/admin-guard";
import { withActor } from "@/modules/tenancy/service";

export interface SystemHealthReport {
  database: {
    status: "healthy" | "degraded" | "down";
    latencyMs: number;
    poolMax: number;
  };
  redis: {
    queue: boolean;
    cache: boolean;
  };
  outbox: {
    counts: Record<string, number>;
    oldestDue: string | null;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    environment: string;
    emailProvider: string;
    aiFeaturesEnabled: boolean;
    imageGenerationEnabled: boolean;
  };
}

export async function getSystemHealth(actor: AdminActor): Promise<SystemHealthReport> {
  const db = getDb();
  const start = performance.now();
  let dbStatus: "healthy" | "degraded" | "down" = "down";
  let latencyMs = 0;

  try {
    await db.execute(sql`SELECT 1`);
    latencyMs = Math.round(performance.now() - start);
    dbStatus = latencyMs > 500 ? "degraded" : "healthy";
  } catch {
    dbStatus = "down";
  }

  const redis = await redisHealth();

  const outboxCountsRes = await withActor({ userId: actor.id }, (tx) => tx.execute<{ status: string; count: string }>(
    sql`SELECT status, count(*)::text as count FROM outbox_events GROUP BY status`
  }));
  const counts: Record<string, number> = {
    pending: 0,
    dispatched: 0,
    completed: 0,
    failed: 0,
  };
  for (const row of outboxCountsRes.rows) {
    if (row.status) {
      counts[row.status] = parseInt(row.count, 10) || 0;
    }
  }

  const oldestDueRes = await withActor({ userId: actor.id }, (tx) => tx.execute<{ oldest_due: string | null }>(
    sql`SELECT min(next_attempt_at)::text as oldest_due FROM outbox_events WHERE status IN ('pending', 'failed')`
  }));
  const oldestDue = oldestDueRes.rows[0]?.oldest_due || null;

  return {
    database: {
      status: dbStatus,
      latencyMs,
      poolMax: env.DATABASE_POOL_MAX,
    },
    redis: {
      queue: Boolean(redis.queue),
      cache: Boolean(redis.cache),
    },
    outbox: {
      counts,
      oldestDue,
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: env.NODE_ENV,
      emailProvider: env.EMAIL_PROVIDER,
      aiFeaturesEnabled: env.AI_FEATURES_ENABLED,
      imageGenerationEnabled: env.IMAGE_GENERATION_ENABLED,
    },
  };
}

export async function listFailedOutboxEvents(actor: AdminActor, limit = 50) {
  const res = await withActor({ userId: actor.id }, (tx) => tx.execute<{
    id: string;
    organization_id: string;
    outlet_id: string | null;
    type: string;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    payload: unknown;
    created_at: string;
    next_attempt_at: string;
  }>(
    sql`SELECT id, organization_id, outlet_id, type, attempts, max_attempts, last_error, payload, created_at::text, next_attempt_at::text
        FROM outbox_events
        WHERE status = 'failed'
        ORDER BY created_at DESC
        LIMIT ${limit}`
  }));
  return res.rows;
}

export async function retryOutboxEvent(actor: AdminActor, eventId: string) {
  const db = getDb();
  const res = await db.execute<{ id: string }>(
    sql`UPDATE outbox_events
        SET status = 'pending', attempts = 0, last_error = NULL, next_attempt_at = now()
        WHERE id = ${eventId}
        RETURNING id`
  );

  if (res.rows.length === 0) {
    throw new Error(`Outbox event ${eventId} not found`);
  }

  await recordAdminAction(actor, "outbox.retry", "outbox_event", eventId, {
    retriedAt: new Date().toISOString(),
  });

  return { success: true, eventId };
}

export async function listDomainProjections(actor: AdminActor, limit = 30) {
  const res = await withActor({ userId: actor.id }, (tx) => tx.execute<{
    organization_id: string;
    org_name: string;
    version: number;
    updated_at: string;
    snapshot: unknown;
  }>(
    sql`SELECT p.organization_id, coalesce(o.name, 'Unknown') as org_name, p.version, p.updated_at::text, p.snapshot
        FROM domain_projections p
        LEFT JOIN organizations o ON o.id = p.organization_id
        ORDER BY p.updated_at DESC
        LIMIT ${limit}`
  }));
  return res.rows;
}
