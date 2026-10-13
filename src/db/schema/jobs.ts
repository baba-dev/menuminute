import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

// ─── Background Jobs ───────────────────────────────────────────────────────────

export const backgroundJobs = sqliteTable(
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
    scheduledAt: integer("scheduled_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.scheduledAt), index("jobs_type_idx").on(t.type)]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
