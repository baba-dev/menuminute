import { pgTable, text, boolean, timestamp, unique, foreignKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { restaurants } from "./restaurants";
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    unique("org_member_user_unique").on(t.organizationId, t.userId),
    unique("org_member_id_unique").on(t.organizationId, t.id),
  ]
);
export const brands = pgTable(
  "brands",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
  },
  (t) => [unique("brand_org_id_unique").on(t.organizationId, t.id)]
);
export const brandOutlets = pgTable(
  "brand_outlets",
  {
    organizationId: text("organization_id").notNull(),
    brandId: text("brand_id").notNull(),
    outletId: text("outlet_id").notNull(),
  },
  (t) => [
    unique("brand_outlet_unique").on(t.brandId, t.outletId),
    foreignKey({
      columns: [t.organizationId, t.brandId],
      foreignColumns: [brands.organizationId, brands.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
  ]
);
export const outletGrants = pgTable(
  "outlet_grants",
  {
    organizationId: text("organization_id").notNull(),
    memberId: text("member_id").notNull(),
    outletId: text("outlet_id").notNull(),
    roles: text("roles").array().notNull(),
  },
  (t) => [
    unique("outlet_member_unique").on(t.memberId, t.outletId),
    foreignKey({
      columns: [t.organizationId, t.memberId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
  ]
);
