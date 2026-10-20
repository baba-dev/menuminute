import { verifyMigrationState } from "./migration-runner";

const url = process.env["MIGRATION_DATABASE_URL"];
if (!url || !/^postgres(ql)?:\/\//.test(url))
  throw new Error("MIGRATION_DATABASE_URL must be an explicit PostgreSQL owner connection");
const parsed = new URL(url);
if (decodeURIComponent(parsed.username) !== "menuminute_owner" || parsed.pathname !== "/menuminute")
  throw new Error("Migration verification requires the dedicated MenuMinute owner/database");

verifyMigrationState(url)
  .then(() => console.warn("Candidate migration state is compatible."))
  .catch(() => {
    console.error("Candidate migration state is incompatible; no database changes were made.");
    process.exitCode = 1;
  });
