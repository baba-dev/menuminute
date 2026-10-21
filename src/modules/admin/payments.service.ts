import { getDb } from "@/db";
import {
  subscriptionPlans,
  restaurantSubscriptions,
  entitlementGrants,
  organizations,
  restaurants,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { type AdminActor, recordAdminAction } from "@/lib/admin-guard";
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
  const db = getDb();
  const [updated] = await db
    .update(subscriptionPlans)
    .set(data)
    .where(eq(subscriptionPlans.id, planId))
    .returning();

  if (!updated) throw new NotFoundError("Subscription plan not found");

  await recordAdminAction(actor, "billing.plan.update", "subscription_plan", planId, data);
  return updated;
}

export async function listSubscriptions(
  actor: AdminActor,
  params: { page?: number; limit?: number; status?: string } = {}
) {
  return withActor({ userId: actor.id }, async (db) => {
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
  return withActor({ userId: actor.id }, async (db) => {
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
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    throw new ValidationError("End date must be strictly after start date");
  }

  if (!data.reason?.trim() || data.reason.trim().length < 5) {
    throw new ValidationError("A justification reason (min 5 characters) is required");
  }

  const db = getDb();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, data.organizationId),
  });
  if (!org) throw new NotFoundError("Organization not found");

  const grantId = crypto.randomUUID();
  const requestKey = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // 1. Insert entitlement grant
    await tx.insert(entitlementGrants).values({
      id: grantId,
      organizationId: data.organizationId,
      capability: data.capability,
      billingCurrency: data.billingCurrency,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      operator: actor.email,
      reason: data.reason.trim(),
      requestKey,
    });

    // 2. Increment organization version
    await tx
      .update(organizations)
      .set({ version: sql`version + 1` })
      .where(eq(organizations.id, data.organizationId));
  });

  await recordAdminAction(actor, "entitlement.grant", "entitlement_grant", grantId, {
    organizationId: data.organizationId,
    capability: data.capability,
    billingCurrency: data.billingCurrency,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    reason: data.reason,
  });

  return { id: grantId };
}

export async function revokeEntitlementGrant(actor: AdminActor, grantId: string, reason: string) {
  if (!reason?.trim() || reason.trim().length < 5) {
    throw new ValidationError("A reason of at least 5 characters is required for revocation");
  }

  const db = getDb();
  const grant = await db.query.entitlementGrants.findFirst({
    where: eq(entitlementGrants.id, grantId),
  });

  if (!grant) throw new NotFoundError("Entitlement grant not found");

  await db.transaction(async (tx) => {
    await tx
      .update(entitlementGrants)
      .set({ revokedAt: new Date() })
      .where(eq(entitlementGrants.id, grantId));

    await tx
      .update(organizations)
      .set({ version: sql`version + 1` })
      .where(eq(organizations.id, grant.organizationId));
  });

  await recordAdminAction(actor, "entitlement.revoke", "entitlement_grant", grantId, {
    organizationId: grant.organizationId,
    reason: reason.trim(),
  });

  return { success: true };
}

export async function getFinancialAnalytics(actor: AdminActor) {
  return withActor({ userId: actor.id }, async (db) => {
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
