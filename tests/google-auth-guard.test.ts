import { expect, it } from "vitest";
import { getPool } from "../src/db";
import { fixture, admin } from "./helpers";
import { googleMfaBlocked } from "../src/lib/google-auth-guard";

it("rejects Google OAuth for TOTP-enabled accounts by email and linked subject", async () => {
  const user = await fixture();
  const row = await getPool().query<{ email: string }>(
    "select email from users where id=$1", [user.actor.userId]
  );
  const email = row.rows[0]!.email;
  const googleSubject = "google-security-" + crypto.randomUUID();
  expect(await googleMfaBlocked(email, googleSubject)).toBe(false);

  await admin(async (_db, pool) => {
    await pool.query("update users set two_factor_enabled=true where id=$1", [user.actor.userId]);
    await pool.query(
      "insert into accounts(id,user_id,provider_id,account_id) values($1,$2,'google',$3)",
      [crypto.randomUUID(), user.actor.userId, googleSubject]
    );
  });
  expect(await googleMfaBlocked(email, "unlinked-subject")).toBe(true);
  expect(await googleMfaBlocked("renamed-provider-email@google.invalid", googleSubject)).toBe(true);
  expect(await googleMfaBlocked("unrelated@google.invalid", "other-subject")).toBe(false);
});
