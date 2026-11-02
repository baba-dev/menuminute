import { Pool } from "pg";

/**
 * Plan switches ship ON (migration 0084). Specs that assert the QR-only presentation of a Free outlet
 * turn free order intake off for their own run and put it back afterwards. Browser CI runs one worker
 * per shard database, so these toggles cannot overlap.
 */
export async function setFreeIntake(enabled: boolean) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated browser database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("update app_private.plan_settings set free_intake_enabled=$1", [enabled]);
  } finally {
    await pool.end();
  }
}

/** The automatic trial starts on an owner's first publish, which would make a "Free" outlet order-ready. */
export async function setAutoTrial(enabled: boolean) {
  const url = process.env["MIGRATION_DATABASE_URL"];
  if (!url || new URL(url).pathname !== "/menuminute_test")
    throw new Error("Isolated browser database required");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("update app_private.plan_settings set auto_trial_enabled=$1", [enabled]);
  } finally {
    await pool.end();
  }
}
