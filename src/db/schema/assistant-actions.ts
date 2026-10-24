import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { assistantConversations } from "./assistant";
import { restaurants } from "./restaurants";
import { users } from "./users";
/** Mirror of additive migration 0022. Mutations use the checked SECURITY DEFINER domain entrypoints. */
export const assistantActionProposals = pgTable(
  "assistant_action_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    outletId: text("outlet_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    conversationId: text("conversation_id").notNull(),
    requestKey: uuid("request_key").notNull(),
    menuId: text("menu_id").notNull(),
    dishId: text("dish_id").notNull(),
    dishName: text("dish_name").notNull(),
    menuName: text("menu_name").notNull(),
    previousSoldOut: boolean("previous_sold_out").notNull(),
    desiredSoldOut: boolean("desired_sold_out").notNull(),
    expectedRevision: integer("expected_revision").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "rejected", "stale"] })
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionKey: uuid("decision_key"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    foreignKey({
      columns: [t.organizationId, t.outletId],
      foreignColumns: [restaurants.organizationId, restaurants.id],
    }),
    unique("assistant_proposal_request").on(t.userId, t.outletId, t.requestKey),
    index("assistant_action_owner").on(t.userId, t.outletId, t.createdAt),
  ]
);
