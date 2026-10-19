import { getPool } from "@/db";
import { sendAuthEmail } from "@/lib/auth-email";
import { env } from "@/lib/config/env";
export type AuthEvent =
  | "session.created"
  | "session.revoked"
  | "step_up.completed"
  | "mfa.enrolled"
  | "mfa.failed"
  | "sessions.revoked_all"
  | "password.reset";
export async function recordAuthEvent(userId: string, kind: AuthEvent, sessionId?: string) {
  await getPool().query(
    "insert into auth_security_events(id,user_id,kind,session_id) values($1,$2,$3,$4)",
    [crypto.randomUUID(), userId, kind, sessionId ?? null]
  );
}
export async function alertSecurityEvent(userId: string, subject: string) {
  const row = await getPool().query<{ email: string }>(
    "select email from users where id=$1 and email_verified=true",
    [userId]
  );
  if (!row.rows[0]) return;
  await sendAuthEmail(
    row.rows[0].email,
    subject,
    new URL("/account/security", env.APP_URL).toString()
  ).catch(() => {});
}
