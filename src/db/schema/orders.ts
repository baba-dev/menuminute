import { sql } from "drizzle-orm";
import {
  timestamp,
  integer,
  pgTable,
  text,
  index,
  uniqueIndex,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import { restaurants, restaurantTables } from "./restaurants";

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    tableId: text("table_id").references(() => restaurantTables.id, {
      onDelete: "set null",
    }),
    // Customer info (no account required)
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    fulfillmentMode: text("fulfillment_mode").notNull().default("dine_in"), // "dine_in" | "pickup"
    requestedFulfillmentAt: timestamp("requested_fulfillment_at", { withTimezone: true }),

    // Canonical Status lifecycle: pending -> accepted -> preparing -> ready -> served/collected
    status: text("status", {
      enum: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "served",
        "collected",
        "rejected",
        "cancelled",
        "expired",
        // Historical values kept for backwards compatibility:
        "confirmed",
        "delivered",
      ],
    })
      .notNull()
      .default("pending"),

    // Payment state is decoupled from fulfillment state
    paymentStatus: text("payment_status", {
      enum: ["unpaid", "paid", "voided"],
    })
      .notNull()
      .default("unpaid"),

    // Currency & integer minor unit money (e.g. INR in paise, USD in cents, OMR in baisa)
    currency: text("currency").notNull().default("INR"),
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),

    // Historical legacy columns preserved for backward compatibility
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),

    notes: text("notes"),
    rejectionReason: text("rejection_reason"),

    // Scoped client idempotency key & opaque guest tracking capability
    clientSubmissionKey: text("client_submission_key"),
    requestHash: text("request_hash"),
    businessDate: date("business_date"),
    trackingToken: text("tracking_token"),

    // Closing instant deadline for automatic expiry of unaccepted pending orders
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Sequence number per restaurant per day (e.g. #42)
    orderNumber: integer("order_number").notNull(),
    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("orders_restaurant_idx").on(t.restaurantId),
    index("orders_status_idx").on(t.restaurantId, t.status),
    index("orders_created_idx").on(t.restaurantId, t.createdAt),
    uniqueIndex("orders_submission_key_idx").on(t.restaurantId, t.clientSubmissionKey),
    uniqueIndex("orders_tracking_token_idx").on(t.trackingToken),
  ]
);

// ─── Order Items ──────────────────────────────────────────────────────────────

export type SelectedOptionSnapshot = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceMinor: number;
};

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    // Target dish ID from canonical menu document
    dishId: text("dish_id").notNull(),
    menuItemId: text("menu_item_id"), // legacy optional reference
    variantId: text("variant_id"),

    // Snapshot of item at time of order (immutable historical snapshot)
    itemName: text("item_name").notNull(),
    variantName: text("variant_name"),
    selectedOptions: jsonb("selected_options")
      .$type<SelectedOptionSnapshot[]>()
      .notNull()
      .default([]),

    unitPriceMinor: integer("unit_price_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),

    // Legacy fields preserved for compatibility
    unitPricePaise: integer("unit_price_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull().default(0),

    quantity: integer("quantity").notNull().default(1),
    notes: text("notes"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_restaurant_idx").on(t.restaurantId),
  ]
);

// ─── Order Status Events ───────────────────────────────────────────────────────

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    status: text("status").notNull(), // alias to toStatus for backwards compatibility
    note: text("note"),
    actorType: text("actor_type", {
      enum: ["guest", "staff", "system"],
    })
      .notNull()
      .default("system"),
    actorId: text("actor_id"),
    changedBy: text("changed_by"), // legacy alias
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("status_events_order_idx").on(t.orderId)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
