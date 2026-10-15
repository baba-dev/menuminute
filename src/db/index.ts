import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env } from "@/lib/config/env";
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      statement_timeout: 5000,
      query_timeout: 6000,
      idle_in_transaction_session_timeout: 10000,
      application_name: "menuminute-web",
    });
    pool.on("error", () => console.error("Database idle connection failed"));
  }
  return pool;
}
export function getDb() {
  return (db ??= drizzle(getPool(), { schema }));
}
export async function closeDb() {
  const old = pool;
  pool = undefined;
  db = undefined;
  await old?.end();
}
export type Db = ReturnType<typeof getDb>;
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export async function verifyRuntimeRole() {
  const result = await getPool().query<{ safe: boolean }>(
    `SELECT NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb)
 AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE pg_has_role(current_user,p.oid,'MEMBER') AND
 (p.rolsuper OR p.rolbypassrls OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relowner=p.oid)))
 AS safe FROM pg_roles r WHERE r.rolname=current_user`
  );
  if (!result.rows[0]?.safe) throw new Error("Restricted non-owner database role required");
}
