import { migrateDatabase } from "./migration-runner";
const url = process.env["MIGRATION_DATABASE_URL"];
if (!url || !/^postgres(ql)?:\/\//.test(url))
  throw new Error("MIGRATION_DATABASE_URL must be an explicit PostgreSQL owner connection");
migrateDatabase(url)
  .then(() => console.warn("Migrations applied"))
  .catch(() => {
    console.error(
      "Migration failed; inspect reviewed SQL and owner connection without logging credentials"
    );
    process.exitCode = 1;
  });
