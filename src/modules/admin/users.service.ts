import { getDb } from "@/db";
import {
  users,
  sessions,
  accounts,
  twoFactors,
  organizationMembers,
  organizations,
} from "@/db/schema";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { type AdminActor, runAdminCommand } from "@/lib/admin-guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  filterVerified?: boolean;
  filter2FA?: boolean;
  filterSuperAdmin?: boolean;
}

export async function listUsers(params: ListUsersParams = {}) {
  const db = getDb();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.search?.trim()) {
    const q = `%${params.search.trim()}%`;
    conditions.push(
      or(ilike(users.name, q), ilike(users.email, q), eq(users.id, params.search.trim()))
    );
  }

  if (typeof params.filterVerified === "boolean") {
    conditions.push(eq(users.emailVerified, params.filterVerified));
  }

  if (typeof params.filter2FA === "boolean") {
    conditions.push(eq(users.twoFactorEnabled, params.filter2FA));
  }

  if (typeof params.filterSuperAdmin === "boolean") {
    conditions.push(eq(users.isSuperAdmin, params.filterSuperAdmin));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      twoFactorEnabled: users.twoFactorEnabled,
      isSuperAdmin: users.isSuperAdmin,
      isDemoData: users.isDemoData,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    users: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUserDetails(actor: AdminActor, userId: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Get active sessions
  const activeSessions = await db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));

  // Get linked accounts (provider list)
  const linkedAccounts = await db
    .select({
      id: accounts.id,
      providerId: accounts.providerId,
      accountId: accounts.accountId,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  // Get organization memberships
  const memberships = await withActor({ userId: actor.id, sessionId: actor.sessionId }, (tx) =>
    tx
      .select({
        membershipId: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        organizationName: organizations.name,
        role: organizationMembers.role,
        isActive: organizationMembers.isActive,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
  );

  // Get two-factor state
  const tf = await db.query.twoFactors.findFirst({
    where: eq(twoFactors.userId, userId),
  });

  return {
    user: {
      ...user,
      isSuperAdmin: user.isSuperAdmin,
    },
    sessions: activeSessions,
    accounts: linkedAccounts,
    memberships,
    twoFactor: tf
      ? {
          verified: tf.verified,
          failedVerificationCount: tf.failedVerificationCount,
          lockedUntil: tf.lockedUntil,
        }
      : null,
  };
}

export async function toggleUserVerification(actor: AdminActor, userId: string, verified: boolean) {
  if (typeof verified !== "boolean") throw new ForbiddenError("Invalid verification state");
  return runAdminCommand(actor, "user.email_verified", userId, { verified });
}

export async function revokeUserSessions(actor: AdminActor, userId: string) {
  return runAdminCommand(actor, "user.sessions.revoke", userId);
}

export async function unlockUserTwoFactor(actor: AdminActor, userId: string) {
  return runAdminCommand(actor, "user.2fa.unlock", userId);
}

export async function setUserSuperAdmin(
  actor: AdminActor,
  targetUserId: string,
  isSuperAdmin: boolean
) {
  if (actor.id === targetUserId && !isSuperAdmin)
    throw new ForbiddenError("Cannot revoke your own superadmin role");
  return runAdminCommand(actor, "user.superadmin", targetUserId, { isSuperAdmin });
}

