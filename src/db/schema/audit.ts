import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_restaurant_idx").on(t.restaurantId),
    index("audit_logs_created_idx").on(t.createdAt),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
