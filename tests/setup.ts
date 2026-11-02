import "@testing-library/jest-dom";
import { beforeAll, afterAll } from "vitest";
import { migrateDatabase } from "../scripts/migration-runner";
import { Client } from "pg";
import { closeDb } from "../src/db";
beforeAll(async () => {
  if (!process.env["MIGRATION_DATABASE_URL"])
    throw new Error("Explicit isolated migration database required");
  await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]);
  // Production ships every plan switch ON (migration 0086). Tests start from a neutral baseline so
  // unrelated suites are not affected by trials, order caps or hidden dishes; the plan suites switch on
  // what they exercise. Files run one at a time, so this cannot disturb a running suite.
  const client = new Client({ connectionString: process.env["MIGRATION_DATABASE_URL"] });
  await client.connect();
  try {
    await client.query(
      "update app_private.plan_settings set free_intake_enabled=false,overflow_hiding_enabled=false,auto_trial_enabled=false,dunning_grace_enabled=false"
    );
  } finally {
    await client.end();
  }
}, 30000);
afterAll(async () => {
  if (!process.env["MIGRATION_DATABASE_URL"]) return;
  await closeDb();
});
