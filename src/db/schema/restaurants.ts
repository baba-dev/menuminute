import { sql } from "drizzle-orm";
import {
  boolean,
  timestamp,
  integer,
  pgTable,
  text,
  uniqueIndex,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

// ─── Restaurants ──────────────────────────────────────────────────────────────

export const restaurants = pgTable(
  "restaurants",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    fulfillmentModes: text("fulfillment_modes").array().notNull().default(["dine_in"]),
    outletType: text("outlet_type").notNull().default("restaurant"),
    freeMenuEnabled: boolean("free_menu_enabled").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
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
    profileVersion: integer("profile_version").notNull().default(0),
    // Status
    isActive: boolean("is_active").notNull().default(true),
    isDemoData: boolean("is_demo_data").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique("restaurants_org_id_unique").on(t.organizationId, t.id),
    uniqueIndex("restaurants_public_id_idx").on(t.publicId),
    uniqueIndex("restaurants_slug_idx").on(t.slug),
  ]
);

// ─── Restaurant Tables ─────────────────────────────────────────────────────────

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableNumber: text("table_number").notNull(),
    label: text("label"), // "Window Seat", "Rooftop", etc.
    capacity: integer("capacity"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("tables_restaurant_idx").on(t.restaurantId),
    uniqueIndex("tables_number_idx").on(t.restaurantId, t.tableNumber),
  ]
);

// ─── QR Codes ─────────────────────────────────────────────────────────────────

export const qrCodes = pgTable(
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
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("qr_destination_idx").on(t.destinationToken),
    index("qr_restaurant_idx").on(t.restaurantId),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;

export type Outlet = Restaurant;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type QrCode = typeof qrCodes.$inferSelect;
