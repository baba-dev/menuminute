import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { restaurants, restaurantTables } from "./restaurants";

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

export type DiningFloorPlan = typeof diningFloorPlans.$inferSelect;
export type DiningReservation = typeof diningReservations.$inferSelect;
