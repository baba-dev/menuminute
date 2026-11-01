import { getPool } from "@/db";
import { verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { authServer } from "@/lib/auth";
import { recordAuthEvent, alertSecurityEvent } from "@/lib/security-events";
import { matchingStepUpTotp } from "@/lib/totp-verification";

/** Password AND native Better Auth TOTP, bound to the existing active DB session. */
export async function confirmStepUp(
  userId: string,
  sessionId: string,
  password: string,
  code: string,
  requestHeaders: Headers
) {
  const row = await getPool().query<{ password: string }>(
    "select a.password from accounts a join users u on u.id=a.user_id where a.user_id=$1 and a.provider_id='credential' and u.email_verified and u.two_factor_enabled limit 1",
    [userId]
  );
  const hash = row.rows[0]?.password;
  if (!hash) return false;
  const valid = /^\$2[aby]\$/.test(hash)
    ? await bcrypt.compare(password, hash)
    : await verifyPassword({ hash, password });
  if (!valid) {
    await recordAuthEvent(userId, "mfa.failed", sessionId);
    return false;
  }
  // Verify the *existing* live session first. The native verifyTOTP endpoint is for
  // enrollment/pending login, not an already signed-in privileged step-up.
  const before = await authServer.api.getSession({ headers: requestHeaders });
  if (!before || before.user.id !== userId || before.session.id !== sessionId) return false;
  let matchedStep: number | null = null;
  try {
    const factor = await authServer.api.getTOTPURI({
      body: { password },
      headers: requestHeaders,
    });
    matchedStep = matchingStepUpTotp(factor.totpURI, code);
  } catch {
    matchedStep = null;
  }
  if (matchedStep === null) {
    await recordAuthEvent(userId, "mfa.failed", sessionId);
    return false;
  }
  // Do not create proof for any different/new session, or a session revoked during verification.
  const current = await authServer.api.getSession({ headers: requestHeaders });
  if (!current || current.user.id !== userId || current.session.id !== sessionId) return false;
  // Consume the matched time step and create proof in the same transaction.
  // Concurrent submissions of the same code cannot mint two proofs.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const consumed = await client.query(
      "insert into auth_totp_consumed(user_id,last_step) values($1,$2) on conflict(user_id) do update set last_step=excluded.last_step where auth_totp_consumed.last_step < excluded.last_step returning user_id",
      [userId, matchedStep]
    );
    if (!consumed.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      "insert into auth_step_up(session_id,user_id,expires_at) values($1,$2,now()+interval '5 minutes') on conflict(session_id) do update set user_id=excluded.user_id,expires_at=excluded.expires_at",
      [sessionId, userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await recordAuthEvent(userId, "step_up.completed", sessionId);
  void alertSecurityEvent(userId, "Privileged MenuMinute confirmation completed");
  return true;
}
