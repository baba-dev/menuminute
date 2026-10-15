import { Pool } from "pg";
if (process.env["NODE_ENV"] !== "test") throw new Error("Isolated test environment only");
const url = process.env["MIGRATION_DATABASE_URL"];
if (!url || new URL(url).pathname !== "/menuminute_test")
  throw new Error("Explicit menuminute_test owner URL required");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='menuminute_app') THEN CREATE ROLE menuminute_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'isolated-ci-app-password'; END IF; END $$"
  );
} finally {
  await pool.end();
}
