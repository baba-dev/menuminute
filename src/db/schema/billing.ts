import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { restaurants } from "./restaurants";

// ─── Subscription Plans ───────────────────────────────────────────────────────

export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // "free", "ordering", "kitchen_pro"
  displayName: text("display_name").notNull(),
  // Monthly price in minor units (paise)
  monthlyPricePaise: integer("monthly_price_paise").notNull().default(0),
  features: text("features"), // JSON array of feature keys
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Restaurant Subscriptions ──────────────────────────────────────────────────

export const restaurantSubscriptions = sqliteTable(
  "restaurant_subscriptions",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    status: text("status", {
      enum: ["active", "cancelled", "past_due", "trialing"],
    })
      .notNull()
      .default("active"),
    currentPeriodStart: integer("current_period_start", { mode: "timestamp" }),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("subscriptions_restaurant_idx").on(t.restaurantId)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type RestaurantSubscription = typeof restaurantSubscriptions.$inferSelect;
