import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
/** Single connection, advisory lock, checksum ledger, one transaction per reviewed SQL file. */
export async function migrateDatabase(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  });
  const c = await pool.connect();
  try {
    await c.query("select pg_advisory_lock(60312101)");
    await c.query("create schema if not exists drizzle");
    await c.query(
      "create table if not exists drizzle.foundation_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())"
    );
    const journal = JSON.parse(
      await readFile(path.resolve("src/db/migrations/meta/_journal.json"), "utf8")
    ) as { entries: Array<{ tag: string }> };
    for (const name of journal.entries.map((e) => e.tag)) {
      const source = await readFile(path.resolve("src/db/migrations", `${name}.sql`), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const applied = await c.query<{ checksum: string }>(
        "select checksum from drizzle.foundation_migrations where name=$1",
        [name]
      );
      if (applied.rows.length) {
        if (applied.rows[0]?.checksum !== checksum)
          throw new Error("Applied migration checksum changed");
        continue;
      }
      await c.query("begin");
      try {
        await c.query(source.replaceAll("--> statement-breakpoint", ""));
        await c.query("insert into drizzle.foundation_migrations(name,checksum) values($1,$2)", [
          name,
          checksum,
        ]);
        await c.query("commit");
      } catch (e) {
        await c.query("rollback");
        throw e;
      }
    }
  } finally {
    await c.query("select pg_advisory_unlock(60312101)").catch(() => {});
    c.release();
    await pool.end();
  }
}
