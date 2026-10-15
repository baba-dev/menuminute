import { sql } from "drizzle-orm";
import { boolean, timestamp, integer, pgTable, text, index } from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

// ─── Subscription Plans ───────────────────────────────────────────────────────

export const subscriptionPlans = pgTable("subscription_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // "free", "ordering", "kitchen_pro"
  displayName: text("display_name").notNull(),
  // Monthly price in minor units (paise)
  monthlyPricePaise: integer("monthly_price_paise").notNull().default(0),
  features: text("features"), // JSON array of feature keys
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Restaurant Subscriptions ──────────────────────────────────────────────────

export const restaurantSubscriptions = pgTable(
  "restaurant_subscriptions",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    status: text("status", {
      enum: ["active", "cancelled", "past_due", "trialing"],
    })
      .notNull()
      .default("active"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("subscriptions_restaurant_idx").on(t.restaurantId)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type RestaurantSubscription = typeof restaurantSubscriptions.$inferSelect;
