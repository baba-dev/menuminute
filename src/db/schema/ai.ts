import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { restaurants } from "./restaurants";
import { users } from "./users";

// ─── AI Usage Records ─────────────────────────────────────────────────────────

export const aiUsageRecords = sqliteTable(
  "ai_usage_records",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").references(() => restaurants.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Which AI provider was used
    provider: text("provider", {
      enum: ["gemini", "nvidia_nim", "cloudflare_ai"],
    }).notNull(),
    // Which feature triggered this call
    feature: text("feature", {
      enum: ["menu_import", "description_enhance", "translation", "image_search", "image_generate"],
    }).notNull(),
    // Token/credit usage
    tokensUsed: integer("tokens_used"),
    // Success or error
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    errorMessage: text("error_message"),
    // Duration in ms
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("ai_usage_restaurant_idx").on(t.restaurantId),
    index("ai_usage_created_idx").on(t.createdAt),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiUsageRecord = typeof aiUsageRecords.$inferSelect;
export type NewAiUsageRecord = typeof aiUsageRecords.$inferInsert;
