import { sql } from "drizzle-orm";
import { timestamp, pgTable, text, index, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    // Who performed the action
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    restaurantId: text("restaurant_id"), // no FK — preserve logs even if deleted
    // What happened
    action: text("action").notNull(), // "create", "update", "delete", "login", etc.
    resourceType: text("resource_type"), // "menu_item", "order", etc.
    resourceId: text("resource_id"),
    // Change details
    before: text("before"), // JSON snapshot
    after: text("after"), // JSON snapshot
    // Request context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_restaurant_idx").on(t.restaurantId),
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

// ─── Platform Admin Audit Logs ──────────────────────────────────────────────────

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(), // e.g. "user.sessions.revoke", "entitlement.grant", "org.suspend"
    targetType: text("target_type").notNull(), // "user", "organization", "subscription", "system"
    targetId: text("target_id"),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("admin_audit_actor_idx").on(t.actorId),
    index("admin_audit_action_idx").on(t.action),
    index("admin_audit_created_idx").on(t.createdAt),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
