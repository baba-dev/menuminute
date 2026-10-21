/**
 * Private, read-only operator diagnostic. Run under the existing web service
 * environment; do not publish as a route, log secrets, user data or cookies.
 */
import { getPool } from "../src/db";
import { env } from "../src/lib/config/env";
import { REMEMBERED_SESSION_SECONDS } from "../src/lib/auth-session-policy";

async function main() {
  const url = new URL(env.APP_URL);
  if (env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("canonical HTTPS origin");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password)
    throw new Error("APP_URL must be a canonical origin");
  if (REMEMBERED_SESSION_SECONDS !== 2592000) throw new Error("session policy");
  const pool = getPool();
  try {
    // Tests actual runtime-role connectivity and the existing session schema.
    await pool.query("select id, user_id, expires_at from sessions limit 0");
    console.log("SESSION_PREFLIGHT: PASS (origin, policy, PostgreSQL session schema)");
    console.log(
      "SECRET_CONTINUITY: verify externally that the same root-owned web.env is used across releases"
    );
    console.log(
      "PROXY_CONTINUITY: verify installed Nginx/Cloudflare and Set-Cookie on the public host"
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  // Deliberately omit connection strings, environment values and underlying errors.
  console.error("SESSION_PREFLIGHT: FAIL (inspect private service configuration)");
  process.exitCode = 1;
});
