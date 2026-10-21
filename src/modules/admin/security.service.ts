import { getDb } from "@/db";
import { rateLimits, adminAuditLogs } from "@/db/schema";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { type AdminActor, recordAdminAction } from "@/lib/admin-guard";
import { NotFoundError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";

export async function listRateLimits(limit = 100) {
  const db = getDb();
  return db
    .select({
      id: rateLimits.id,
      key: rateLimits.key,
      count: rateLimits.count,
      lastRequest: rateLimits.lastRequest,
    })
    .from(rateLimits)
    .orderBy(desc(rateLimits.lastRequest))
    .limit(limit);
}

export async function clearRateLimitKey(actor: AdminActor, key: string) {
  const db = getDb();
  const deleted = await db
    .delete(rateLimits)
    .where(eq(rateLimits.key, key))
    .returning({ id: rateLimits.id, key: rateLimits.key });

  if (deleted.length === 0) {
    throw new NotFoundError(`Rate limit key ${key} not found`);
  }

  await recordAdminAction(actor, "security.ratelimit.clear", "rate_limit", key, {
    clearedKey: key,
  });

  return { success: true, key };
}

export async function listAdminAuditLogs(
  actor: AdminActor,
  params: {
    page?: number;
    limit?: number;
    action?: string;
    actorEmail?: string;
    targetType?: string;
  } = {}
) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.action) {
    conditions.push(ilike(adminAuditLogs.action, `%${params.action}%`));
  }
  if (params.actorEmail) {
    conditions.push(ilike(adminAuditLogs.actorEmail, `%${params.actorEmail}%`));
  }
  if (params.targetType) {
    conditions.push(eq(adminAuditLogs.targetType, params.targetType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return withActor({ userId: actor.id }, async (tx) => {
    const [countResult] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAuditLogs)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await tx
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}
