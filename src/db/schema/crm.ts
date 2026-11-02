import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
import { orders } from "./orders";

export const crmGuests = pgTable("crm_guests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  phoneE164: text("phone_e164").notNull(),
  displayName: text("display_name").notNull().default(""),
  staffNotes: text("staff_notes").notNull().default(""),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", {withTimezone:true}).notNull().default(sql`clock_timestamp()`),
  updatedAt: timestamp("updated_at", {withTimezone:true}).notNull().default(sql`clock_timestamp()`),
}, (t) => [
  unique("crm_guests_organization_id_phone_e164_key").on(t.organizationId,t.phoneE164),
  unique("crm_guests_organization_id_id_key").on(t.organizationId,t.id),
  index("crm_guests_org_recent_idx").on(t.organizationId,t.updatedAt,t.id),
]);
export const crmGuestOrders = pgTable("crm_guest_orders", {
  orderId: text("order_id").primaryKey().references(() => orders.id,{onDelete:"cascade"}),
  organizationId: text("organization_id").notNull(),
  outletId: text("outlet_id").notNull(),
  guestId: text("guest_id").notNull(),
  linkedAt: timestamp("linked_at",{withTimezone:true}).notNull().default(sql`clock_timestamp()`),
}, (t) => [
  foreignKey({columns:[t.organizationId,t.guestId],foreignColumns:[crmGuests.organizationId,crmGuests.id],name:"crm_guest_orders_organization_id_guest_id_fkey"}).onDelete("cascade"),
  foreignKey({columns:[t.organizationId,t.outletId],foreignColumns:[restaurants.organizationId,restaurants.id],name:"crm_guest_orders_organization_id_outlet_id_fkey"}),
  foreignKey({columns:[t.outletId,t.orderId],foreignColumns:[orders.restaurantId,orders.id],name:"crm_guest_orders_outlet_id_order_id_fkey"}),
  index("crm_guest_orders_guest_outlet_idx").on(t.guestId,t.outletId),
]);
