import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { applyEntitlement } from "../src/modules/billing/operator";
async function main() {
  const file = process.argv[2];
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!file || !url)
    throw new Error("Explicit operator JSON file and migration-owner URL required");
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
    lock_timeout: 3000,
  });
  try {
    const result = await applyEntitlement(pool, JSON.parse(await readFile(file, "utf8")));
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error("Entitlement command failed; review the input, role and organization");
  process.exitCode = 1;
});
