import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { restaurants } from "./restaurants";
import { restaurantTables } from "./restaurants";
import { menuItems, menuItemVariants } from "./menus";

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: text("table_id").references(() => restaurantTables.id, {
      onDelete: "set null",
    }),
    // Customer info (no account required)
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    // Status lifecycle
    status: text("status", {
      enum: ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"],
    })
      .notNull()
      .default("pending"),
    // Totals in minor currency units
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),
    notes: text("notes"),
    // Sequence number per restaurant per day (e.g. #42)
    orderNumber: integer("order_number").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("orders_restaurant_idx").on(t.restaurantId),
    index("orders_status_idx").on(t.restaurantId, t.status),
    index("orders_created_idx").on(t.restaurantId, t.createdAt),
  ]
);

// ─── Order Items ──────────────────────────────────────────────────────────────

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    variantId: text("variant_id").references(() => menuItemVariants.id, {
      onDelete: "set null",
    }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    // Snapshot of item at time of order (denormalized for historical accuracy)
    itemName: text("item_name").notNull(),
    variantName: text("variant_name"),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull().default(1),
    totalPaise: integer("total_paise").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_restaurant_idx").on(t.restaurantId),
  ]
);

// ─── Order Status Events ───────────────────────────────────────────────────────

export const orderStatusEvents = sqliteTable(
  "order_status_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    changedBy: text("changed_by"), // userId or "system"
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("status_events_order_idx").on(t.orderId)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
