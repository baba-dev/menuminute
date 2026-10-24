import {
  pgTable,
  text,
  timestamp,
  jsonb,
  smallint,
  integer,
  unique,
  index,
  foreignKey,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { restaurants } from "./restaurants";
import { users } from "./users";
const time = (name: string) => timestamp(name, { withTimezone: true });
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: text("outlet_id")
      .notNull()
      .references(() => restaurants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    requestKey: uuid("request_key").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("assistant_conversation_scope").on(t.id, t.organizationId, t.outletId, t.userId),
    unique("assistant_conversation_request").on(t.userId, t.requestKey),
    index("assistant_conversations_owner").on(t.userId, t.outletId, t.createdAt),
  ]
);
export const assistantTurns = pgTable(
  "assistant_turns",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    userId: text("user_id").notNull(),
    clientKey: uuid("client_key").notNull(),
    requestHash: text("request_hash").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status", { enum: ["processing", "completed", "failed"] })
      .notNull()
      .default("processing"),
    answer: text("answer"),
    evidence: jsonb("evidence").notNull().default([]),
    errorCode: text("error_code"),
    createdAt: time("created_at").notNull().defaultNow(),
    completedAt: time("completed_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.conversationId, t.organizationId, t.outletId, t.userId],
      foreignColumns: [
        assistantConversations.id,
        assistantConversations.organizationId,
        assistantConversations.outletId,
        assistantConversations.userId,
      ],
    }),
    unique("assistant_turn_scope").on(
      t.id,
      t.conversationId,
      t.organizationId,
      t.outletId,
      t.userId
    ),
    unique("assistant_turn_idempotency").on(t.conversationId, t.clientKey),
    index("assistant_turns_actor_window").on(t.userId, t.createdAt),
    index("assistant_turns_history").on(t.conversationId, t.createdAt),
  ]
);
export const assistantAttempts = pgTable(
  "assistant_attempts",
  {
    id: text("id").primaryKey(),
    turnId: text("turn_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    userId: text("user_id").notNull(),
    round: smallint("round").notNull(),
    provider: text("provider", { enum: ["nvidia", "cloudflare"] }).notNull(),
    model: text("model").notNull(),
    status: text("status", { enum: ["started", "completed", "uncertain"] })
      .notNull()
      .default("started"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: time("created_at").notNull().defaultNow(),
    settledAt: time("settled_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.turnId, t.conversationId, t.organizationId, t.outletId, t.userId],
      foreignColumns: [
        assistantTurns.id,
        assistantTurns.conversationId,
        assistantTurns.organizationId,
        assistantTurns.outletId,
        assistantTurns.userId,
      ],
    }),
    unique("assistant_attempt_round").on(t.turnId, t.round),
    index("assistant_attempts_tenant_window").on(t.organizationId, t.createdAt),
  ]
);
