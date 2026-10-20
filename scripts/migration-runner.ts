import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

async function migrationChecksums() {
  const journal = JSON.parse(
    await readFile(path.resolve("src/db/migrations/meta/_journal.json"), "utf8")
  ) as { entries: Array<{ tag: string }> };
  return Promise.all(
    journal.entries.map(async ({ tag: name }) => ({
      name,
      checksum: createHash("sha256")
        .update(await readFile(path.resolve("src/db/migrations", `${name}.sql`), "utf8"))
        .digest("hex"),
    }))
  );
}

/** Read-only verification used by the operator-authorized forward-recovery path. */
export async function verifyMigrationState(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    options: "-c default_transaction_read_only=on",
  });
  try {
    const expected = await migrationChecksums();
    const result = await pool.query<{ name: string; checksum: string }>(
      "select name, checksum from drizzle.foundation_migrations order by name"
    );
    const actual = new Map(result.rows.map((row) => [row.name, row.checksum]));
    if (
      actual.size !== expected.length ||
      expected.some(({ name, checksum }) => actual.get(name) !== checksum)
    )
      throw new Error("Migration ledger does not exactly match candidate release");
  } finally {
    await pool.end();
  }
}
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
    for (const { name, checksum } of await migrationChecksums()) {
      const source = await readFile(path.resolve("src/db/migrations", `${name}.sql`), "utf8");
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
