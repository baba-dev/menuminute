import { readFileSync } from "node:fs";
import { importSqlite } from "./legacy/import-sqlite";
const source = process.env["SQLITE_SOURCE_PATH"],
  target = process.env["MIGRATION_DATABASE_URL"];
if (!source || !target) throw new Error("Explicit source snapshot and migration target required");
importSqlite(
  source,
  target,
  process.env["ACKNOWLEDGE_SESSION_RESET"] === "true",
  JSON.parse(readFileSync(process.env["SQLITE_TIMEZONE_MAP"]!, "utf8"))
)
  .then((report) => console.warn(JSON.stringify(report)))
  .catch(() => {
    console.error(
      "Legacy import aborted. Source unchanged; inspect reconciliation and mapping in staging."
    );
    process.exitCode = 1;
  });
