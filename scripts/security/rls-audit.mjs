/** Read-only tenant RLS inventory; never mass-enable FORCE on definer tables. */
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const result = await pool.query(`
    SELECT n.nspname AS schema, c.relname AS table_name,
      c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
      pg_get_userbyid(c.relowner) AS owner,
      (SELECT count(*) FROM pg_policies p
       WHERE p.schemaname=n.nspname AND p.tablename=c.relname)::int AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname='public'
    ORDER BY n.nspname,c.relname`);
  process.stdout.write(JSON.stringify(result.rows, null, 2) + "\n");
} finally {
  await pool.end();
}
