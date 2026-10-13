import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // nanoid
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "timestamp" }),
    name: text("name"),
    image: text("image"),
    passwordHash: text("password_hash"), // null for OAuth users
    role: text("role", { enum: ["superadmin", "user"] })
      .notNull()
      .default("user"),
    isDemoData: integer("is_demo_data", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    sessionToken: text("session_token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.sessionToken),
    index("sessions_user_idx").on(t.userId),
  ]
);

// ─── Accounts (OAuth) ─────────────────────────────────────────────────────────

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => [
    uniqueIndex("accounts_provider_idx").on(t.provider, t.providerAccountId),
    index("accounts_user_idx").on(t.userId),
  ]
);

// ─── Verification Tokens ───────────────────────────────────────────────────────

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("verification_tokens_idx").on(t.identifier, t.token)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
