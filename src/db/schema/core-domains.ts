import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
const time = (name: string) => timestamp(name, { withTimezone: true });
export const domainAudit = pgTable(
  "domain_audit",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    details: jsonb("details").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("domain_audit_org_time").on(t.organizationId, t.createdAt)]
);
export const domainCommands = pgTable(
  "domain_commands",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorId: text("actor_id").notNull(),
    requestKey: text("request_key").notNull(),
    command: jsonb("command").notNull(),
    result: jsonb("result").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [unique("domain_command_key").on(t.organizationId, t.actorId, t.requestKey)]
);
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: text("outlet_id"),
    type: text("type").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    aggregateVersion: integer("aggregate_version").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    deliverySequence: integer("delivery_sequence").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(20),
    leaseToken: text("lease_token"),
    leaseUntil: time("lease_until"),
    nextAttemptAt: time("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: time("created_at").notNull().defaultNow(),
    completedAt: time("completed_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
    index("outbox_due").on(t.status, t.nextAttemptAt),
    index("outbox_org").on(t.organizationId, t.createdAt),
  ]
);
export const consumerReceipts = pgTable(
  "consumer_receipts",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => outboxEvents.id),
    consumer: text("consumer").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    completedAt: time("completed_at").notNull().defaultNow(),
  },
  (t) => [unique("consumer_receipt_key").on(t.eventId, t.consumer)]
);
export const domainProjections = pgTable("domain_projections", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const entitlementGrants = pgTable(
  "entitlement_grants",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    capability: text("capability").notNull(),
    billingCurrency: text("billing_currency").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    revokedAt: time("revoked_at"),
    operator: text("operator").notNull(),
    reason: text("reason").notNull(),
    requestKey: text("request_key").notNull().unique(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("entitlements_org_window").on(t.organizationId, t.capability, t.endsAt)]
);
