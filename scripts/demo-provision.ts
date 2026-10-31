// Provisions (idempotently) the fixed public-demo tenant, then restores it to baseline.
// Operator-run with the isolated migration-owner URL; never web/worker credentials. Requires the
// documented production demo exception: ALLOW_DEMO_PROVISION=true. See docs/demo.md.
import { Pool } from "pg";
import { provisionDemo } from "../src/modules/demo/provision";

if (process.env["ALLOW_DEMO_PROVISION"] !== "true")
  throw new Error("Demo provisioning requires explicit ALLOW_DEMO_PROVISION=true");
const url = process.env["MIGRATION_DATABASE_URL"];
if (!url) throw new Error("Explicit migration connection required");
const pool = new Pool({ connectionString: url, max: 1 });

async function main() {
  const c = await pool.connect();
  try {
    console.warn("Demo provisioned", await provisionDemo(c));
  } finally {
    c.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error("Demo provisioning failed:", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
});
