import { getDb } from "@/db";
import {
  subscriptionPlans,
  restaurantSubscriptions,
  entitlementGrants,
  organizations,
  restaurants,
} from "@/db/schema";
import { eq, desc, and, or, sql, asc } from "drizzle-orm";
import { type AdminActor, runAdminCommand } from "@/lib/admin-guard";
import { ValidationError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";

export async function listSubscriptionPlans() {
  const db = getDb();
  return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
}

export async function updateSubscriptionPlan(
  actor: AdminActor,
  planId: string,
  data: {
    displayName?: string;
    monthlyPricePaise?: number;
    features?: string;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  if (!planId || !data || Object.keys(data).length === 0)
    throw new ValidationError("A plan change is required");
  if (
    data.monthlyPricePaise !== undefined &&
    (!Number.isSafeInteger(data.monthlyPricePaise) ||
      data.monthlyPricePaise < 0 ||
      data.monthlyPricePaise > 999999999)
  )
    throw new ValidationError("Invalid price in minor units");
  if (
    data.sortOrder !== undefined &&
    (!Number.isSafeInteger(data.sortOrder) || data.sortOrder < 0 || data.sortOrder > 999999)
  )
    throw new ValidationError("Invalid sort order");
  return runAdminCommand(actor, "billing.plan.update", planId, data);
}

export async function listSubscriptions(
  actor: AdminActor,
  params: { page?: number; limit?: number; status?: string } = {}
) {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (db) => {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (params.status) {
      conditions.push(eq(restaurantSubscriptions.status, params.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(restaurantSubscriptions)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await db
      .select({
        id: restaurantSubscriptions.id,
        restaurantId: restaurantSubscriptions.restaurantId,
        restaurantName: restaurants.name,
        organizationId: restaurants.organizationId,
        planId: restaurantSubscriptions.planId,
        planName: subscriptionPlans.displayName,
        status: restaurantSubscriptions.status,
        currentPeriodStart: restaurantSubscriptions.currentPeriodStart,
        currentPeriodEnd: restaurantSubscriptions.currentPeriodEnd,
        cancelledAt: restaurantSubscriptions.cancelledAt,
        createdAt: restaurantSubscriptions.createdAt,
      })
      .from(restaurantSubscriptions)
      .innerJoin(restaurants, eq(restaurants.id, restaurantSubscriptions.restaurantId))
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, restaurantSubscriptions.planId))
      .where(whereClause)
      .orderBy(desc(restaurantSubscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      subscriptions: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function listEntitlementGrants(
  actor: AdminActor,
  params: {
    page?: number;
    limit?: number;
    organizationId?: string;
    activeOnly?: boolean;
  } = {}
) {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (db) => {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (params.organizationId) {
      conditions.push(eq(entitlementGrants.organizationId, params.organizationId));
    }
    if (params.activeOnly) {
      conditions.push(sql`ends_at > now()`);
      conditions.push(sql`revoked_at IS NULL`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(entitlementGrants)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await db
      .select({
        id: entitlementGrants.id,
        organizationId: entitlementGrants.organizationId,
        organizationName: organizations.name,
        capability: entitlementGrants.capability,
        billingCurrency: entitlementGrants.billingCurrency,
        startsAt: entitlementGrants.startsAt,
        endsAt: entitlementGrants.endsAt,
        revokedAt: entitlementGrants.revokedAt,
        operator: entitlementGrants.operator,
        reason: entitlementGrants.reason,
        createdAt: entitlementGrants.createdAt,
      })
      .from(entitlementGrants)
      .innerJoin(organizations, eq(organizations.id, entitlementGrants.organizationId))
      .where(whereClause)
      .orderBy(desc(entitlementGrants.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      grants: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function issueEntitlementGrant(
  actor: AdminActor,
  data: {
    organizationId: string;
    capability: "ordering.new" | "kitchen.new";
    billingCurrency: "USD" | "INR";
    startsAt: string;
    endsAt: string;
    reason: string;
  }
) {
  const start = new Date(data.startsAt);
  const end = new Date(data.endsAt);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start ||
    end.getTime() <= Date.now()
  ) {
    throw new ValidationError("A valid future UTC entitlement window is required");
  }
  if (!data.reason?.trim() || data.reason.trim().length < 5 || data.reason.length > 500)
    throw new ValidationError("A justification of 5–500 characters is required");
  if (data.capability !== "ordering.new" && data.capability !== "kitchen.new")
    throw new ValidationError("Invalid capability");
  if (data.billingCurrency !== "USD" && data.billingCurrency !== "INR")
    throw new ValidationError("Invalid billing currency");
  return runAdminCommand(actor, "entitlement.grant", data.organizationId, {
    ...data,
    reason: data.reason.trim(),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  });
}

export async function revokeEntitlementGrant(actor: AdminActor, grantId: string, reason: string) {
  if (!reason?.trim() || reason.trim().length < 5 || reason.length > 500)
    throw new ValidationError("A revocation justification of 5–500 characters is required");
  return runAdminCommand(actor, "entitlement.revoke", grantId, { reason: reason.trim() });
}

/** Search is scoped to live superadmin sessions; it never exposes customer credentials. */
export async function searchGrantTargets(actor: AdminActor, search: string) {
  const term = search.trim().slice(0, 80);
  if (term.length < 2) return [];
  const pattern = "%" + term.replace(/[\\%_]/g, (char) => "\\" + char) + "%";
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (db) => {
    const rows = await db
      .select({
        id: organizations.id,
        organizationName: organizations.name,
        active: organizations.isActive,
        outletName: restaurants.name,
      })
      .from(organizations)
      .leftJoin(restaurants, eq(restaurants.organizationId, organizations.id))
      .where(
        or(
          sql`${organizations.name} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${restaurants.name} ILIKE ${pattern} ESCAPE '\\'`
        )
      )
      .orderBy(asc(organizations.name), asc(restaurants.name))
      .limit(80);
    const byOrg = new Map<
      string,
      { id: string; name: string; active: boolean; outlets: string[] }
    >();
    for (const row of rows) {
      const item = byOrg.get(row.id) ?? {
        id: row.id,
        name: row.organizationName,
        active: row.active,
        outlets: [],
      };
      if (row.outletName && item.outlets.length < 4 && !item.outlets.includes(row.outletName))
        item.outlets.push(row.outletName);
      byOrg.set(row.id, item);
    }
    return [...byOrg.values()].slice(0, 12);
  });
}

/** Extension is a scheduled, audited successor grant, not a mutation of historical billing. */
export async function extendEntitlementGrant(
  actor: AdminActor,
  data: { grantId: string; expectedEndsAt: string; newEndsAt: string; reason: string }
) {
  if (!data.grantId || data.grantId.length > 128) throw new ValidationError("Invalid grant");
  const nextEnd = new Date(data.newEndsAt);
  if (
    !Number.isFinite(nextEnd.getTime()) ||
    !data.reason?.trim() ||
    data.reason.trim().length < 5 ||
    data.reason.length > 420
  )
    throw new ValidationError("Choose a valid renewal date and a reason of 5–420 characters");
  const existing = await withActor({ userId: actor.id, sessionId: actor.sessionId }, async (db) => {
    return (
      await db
        .select()
        .from(entitlementGrants)
        .where(eq(entitlementGrants.id, data.grantId))
        .limit(1)
    )[0];
  });
  if (!existing || existing.revokedAt || existing.endsAt.getTime() <= Date.now())
    throw new ValidationError("Only current or scheduled grants can be renewed");
  if (existing.endsAt.toISOString() !== data.expectedEndsAt)
    throw new ValidationError("The grant has changed. Refresh before scheduling a renewal");
  if (existing.capability !== "ordering.new")
    throw new ValidationError("Kitchen Pro activation is still blocked");
  if (nextEnd.getTime() <= existing.endsAt.getTime())
    throw new ValidationError("Renewal must end after the existing grant");
  return issueEntitlementGrant(actor, {
    organizationId: existing.organizationId,
    capability: "ordering.new",
    billingCurrency: existing.billingCurrency as "USD" | "INR",
    startsAt: existing.endsAt.toISOString(),
    endsAt: nextEnd.toISOString(),
    reason: `Renewal of ${existing.id}: ${data.reason.trim()}`,
  });
}

export async function getFinancialAnalytics(actor: AdminActor) {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (db) => {
    // Aggregate orders GMV strictly grouped by currency
    const currencyTotals = await db.execute<{
      currency: string;
      order_count: string;
      total_minor: string;
    }>(
      sql`SELECT currency, count(*)::text as order_count, coalesce(sum(total_minor), 0)::text as total_minor
        FROM orders
        GROUP BY currency
        ORDER BY count(*) DESC`
    );

    // Subscriptions count by plan
    const planCounts = await db.execute<{
      plan_name: string;
      count: string;
    }>(
      sql`SELECT p.display_name as plan_name, count(s.id)::text as count
        FROM subscription_plans p
        LEFT JOIN restaurant_subscriptions s ON s.plan_id = p.id AND s.status = 'active'
        GROUP BY p.display_name, p.sort_order
        ORDER BY p.sort_order`
    );

    return {
      byCurrency: currencyTotals.rows.map((r) => ({
        currency: r.currency,
        orderCount: parseInt(r.order_count, 10) || 0,
        totalMinor: parseInt(r.total_minor, 10) || 0,
      })),
      planSubscriptions: planCounts.rows.map((r) => ({
        planName: r.plan_name,
        count: parseInt(r.count, 10) || 0,
      })),
    };
  });
}
