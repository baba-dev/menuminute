import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  foreignKey,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
import { menus } from "./menu-product";
import { users } from "./users";
const time = (column: string) => timestamp(column, { withTimezone: true });
export const menuImports = pgTable(
  "menu_imports",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: text("outlet_id").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    requestKey: text("request_key").notNull(),
    targetMenuId: text("target_menu_id"),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("collecting"),
    revision: integer("revision").notNull().default(1),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("import_scope").on(t.id, t.organizationId, t.outletId),
    unique("import_request_unique").on(t.organizationId, t.outletId, t.createdBy, t.requestKey),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.targetMenuId],
      foreignColumns: [menus.organizationId, menus.id],
    }),
    index("import_outlet_recent").on(t.outletId, t.createdAt),
  ]
);
export const menuImportSources = pgTable(
  "menu_import_sources",
  {
    id: text("id").primaryKey(),
    importId: text("import_id").notNull(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    pageIndex: integer("page_index").notNull(),
    status: text("status").notNull().default("reserved"),
    requestSha256: text("request_sha256").notNull(),
    requestBytes: integer("request_bytes").notNull(),
    storedSha256: text("stored_sha256"),
    storedBytes: integer("stored_bytes"),
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storage_key").notNull().unique(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("import_source_page").on(t.importId, t.pageIndex),
    foreignKey({
      columns: [t.importId, t.organizationId, t.outletId],
      foreignColumns: [menuImports.id, menuImports.organizationId, menuImports.outletId],
    }),
    index("import_source_parent_index").on(t.importId, t.pageIndex),
  ]
);
export const menuImportCandidates = pgTable(
  "menu_import_candidates",
  {
    importId: text("import_id").notNull(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    revision: integer("revision").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    document: jsonb("document").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.importId, t.revision] }),
    foreignKey({
      columns: [t.importId, t.organizationId, t.outletId],
      foreignColumns: [menuImports.id, menuImports.organizationId, menuImports.outletId],
    }),
  ]
);
