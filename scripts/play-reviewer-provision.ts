/**
 * One-time, owner-operated Play reviewer setup. Never imported by Next.js
 * routes, workers, CI seed, or automatic production deployment.
 *
 * Required values are supplied at runtime only (not committed or logged):
 *   ALLOW_PLAY_REVIEW_PROVISION=true
 *   PLAY_REVIEWER_EMAIL=<owner-controlled email>
 *   PLAY_REVIEWER_PASSWORD=<private password>
 *   MIGRATION_DATABASE_URL=<schema owner's connection>
 *   APP_URL=https://food.bababuilds.com
 */
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { provisionPlayReviewer } from "../src/modules/play-review/provision";

function configured(): { email: string; password: string; rotate: boolean; url: string } {
  if (process.env["ALLOW_PLAY_REVIEW_PROVISION"] !== "true")
    throw new Error("Explicit Play reviewer provisioning approval required");
  if (process.env["APP_URL"] !== "https://food.bababuilds.com")
    throw new Error("Play reviewer provisioner requires the reviewed production origin");
  const email = process.env["PLAY_REVIEWER_EMAIL"]?.trim().toLowerCase() ?? "";
  const password = process.env["PLAY_REVIEWER_PASSWORD"] ?? "";
  const url = process.env["MIGRATION_DATABASE_URL"] ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Provide the reviewer email through PLAY_REVIEWER_EMAIL");
  if (password.length < 16 || password.length > 128)
    throw new Error("Reviewer password must contain 16-128 characters");
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://"))
    throw new Error("A migration-owner PostgreSQL URL is required");
  const rotate = process.env["PLAY_REVIEWER_ROTATE_PASSWORD"] === "true";
  return { email, password, rotate, url };
}

async function main() {
  const input = configured();
  const pool = new Pool({ connectionString: input.url, max: 1 });
  try {
    const hash = await hashPassword(input.password);
    const client = await pool.connect();
    try {
      const summary = await provisionPlayReviewer(client, input.email, hash, input.rotate);
      console.log(
        `Play reviewer fixture ready: ${summary.restaurant}; ${summary.dishes} dishes, ${summary.orders} sample orders, ${summary.tables} tables. No credentials printed.`
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  // SQL/driver errors may include connection strings or secret values; never log those.
  console.error("Play reviewer provisioning failed; review owner-only logs and configuration");
  process.exitCode = 1;
});
