import { bigint, boolean, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
import { orders, orderItems } from "./orders";
import { users } from "./users";

/** The A-C POS schema deliberately stores draft, pre-tax, non-settleable sale snapshots only. */
export const posOutletSettings = pgTable("pos_outlet_settings", {
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  outletId: text("outlet_id").primaryKey().references(() => restaurants.id),
  enabled: boolean("enabled").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.organizationId,t.outletId], foreignColumns: [restaurants.organizationId,restaurants.id] })]);

export const posSellerProfiles = pgTable("pos_seller_profiles", {
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  outletId: text("outlet_id").primaryKey().references(() => restaurants.id),
  legalName: text("legal_name").notNull(),
  registeredAddress: text("registered_address").notNull(),
  country: text("country").notNull(),
  taxRegime: text("tax_regime").notNull().default("unconfigured"),
  taxRegistration: text("tax_registration"),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [foreignKey({ columns: [t.organizationId,t.outletId], foreignColumns: [restaurants.organizationId,restaurants.id] })]);

export const posSales = pgTable("pos_sales", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  outletId: text("outlet_id").notNull().references(() => restaurants.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  origin: text("origin", { enum: ["staff", "existing_order"] }).notNull(),
  state: text("state", { enum: ["order_submitted", "cancelled"] }).notNull().default("order_submitted"),
  currency: text("currency").notNull(),
  subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
  taxState: text("tax_state", { enum: ["not_calculated"] }).notNull().default("not_calculated"),
  actorId: text("actor_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("pos_sales_outlet_id_unique").on(t.outletId,t.id),
  unique("pos_sales_outlet_order_unique").on(t.outletId,t.orderId),
  foreignKey({ columns: [t.organizationId,t.outletId], foreignColumns: [restaurants.organizationId,restaurants.id] }),
  foreignKey({ columns: [t.outletId,t.orderId], foreignColumns: [orders.restaurantId,orders.id] }),
  index("pos_sales_scope_time").on(t.outletId,t.createdAt,t.id),
]);

export const posSaleLines = pgTable("pos_sale_lines", {
  id: text("id").primaryKey(),
  outletId: text("outlet_id").notNull(),
  saleId: text("sale_id").notNull().references(() => posSales.id),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id),
  nameSnapshot: text("name_snapshot").notNull(),
  variantSnapshot: text("variant_snapshot"),
  optionsSnapshot: jsonb("options_snapshot").notNull().default([]),
  quantity: integer("quantity").notNull(),
  unitMinor: bigint("unit_minor",{mode:"bigint"}).notNull(),
  lineMinor: bigint("line_minor",{mode:"bigint"}).notNull(),
}, (t) => [
  foreignKey({ columns: [t.outletId,t.saleId], foreignColumns: [posSales.outletId,posSales.id] }),
  unique("pos_sale_lines_order_item_unique").on(t.saleId,t.orderItemId),
]);

export const posCommands = pgTable("pos_commands", {
  organizationId: text("organization_id").notNull(),
  outletId: text("outlet_id").notNull(),
  actorId: text("actor_id").notNull().references(() => users.id),
  requestKey: text("request_key").notNull(),
  requestHash: text("request_hash").notNull(),
  action: text("action", { enum: ["submit_order", "attach_order"] }).notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.organizationId,t.outletId], foreignColumns: [restaurants.organizationId,restaurants.id] }),
  unique("pos_commands_request_unique").on(t.organizationId,t.outletId,t.actorId,t.requestKey),
  index("pos_commands_time").on(t.outletId,t.createdAt),
]);
