// Tiffin & Home-Chef Hub phase 1 foundation tables (migration 0114, ADR 032).
// Direct access is revoked from the app and worker roles; RLS is enabled. Names, types and
// constraints mirror src/db/migrations/0114_tiffin_foundation.sql exactly.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);
const organizationId = () => text("organization_id").notNull();
// Named explicitly so the Drizzle name equals the PostgreSQL default used by the migration.
const organizationFk = (table: string, column: AnyPgColumn) =>
  foreignKey({
    columns: [column],
    foreignColumns: [organizations.id],
    name: `${table}_organization_id_fkey`,
  });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`clock_timestamp()`);
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`clock_timestamp()`);
// Bounded to 0..2147483647 by CHECK, so number mode is exact.
const priceMinor = () => bigint("price_minor", { mode: "number" }).notNull();

export const tiffinSlots = pgTable(
  "tiffin_slots",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    kind: text("kind").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    cutoffMinutesBefore: integer("cutoff_minutes_before").notNull(),
    capacity: integer("capacity"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_slots", t.organizationId),
    check("tiffin_slots_kind_check", sql`${t.kind} IN ('lunch','dinner')`),
    check("tiffin_slots_start_minute_check", sql`${t.startMinute} BETWEEN 0 AND 1439`),
    check("tiffin_slots_end_minute_check", sql`${t.endMinute} BETWEEN 1 AND 1440`),
    check("tiffin_slots_cutoff_check", sql`${t.cutoffMinutesBefore} BETWEEN 0 AND 10080`),
    check("tiffin_slots_capacity_check", sql`${t.capacity} IS NULL OR ${t.capacity} >= 1`),
    check("tiffin_slots_window_check", sql`${t.endMinute} > ${t.startMinute}`),
    unique("tiffin_slots_outlet_kind_key").on(t.outletId, t.kind),
    unique("tiffin_slots_org_id_key").on(t.organizationId, t.id),
    unique("tiffin_slots_org_outlet_id_key").on(t.organizationId, t.outletId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_slots_outlet_fkey",
    }),
  ]
);

export const tiffinCombos = pgTable(
  "tiffin_combos",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceMinor: priceMinor(),
    currency: text("currency").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_combos", t.organizationId),
    check(
      "tiffin_combos_name_check",
      sql`length(btrim(${t.name})) >= 1 AND length(${t.name}) <= 80`
    ),
    check("tiffin_combos_description_check", sql`length(${t.description}) <= 300`),
    check("tiffin_combos_price_minor_check", sql`${t.priceMinor} BETWEEN 0 AND 2147483647`),
    check("tiffin_combos_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    unique("tiffin_combos_org_id_key").on(t.organizationId, t.id),
    unique("tiffin_combos_org_outlet_id_key").on(t.organizationId, t.outletId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_combos_outlet_fkey",
    }),
    index("tiffin_combos_outlet_idx").on(t.outletId, t.archived),
  ]
);

export const tiffinComboItems = pgTable(
  "tiffin_combo_items",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    comboId: text("combo_id").notNull(),
    label: text("label").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_combo_items", t.organizationId),
    check(
      "tiffin_combo_items_label_check",
      sql`length(btrim(${t.label})) >= 1 AND length(${t.label}) <= 80`
    ),
    check("tiffin_combo_items_quantity_check", sql`${t.quantity} BETWEEN 1 AND 99`),
    unique("tiffin_combo_items_org_id_key").on(t.organizationId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_combo_items_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.comboId],
      foreignColumns: [tiffinCombos.organizationId, tiffinCombos.outletId, tiffinCombos.id],
      name: "tiffin_combo_items_combo_fkey",
    }).onDelete("cascade"),
    index("tiffin_combo_items_combo_idx").on(t.comboId),
  ]
);

export const tiffinComboAddons = pgTable(
  "tiffin_combo_addons",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    comboId: text("combo_id").notNull(),
    label: text("label").notNull(),
    priceMinor: priceMinor(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_combo_addons", t.organizationId),
    check(
      "tiffin_combo_addons_label_check",
      sql`length(btrim(${t.label})) >= 1 AND length(${t.label}) <= 80`
    ),
    check("tiffin_combo_addons_price_minor_check", sql`${t.priceMinor} BETWEEN 0 AND 2147483647`),
    unique("tiffin_combo_addons_org_id_key").on(t.organizationId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_combo_addons_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.comboId],
      foreignColumns: [tiffinCombos.organizationId, tiffinCombos.outletId, tiffinCombos.id],
      name: "tiffin_combo_addons_combo_fkey",
    }).onDelete("cascade"),
    index("tiffin_combo_addons_combo_idx").on(t.comboId),
  ]
);

export const tiffinWeekMenus = pgTable(
  "tiffin_week_menus",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    slotId: text("slot_id").notNull(),
    weekday: smallint("weekday").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_week_menus", t.organizationId),
    check("tiffin_week_menus_weekday_check", sql`${t.weekday} BETWEEN 0 AND 6`),
    unique("tiffin_week_menus_slot_weekday_key").on(t.slotId, t.weekday),
    unique("tiffin_week_menus_org_id_key").on(t.organizationId, t.id),
    unique("tiffin_week_menus_org_outlet_id_key").on(t.organizationId, t.outletId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_week_menus_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.slotId],
      foreignColumns: [tiffinSlots.organizationId, tiffinSlots.outletId, tiffinSlots.id],
      name: "tiffin_week_menus_slot_fkey",
    }).onDelete("cascade"),
  ]
);

export const tiffinWeekMenuCombos = pgTable(
  "tiffin_week_menu_combos",
  {
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    weekMenuId: text("week_menu_id").notNull(),
    comboId: text("combo_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_week_menu_combos", t.organizationId),
    primaryKey({ name: "tiffin_week_menu_combos_pkey", columns: [t.weekMenuId, t.comboId] }),
    check("tiffin_week_menu_combos_sort_order_check", sql`${t.sortOrder} BETWEEN 0 AND 999`),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_week_menu_combos_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.weekMenuId],
      foreignColumns: [
        tiffinWeekMenus.organizationId,
        tiffinWeekMenus.outletId,
        tiffinWeekMenus.id,
      ],
      name: "tiffin_week_menu_combos_menu_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.comboId],
      foreignColumns: [tiffinCombos.organizationId, tiffinCombos.outletId, tiffinCombos.id],
      name: "tiffin_week_menu_combos_combo_fkey",
    }).onDelete("cascade"),
    index("tiffin_week_menu_combos_combo_idx").on(t.comboId),
  ]
);

export const tiffinDateOverrides = pgTable(
  "tiffin_date_overrides",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    slotId: text("slot_id").notNull(),
    localDate: date("local_date").notNull(),
    closed: boolean("closed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_date_overrides", t.organizationId),
    unique("tiffin_date_overrides_slot_date_key").on(t.slotId, t.localDate),
    unique("tiffin_date_overrides_org_id_key").on(t.organizationId, t.id),
    unique("tiffin_date_overrides_org_outlet_id_key").on(t.organizationId, t.outletId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_date_overrides_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.slotId],
      foreignColumns: [tiffinSlots.organizationId, tiffinSlots.outletId, tiffinSlots.id],
      name: "tiffin_date_overrides_slot_fkey",
    }).onDelete("cascade"),
  ]
);

export const tiffinDateOverrideCombos = pgTable(
  "tiffin_date_override_combos",
  {
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    overrideId: text("override_id").notNull(),
    comboId: text("combo_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_date_override_combos", t.organizationId),
    primaryKey({ name: "tiffin_date_override_combos_pkey", columns: [t.overrideId, t.comboId] }),
    check("tiffin_date_override_combos_sort_order_check", sql`${t.sortOrder} BETWEEN 0 AND 999`),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_date_override_combos_outlet_fkey",
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.overrideId],
      foreignColumns: [
        tiffinDateOverrides.organizationId,
        tiffinDateOverrides.outletId,
        tiffinDateOverrides.id,
      ],
      name: "tiffin_date_override_combos_override_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.organizationId, t.outletId, t.comboId],
      foreignColumns: [tiffinCombos.organizationId, tiffinCombos.outletId, tiffinCombos.id],
      name: "tiffin_date_override_combos_combo_fkey",
    }).onDelete("cascade"),
    index("tiffin_date_override_combos_combo_idx").on(t.comboId),
  ]
);

export const tiffinAreas = pgTable(
  "tiffin_areas",
  {
    id: id(),
    organizationId: organizationId(),
    outletId: text("outlet_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    organizationFk("tiffin_areas", t.organizationId),
    check(
      "tiffin_areas_name_check",
      sql`length(btrim(${t.name})) >= 1 AND length(${t.name}) <= 60`
    ),
    unique("tiffin_areas_org_id_key").on(t.organizationId, t.id),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
      name: "tiffin_areas_outlet_fkey",
    }),
    uniqueIndex("tiffin_areas_outlet_name_key").on(t.outletId, sql`lower(${t.name})`),
  ]
);
