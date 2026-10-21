import { getDb } from "@/db";
import {
  organizations,
  organizationMembers,
  restaurants,
  brands,
  entitlementGrants,
  users,
} from "@/db/schema";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { type AdminActor, recordAdminAction, DIAGNOSTIC_COOKIE_NAME } from "@/lib/admin-guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { cookies } from "next/headers";
import { withActor } from "@/modules/tenancy/service";

export interface ListOrgsParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export async function listOrganizations(actor: AdminActor, params: ListOrgsParams = {}) {
  return withActor({ userId: actor.id }, async (db) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.search?.trim()) {
    conditions.push(ilike(organizations.name, `%${params.search.trim()}%`));
  }

  if (typeof params.isActive === "boolean") {
    conditions.push(eq(organizations.isActive, params.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizations)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      isActive: organizations.isActive,
      mfaRequired: organizations.mfaRequired,
      version: organizations.version,
      createdAt: organizations.createdAt,
      outletCount: sql<number>`(SELECT count(*)::int FROM restaurants r WHERE r.organization_id = organizations.id)`,
      memberCount: sql<number>`(SELECT count(*)::int FROM organization_members m WHERE m.organization_id = organizations.id AND m.is_active = true)`,
    })
    .from(organizations)
    .where(whereClause)
    .orderBy(desc(organizations.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    organizations: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  });
}

export async function getOrganizationDetails(actor: AdminActor, orgId: string) {
  return withActor({ userId: actor.id }, async (db) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) throw new NotFoundError("Organization not found");

  // Get members with user details
  const members = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      userName: users.name,
      userEmail: users.email,
      role: organizationMembers.role,
      isActive: organizationMembers.isActive,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));

  // Get outlets
  const outlets = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      publicId: restaurants.publicId,
      currency: restaurants.currency,
      timezone: restaurants.timezone,
      outletType: restaurants.outletType,
      fulfillmentModes: restaurants.fulfillmentModes,
      isActive: restaurants.isActive,
      isPublished: restaurants.isPublished,
      createdAt: restaurants.createdAt,
    })
    .from(restaurants)
    .where(eq(restaurants.organizationId, orgId));

  // Get brands
  const brandList = await db
    .select({
      id: brands.id,
      name: brands.name,
    })
    .from(brands)
    .where(eq(brands.organizationId, orgId));

  // Get active entitlements
  const activeGrants = await db
    .select()
    .from(entitlementGrants)
    .where(
      and(
        eq(entitlementGrants.organizationId, orgId),
        sql`ends_at > now()`,
        sql`revoked_at IS NULL`
      )
    );

  return {
    organization: org,
    members,
    outlets,
    brands: brandList,
    entitlements: activeGrants,
  };
  });
}

export async function setOrganizationActive(
  actor: AdminActor,
  orgId: string,
  isActive: boolean,
  reason: string
) {
  if (!reason?.trim() || reason.trim().length < 5) {
    throw new ValidationError("A reason of at least 5 characters is required for status changes");
  }

  const db = getDb();
  const [updated] = await db
    .update(organizations)
    .set({
      isActive,
      version: sql`version + 1`,
    })
    .where(eq(organizations.id, orgId))
    .returning({
      id: organizations.id,
      name: organizations.name,
      isActive: organizations.isActive,
    });

  if (!updated) throw new NotFoundError("Organization not found");

  await recordAdminAction(actor, "organization.active.set", "organization", orgId, {
    isActive,
    reason: reason.trim(),
  });

  return updated;
}

export async function setOrganizationMfaRequired(
  actor: AdminActor,
  orgId: string,
  mfaRequired: boolean
) {
  const db = getDb();
  const [updated] = await db
    .update(organizations)
    .set({
      mfaRequired,
      version: sql`version + 1`,
    })
    .where(eq(organizations.id, orgId))
    .returning({ id: organizations.id, mfaRequired: organizations.mfaRequired });

  if (!updated) throw new NotFoundError("Organization not found");

  await recordAdminAction(actor, "organization.mfa_required.set", "organization", orgId, {
    mfaRequired,
  });

  return updated;
}

export async function enterDiagnosticMode(actor: AdminActor, orgId: string) {
  const org = await withActor({ userId: actor.id }, (tx) =>
    tx.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  );
  if (!org) throw new NotFoundError("Organization not found");

  const cookieStore = await cookies();
  cookieStore.set(DIAGNOSTIC_COOKIE_NAME, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 hours
  });

  await recordAdminAction(actor, "admin.diagnostic.enter", "organization", orgId, {
    orgName: org.name,
  });

  return { success: true, orgId, orgName: org.name };
}

export async function exitDiagnosticMode(actor: AdminActor) {
  const cookieStore = await cookies();
  cookieStore.delete(DIAGNOSTIC_COOKIE_NAME);

  await recordAdminAction(actor, "admin.diagnostic.exit", "diagnostic_session", null);
  return { success: true };
}
