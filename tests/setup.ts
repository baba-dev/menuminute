import "@testing-library/jest-dom";
import { beforeAll, afterAll } from "vitest";
import { migrateDatabase } from "../scripts/migration-runner";
import { closeDb } from "../src/db";
beforeAll(async () => {
  if (process.env["MIGRATION_DATABASE_URL"]) {
    await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]);
  }
}, 30000);
afterAll(async () => {
  await closeDb();
});
