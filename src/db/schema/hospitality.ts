import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { restaurants, restaurantTables } from "./restaurants";
import { users } from "./users";

/**
 * Visual Dining Floor layout for an outlet.
 * Stores canvas bounds, sections, and table positions/shapes.
 */
export const diningFloorPlans = pgTable("dining_floor_plans", {
  outletId: text("outlet_id")
    .primaryKey()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  layout: jsonb("layout")
    .notNull()
    .default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Dining table reservations.
 * Stores guest party size, scheduled arrival time, duration, and table assignment.
 */
export const diningReservations = pgTable(
  "dining_reservations",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: text("table_id").references(() => restaurantTables.id, {
      onDelete: "set null",
    }),
    guestName: text("guest_name").notNull(),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    partySize: integer("party_size").notNull(),
    reservationTime: timestamp("reservation_time", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    status: text("status", {
      enum: ["confirmed", "seated", "completed", "cancelled", "no_show"],
    })
      .notNull()
      .default("confirmed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("dining_res_outlet_time_idx").on(t.outletId, t.reservationTime),
    index("dining_res_table_idx").on(t.tableId),
  ]
);

/** Named areas of the dining room (Main Dining, Patio, Rooftop). */
export const diningSections = pgTable(
  "dining_sections",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#f59e0b"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("dining_sections_outlet_idx").on(t.outletId)]
);

/**
 * A real chair. Capacity is the count of active chairs; occupancy is set by floor staff only
 * through the app_private.floor_* commands (version is the optimistic-concurrency token).
 */
export const restaurantChairs = pgTable(
  "restaurant_chairs",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: text("table_id"),
    label: text("label"),
    kind: text("kind", { enum: ["standard", "high_chair", "bar_stool", "accessible"] })
      .notNull()
      .default("standard"),
    isActive: boolean("is_active").notNull().default(true),
    occupiedAt: timestamp("occupied_at", { withTimezone: true }),
    occupiedBy: text("occupied_by").references(() => users.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("restaurant_chairs_table_idx").on(t.outletId, t.tableId)]
);

export type DiningSectionRow = typeof diningSections.$inferSelect;
export type RestaurantChair = typeof restaurantChairs.$inferSelect;
export type DiningFloorPlan = typeof diningFloorPlans.$inferSelect;
export type DiningReservation = typeof diningReservations.$inferSelect;

/** Optional live table signals for an outlet. Default off; see migration 0089. */
export const floorSignalSettings = pgTable("floor_signal_settings", {
  outletId: text("outlet_id")
    .primaryKey()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  qrScanPings: boolean("qr_scan_pings").notNull().default(true),
  guestWaterButton: boolean("guest_water_button").notNull().default(true),
  showKitchen: boolean("show_kitchen").notNull().default(true),
  showPosBill: boolean("show_pos_bill").notNull().default(true),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/** Append-only ledger of per-table guest-journey events. Producers land in later slices. */
export const tableSignalEvents = pgTable(
  "table_signal_events",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: text("table_id").notNull(),
    kind: text("kind").notNull(),
    source: text("source", { enum: ["guest", "orders", "kitchen", "pos", "staff"] }).notNull(),
    refId: text("ref_id"),
    dedupeKey: text("dedupe_key").notNull(),
    meta: jsonb("meta")
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [index("table_signal_events_recent").on(t.outletId, t.tableId, t.occurredAt)]
);
