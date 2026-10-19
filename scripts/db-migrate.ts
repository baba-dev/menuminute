import { migrateDatabase } from "./migration-runner";
const url = process.env["MIGRATION_DATABASE_URL"];
if (!url || !/^postgres(ql)?:\/\//.test(url))
  throw new Error("MIGRATION_DATABASE_URL must be an explicit PostgreSQL owner connection");
migrateDatabase(url)
  .then(() => console.warn("Migrations applied"))
  .catch((error: unknown) => {
    if (process.env["CI"] === "true" && typeof error === "object" && error !== null) {
      const pg = error as {
        code?: string;
        position?: string;
        routine?: string;
        constraint?: string;
        table?: string;
      };
      console.error("Migration SQL diagnostic", {
        sqlstate: pg.code,
        position: pg.position,
        routine: pg.routine,
        constraint: pg.constraint,
        table: pg.table,
      });
    }
    console.error(
      "Migration failed; inspect reviewed SQL and owner connection without logging credentials"
    );
    process.exitCode = 1;
  });
