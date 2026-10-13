// Set environment variables at the top before any other imports evaluate
(process.env as Record<string, string | undefined>)["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "./data/test-menuminute.sqlite";
process.env["AUTH_SECRET"] = "test-secret-min-16-characters-long";
process.env["APP_URL"] = "http://localhost:3000";

import "@testing-library/jest-dom";
import { beforeAll } from "vitest";
import { getDb } from "../src/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

beforeAll(() => {
  // Ensure test database is migrated
  const db = getDb();
  const migrationsFolder = path.resolve(process.cwd(), "src", "db", "migrations");
  try {
    migrate(db, { migrationsFolder });
  } catch (err) {
    console.error("Failed to migrate test database:", err);
  }
});
