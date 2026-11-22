import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";

// Every test uses the isolated CI database after the ordered migration ledger.
const tables = [
  "food_entries",
  "food_revisions",
  "food_sources",
  "food_entry_sources",
  "food_aliases",
  "food_relations",
  "food_media",
  "food_editorial_events",
  "food_redirects",
  "food_candidates",
];

async function app<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

describe("Food Encyclopedia P2 database isolation", () => {
  it("has all private tables FORCE RLS and no app direct-table privileges", async () => {
    await admin(async (_db, pool) => {
      const res = await pool.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        "select relname,relrowsecurity,relforcerowsecurity from pg_class where relname=any($1::text[])",
        [tables]
      );
      expect(res.rows.map((x) => x.relname).sort()).toEqual([...tables].sort());
      expect(res.rows.every((x) => x.relrowsecurity && x.relforcerowsecurity)).toBe(true);
    });
    await app(async (pool) => {
      for (const table of tables) {
        const result = await pool.query<{ can_read: boolean; can_write: boolean }>(
          "select has_table_privilege(current_user,$1,'SELECT') as can_read,has_table_privilege(current_user,$1,'INSERT') as can_write",
          [table]
        );
        expect(result.rows[0]?.can_read).toBe(false);
        expect(result.rows[0]?.can_write).toBe(false);
      }
    });
  });
  it("exposes only narrow functions to the runtime role", async () => {
    await app(async (pool) => {
      const r = await pool.query<{ public_read: boolean; editor_write: boolean }>(
        "select has_function_privilege(current_user,'app_private.food_public_entry(text,text)','EXECUTE') as public_read,has_function_privilege(current_user,'app_private.food_editorial_command(text,text,jsonb,text)','EXECUTE') as editor_write"
      );
      expect(r.rows[0]).toMatchObject({ public_read: true, editor_write: true });
    });
  });
  it("never exposes an unpublished entry through the public projection", async () => {
    const f = await fixture();
    const slug = "unreviewed-" + crypto.randomUUID().slice(0, 8);
    await admin(async (_db, pool) => {
      await pool.query(
        "INSERT INTO food_entries(kind,slug,created_by,updated_by) VALUES ('dishes',$1,$2,$2)",
        [slug, f.actor.userId]
      );
    });
    await app(async (pool) => {
      const r = await pool.query<{ entry: unknown }>(
        "SELECT app_private.food_public_entry($1,$2) AS entry",
        ["dishes", slug]
      );
      expect(r.rows[0]?.entry).toBeNull();
      const list = await pool.query<{ entry: unknown }>(
        "SELECT entry FROM app_private.food_public_list($1,$2,$3,$4)",
        ["dishes", slug, 20, 0]
      );
      expect(list.rows).toEqual([]);
    });
  });
  it("denies all unbound editorial mutations without session and step-up", async () => {
    await app(async (pool) => {
      await expect(
        pool.query("SELECT app_private.food_editorial_command($1,$2,$3::jsonb,$4)", [
          "create",
          "new",
          "{}",
          crypto.randomUUID(),
        ])
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        pool.query("SELECT app_private.food_import_candidates($1::jsonb,$2)", [
          "[]",
          crypto.randomUUID(),
        ])
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
});
