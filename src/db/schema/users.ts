import { pgTable, text, timestamp, boolean, index, uniqueIndex, bigint } from "drizzle-orm/pg-core";
const instant = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isDemoData: boolean("is_demo_data").notNull().default(false),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
});
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    uniqueIndex("accounts_provider_idx").on(t.providerId, t.accountId),
    index("accounts_user_idx").on(t.userId),
  ]
);
export const verificationTokens = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
});
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: bigint("count", { mode: "number" }).notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
