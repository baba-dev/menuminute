import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
/** Preference only; never a tenant authorization grant. */
export const accountWorkspacePreferences = pgTable("account_workspace_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id"),
  outletId: text("outlet_id"),
  /** Overview widget order/hidden/pinned; presentation only. Validated on every read. */
  dashboardLayout: jsonb("dashboard_layout"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
