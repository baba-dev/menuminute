import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

// ─── Restaurants ──────────────────────────────────────────────────────────────

export const restaurants = sqliteTable(
  "restaurants",
  {
    id: text("id").primaryKey(), // nanoid
    // Stable opaque public identifier — never changes even if name/slug changes
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(), // URL-friendly, can change (QR uses publicId)
    description: text("description"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    // Address
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country").default("IN"),
    // Branding
    primaryColor: text("primary_color").default("#f97316"), // warm orange
    secondaryColor: text("secondary_color").default("#1c1917"),
    // Currency — ISO 4217 code (INR, USD, etc.)
    currency: text("currency").notNull().default("INR"),
    // Status
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("restaurants_public_id_idx").on(t.publicId),
    uniqueIndex("restaurants_slug_idx").on(t.slug),
  ]
);

// ─── Restaurant Memberships ────────────────────────────────────────────────────

export const restaurantMembers = sqliteTable(
  "restaurant_members",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["owner", "manager", "staff", "kitchen"],
    })
      .notNull()
      .default("staff"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    invitedAt: integer("invited_at", { mode: "timestamp" }),
    joinedAt: integer("joined_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("restaurant_members_unique_idx").on(t.restaurantId, t.userId),
    index("restaurant_members_restaurant_idx").on(t.restaurantId),
    index("restaurant_members_user_idx").on(t.userId),
  ]
);

// ─── Outlets (Physical Locations / Branches) ───────────────────────────────────

export const outlets = sqliteTable(
  "outlets",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    city: text("city"),
    phone: text("phone"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("outlets_restaurant_idx").on(t.restaurantId)]
);

// ─── Restaurant Tables ─────────────────────────────────────────────────────────

export const restaurantTables = sqliteTable(
  "restaurant_tables",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    outletId: text("outlet_id").references(() => outlets.id, {
      onDelete: "set null",
    }),
    tableNumber: text("table_number").notNull(),
    label: text("label"), // "Window Seat", "Rooftop", etc.
    capacity: integer("capacity"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("tables_restaurant_idx").on(t.restaurantId),
    uniqueIndex("tables_number_idx").on(t.restaurantId, t.tableNumber),
  ]
);

// ─── QR Codes ─────────────────────────────────────────────────────────────────

export const qrCodes = sqliteTable(
  "qr_codes",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: text("table_id").references(() => restaurantTables.id, {
      onDelete: "set null",
    }),
    // Purpose: "menu" = public menu view, "order" = table ordering
    purpose: text("purpose", { enum: ["menu", "order"] })
      .notNull()
      .default("menu"),
    label: text("label"), // human-readable label
    // The stable destination URL token — never changes
    destinationToken: text("destination_token").notNull(),
    svgData: text("svg_data"), // cached SVG string
    scanCount: integer("scan_count").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("qr_destination_idx").on(t.destinationToken),
    index("qr_restaurant_idx").on(t.restaurantId),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
export type RestaurantMember = typeof restaurantMembers.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type QrCode = typeof qrCodes.$inferSelect;
