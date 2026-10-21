import { getDb } from "@/db";
import {
  subscriptionPlans,
  restaurantSubscriptions,
  entitlementGrants,
  organizations,
  restaurants,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { type AdminActor, runAdminCommand } from "@/lib/admin-guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
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
