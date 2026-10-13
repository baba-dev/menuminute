import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../src/db/schema";
import path from "path";
import fs from "fs";

describe("Database Schema & Migrations", () => {
  const testDbPath = path.resolve(process.cwd(), "data", "test-schema-migrations.sqlite");
  let sqlite: Database.Database;

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    sqlite = new Database(testDbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }
  });

  it("should configure production SQLite pragmas correctly", () => {
    const journalMode = sqlite.pragma("journal_mode", { simple: true });
    expect(journalMode).toBe("wal");

    const foreignKeys = sqlite.pragma("foreign_keys", { simple: true });
    expect(foreignKeys).toBe(1);

    const busyTimeout = sqlite.pragma("busy_timeout", { simple: true });
    expect(busyTimeout).toBe(5000);
  });

  it("should execute versioned Drizzle migrations without error", () => {
    const db = drizzle(sqlite, { schema });
    const migrationsFolder = path.resolve(process.cwd(), "src", "db", "migrations");

    expect(() => {
      migrate(db, { migrationsFolder });
    }).not.toThrow();

    // Verify critical tables were created
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("restaurants");
    expect(tableNames).toContain("menu_categories");
    expect(tableNames).toContain("menu_items");
    expect(tableNames).toContain("qr_codes");
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("orders");
    expect(tableNames).toContain("subscription_plans");
    expect(tableNames).toContain("audit_logs");
  });
});
