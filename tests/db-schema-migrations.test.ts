import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { admin, fixture } from "./helpers";
import { migrateDatabase } from "../scripts/migration-runner";
it("applies reviewed migrations idempotently and keeps tenant RLS enabled", async () => {
  await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]!);
  await fixture();
  await admin(async (_db, pool) => {
    const r = await pool.query(
      "select relname,relrowsecurity from pg_class where relname in ('restaurants','menu_categories','menu_items','organizations','organization_members','background_jobs')"
    );
    expect(r.rows).toHaveLength(6);
    expect(r.rows.every((row) => row.relrowsecurity)).toBe(true);
    const journal = JSON.parse(await readFile("src/db/migrations/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    const names = (
      await pool.query<{ name: string }>("select name from drizzle.foundation_migrations")
    ).rows.map((row) => row.name);
    expect(names.sort()).toEqual(journal.entries.map((e) => e.tag).sort());
  });
});
