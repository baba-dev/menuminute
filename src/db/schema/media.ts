import { sql } from "drizzle-orm";
import { timestamp, integer, pgTable, text, index } from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";
import { users } from "./users";

// ─── Media Assets ──────────────────────────────────────────────────────────────
// Central registry of all media files used in the system

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").references(() => restaurants.id, {
      onDelete: "set null",
    }),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // Storage location
    storageKey: text("storage_key").notNull(), // R2 key or local path
    storageProvider: text("storage_provider", {
      enum: ["local", "r2"],
    })
      .notNull()
      .default("local"),
    publicUrl: text("public_url").notNull(),
    // File metadata
    filename: text("filename").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    // Provenance / attribution
    source: text("source", {
      enum: ["upload", "pexels", "ai_generated", "library"],
    })
      .notNull()
      .default("upload"),
    attributionText: text("attribution_text"),
    attributionUrl: text("attribution_url"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("media_assets_restaurant_idx").on(t.restaurantId),
    index("media_assets_storage_key_idx").on(t.storageKey),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
