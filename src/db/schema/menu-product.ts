import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
const time = (n: string) => timestamp(n, { withTimezone: true });
export const menus = pgTable(
  "menus",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    revision: integer("revision").notNull().default(1),
    document: jsonb("document").notNull(),
    publishedRevision: integer("published_revision"),
    archived: boolean("archived").notNull().default(false),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("menu_org_id").on(t.organizationId, t.id)]
);
export const menuReleases = pgTable(
  "menu_releases",
  {
    menuId: text("menu_id")
      .notNull()
      .references(() => menus.id),
    revision: integer("revision").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    document: jsonb("document").notNull(),
    publishedBy: text("published_by").notNull(),
    publishedAt: time("published_at").notNull().defaultNow(),
  },
  (t) => [unique("release_revision").on(t.menuId, t.revision)]
);
export const menuAssignments = pgTable(
  "menu_assignments",
  {
    organizationId: text("organization_id").notNull(),
    menuId: text("menu_id").notNull(),
    outletId: text("outlet_id").notNull(),
    brandId: text("brand_id"),
  },
  (t) => [
    unique("menu_outlet_assignment").on(t.menuId, t.outletId),
    foreignKey({
      columns: [t.organizationId, t.menuId],
      foreignColumns: [menus.organizationId, menus.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
  ]
);
export const menuOverrides = pgTable(
  "menu_overrides",
  {
    menuId: text("menu_id")
      .notNull()
      .references(() => menus.id),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    dishId: text("dish_id").notNull(),
    priceMinor: integer("price_minor"),
    soldOut: boolean("sold_out"),
  },
  (t) => [unique("menu_outlet_dish_override").on(t.menuId, t.outletId, t.dishId)]
);
export const dishMedia = pgTable("dish_media", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  outletId: text("outlet_id")
    .notNull()
    .references(() => restaurants.id),
  actorId: text("actor_id").notNull(),
  status: text("status").notNull().default("uploading"),
  sizeBytes: integer("size_bytes").notNull(),
  sourceKey: text("source_key").notNull(),
  derivativeKey: text("derivative_key"),
  thumbnailKey: text("thumbnail_key"),
  width: integer("width"),
  height: integer("height"),
  approvedBy: text("approved_by"),
  approvedAt: time("approved_at"),
  rights: text("rights").notNull(),
  lastError: text("last_error"),
  createdAt: time("created_at").notNull().defaultNow(),
});
