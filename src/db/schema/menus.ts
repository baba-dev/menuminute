import { sql } from "drizzle-orm";
import {
  boolean,
  timestamp,
  integer,
  pgTable,
  text,
  index,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";

// ─── Menu Categories ──────────────────────────────────────────────────────────

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique("category_outlet_unique").on(t.restaurantId, t.id),
    index("categories_restaurant_idx").on(t.restaurantId),
    index("categories_sort_idx").on(t.restaurantId, t.sortOrder),
  ]
);

// ─── Menu Items ───────────────────────────────────────────────────────────────

export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Price in minor units (paise for INR, cents for USD, etc.)
    pricePaise: integer("price_paise").notNull().default(0),
    imageUrl: text("image_url"),
    // Dietary flags
    isVeg: boolean("is_veg"),
    isVegan: boolean("is_vegan"),
    isGlutenFree: boolean("is_gluten_free"),
    // Spice level: 0=none, 1=mild, 2=medium, 3=hot
    spiceLevel: integer("spice_level").default(0),
    // Featured item (shows prominently)
    isFeatured: boolean("is_featured").notNull().default(false),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isDemoData: boolean("is_demo_data").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique("item_outlet_unique").on(t.restaurantId, t.id),
    foreignKey({
      columns: [t.restaurantId, t.categoryId],
      foreignColumns: [menuCategories.restaurantId, menuCategories.id],
    }),
    check("item_price_nonnegative", sql`${t.pricePaise} >= 0`),
    index("items_restaurant_idx").on(t.restaurantId),
    index("items_category_idx").on(t.categoryId),
    index("items_sort_idx").on(t.categoryId, t.sortOrder),
  ]
);

// ─── Menu Item Variants ───────────────────────────────────────────────────────
// e.g. Small / Medium / Large, Half / Full

export const menuItemVariants = pgTable(
  "menu_item_variants",
  {
    id: text("id").primaryKey(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Small", "Large", etc.
    pricePaise: integer("price_paise").notNull(), // price in minor units
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    foreignKey({
      columns: [t.restaurantId, t.menuItemId],
      foreignColumns: [menuItems.restaurantId, menuItems.id],
    }),
    index("variants_item_idx").on(t.menuItemId),
    index("variants_restaurant_idx").on(t.restaurantId),
  ]
);

// ─── Menu Media ───────────────────────────────────────────────────────────────

export const menuMedia = pgTable(
  "menu_media",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItems.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    altText: text("alt_text"),
    // Source: "upload" | "pexels" | "ai_generated" | "library"
    source: text("source", {
      enum: ["upload", "pexels", "ai_generated", "library"],
    })
      .notNull()
      .default("upload"),
    // Attribution for licensed content
    attributionText: text("attribution_text"),
    attributionUrl: text("attribution_url"),
    photographerName: text("photographer_name"),
    externalId: text("external_id"), // Pexels photo ID, etc.
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    mimeType: text("mime_type"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("media_restaurant_idx").on(t.restaurantId),
    index("media_item_idx").on(t.menuItemId),
  ]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuCategory = typeof menuCategories.$inferSelect;
export type NewMenuCategory = typeof menuCategories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type MenuItemVariant = typeof menuItemVariants.$inferSelect;
export type MenuMedia = typeof menuMedia.$inferSelect;
