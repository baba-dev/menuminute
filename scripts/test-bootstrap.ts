import { Pool } from "pg";
if (process.env["NODE_ENV"] !== "test") throw new Error("Isolated test environment only");
const url = process.env["MIGRATION_DATABASE_URL"];
if (!url || new URL(url).pathname !== "/menuminute_test")
  throw new Error("Explicit menuminute_test owner URL required");
const pool = new Pool({ connectionString: url });
async function bootstrap() {
  try {
    await pool.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='menuminute_app') THEN CREATE ROLE menuminute_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'isolated-ci-app-password'; END IF; END $$"
    );
    await pool.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='menuminute_billing') THEN CREATE ROLE menuminute_billing LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'isolated-ci-billing-password'; END IF; END $$"
    );
    await pool.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='menuminute_worker') THEN CREATE ROLE menuminute_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'isolated-ci-worker-password'; END IF; END $$"
    );
  } finally {
    await pool.end();
  }
}
bootstrap().catch(() => {
  console.error("Test role bootstrap failed");
  process.exitCode = 1;
});
