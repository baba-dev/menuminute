import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { restaurants } from "./restaurants";
import { organizationMembers } from "./tenancy";
import { orders, orderItems } from "./orders";
const stamp = (name: string) => timestamp(name, { withTimezone: true });
export const kitchenOutletSettings = pgTable("kitchen_outlet_settings", {
  outletId: text("outlet_id")
    .primaryKey()
    .references(() => restaurants.id),
  enabled: boolean("enabled").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  updatedAt: stamp("updated_at").notNull().defaultNow(),
});
export const kitchenStations = pgTable(
  "kitchen_stations",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: stamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("kitchen_stations_outlet_id_unique").on(t.outletId, t.id),
    unique("kitchen_stations_outlet_name_unique").on(t.outletId, t.name),
  ]
);
export const kitchenStationMembers = pgTable(
  "kitchen_station_members",
  {
    outletId: text("outlet_id").notNull(),
    stationId: text("station_id").notNull(),
    memberId: text("member_id").notNull(),
    organizationId: text("organization_id").notNull(),
  },
  (t) => [
    unique("kitchen_station_member_unique").on(t.stationId, t.memberId),
    foreignKey({
      columns: [t.outletId, t.stationId],
      foreignColumns: [kitchenStations.outletId, kitchenStations.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.memberId],
      foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
  ]
);
export const kitchenRoutes = pgTable(
  "kitchen_routes",
  {
    outletId: text("outlet_id").notNull(),
    dishId: text("dish_id").notNull(),
    stationId: text("station_id").notNull(),
    ruleVersion: integer("rule_version").notNull().default(1),
  },
  (t) => [
    unique("kitchen_route_unique").on(t.outletId, t.dishId, t.stationId),
    foreignKey({
      columns: [t.outletId, t.stationId],
      foreignColumns: [kitchenStations.outletId, kitchenStations.id],
    }),
  ]
);
export const kitchenWork = pgTable(
  "kitchen_work",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    stationId: text("station_id").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    status: text("status", { enum: ["queued", "preparing", "complete", "cancelled"] })
      .notNull()
      .default("queued"),
    version: integer("version").notNull().default(0),
    createdAt: stamp("created_at").notNull().defaultNow(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("kitchen_work_item_station_unique").on(t.orderItemId, t.stationId),
    foreignKey({
      columns: [t.outletId, t.stationId],
      foreignColumns: [kitchenStations.outletId, kitchenStations.id],
    }),
    index("kitchen_work_station_active").on(t.outletId, t.stationId, t.status, t.createdAt),
    index("kitchen_work_order_idx").on(t.orderId),
  ]
);
export const kitchenEventCounters = pgTable("kitchen_event_counters", {
  outletId: text("outlet_id")
    .primaryKey()
    .references(() => restaurants.id),
  lastSeq: bigint("last_seq", { mode: "number" }).notNull().default(0),
});
export const kitchenEvents = pgTable(
  "kitchen_events",
  {
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    seq: bigint("seq", { mode: "number" }).notNull(),
    eventId: text("event_id").notNull().unique(),
    kind: text("kind").notNull(),
    workId: text("work_id"),
    actorId: text("actor_id"),
    occurredAt: stamp("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    unique("kitchen_events_outlet_seq_unique").on(t.outletId, t.seq),
    index("kitchen_events_outlet_time").on(t.outletId, t.occurredAt),
  ]
);
