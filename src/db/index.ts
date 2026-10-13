import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

// ─── Database Path Configuration ──────────────────────────────────────────────
// In production: use an absolute path outside the release directory
// e.g. /var/data/menuminute/menuminute.sqlite
// In development: uses ./data/menuminute.sqlite relative to project root

function resolveDatabasePath(): string {
  const rawPath = process.env["DATABASE_URL"];

  if (rawPath && path.isAbsolute(rawPath)) {
    return rawPath;
  }

  // Relative path — resolve from project root (process.cwd())
  const relativePath = rawPath ?? "./data/menuminute.sqlite";
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), relativePath);
}

// ─── Singleton Database Connection ────────────────────────────────────────────
// SQLite should use a single connection in Node.js. Better-sqlite3 is
// synchronous by design which avoids common WAL locking issues.

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;

  const dbPath = resolveDatabasePath();

  // Ensure the data directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open the database
  const sqlite = new Database(dbPath);
  _sqlite = sqlite;

  // ─── Production-safe SQLite PRAGMA configuration ───────────────────────────
  // WAL mode: allows concurrent reads while a write is in progress
  sqlite.pragma("journal_mode = WAL");
  // Enforce foreign key constraints (SQLite disables them by default)
  sqlite.pragma("foreign_keys = ON");
  // Busy timeout: wait up to 5s before throwing SQLITE_BUSY
  sqlite.pragma("busy_timeout = 5000");
  // Synchronous NORMAL: good durability/performance balance for WAL mode
  sqlite.pragma("synchronous = NORMAL");
  // Cache: 64MB page cache for better read performance
  sqlite.pragma("cache_size = -65536");
  // Memory-mapped I/O: 128MB for faster reads on supported platforms
  sqlite.pragma("mmap_size = 134217728");
  // Temp store in memory for sorting/aggregation
  sqlite.pragma("temp_store = MEMORY");

  _db = drizzle(sqlite, { schema });
  return _db;
}

// Export a pre-built db accessor (singleton)
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

if (process.env["NODE_ENV"] !== "test") {
  process.on("beforeExit", closeDb);
  process.on("SIGINT", () => {
    closeDb();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    closeDb();
    process.exit(0);
  });
}

export type Db = ReturnType<typeof getDb>;
