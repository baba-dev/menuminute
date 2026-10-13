/**
 * Database migration script.
 * Run with: pnpm db:migrate
 *
 * Uses Drizzle's migrate() to apply versioned migrations from src/db/migrations/.
 * Safe for production — never drops tables unless migrations explicitly do so.
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb, closeDb } from "../src/db/index";
import path from "path";

async function runMigrations() {
  console.warn("Running database migrations...");

  const db = getDb();
  const migrationsFolder = path.join(process.cwd(), "src", "db", "migrations");

  migrate(db, { migrationsFolder });

  console.warn("✅ Migrations completed successfully.");
  closeDb();
}

runMigrations().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
