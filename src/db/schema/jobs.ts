import { sql } from "drizzle-orm";
import { timestamp, integer, pgTable, text, index } from "drizzle-orm/pg-core";

// ─── Background Jobs ───────────────────────────────────────────────────────────

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // "media_process", "qr_generate", etc.
    payload: text("payload"), // JSON
    status: text("status", {
      enum: ["pending", "running", "done", "failed"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    errorMessage: text("error_message"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.scheduledAt), index("jobs_type_idx").on(t.type)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
