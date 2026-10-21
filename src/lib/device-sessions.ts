import { getPool } from "@/db";
import { alertSecurityEvent } from "@/lib/security-events";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export function describeDevice(agent: string | null) {
  const value = (agent ?? "").slice(0, 1024);
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /Firefox\//.test(value)
      ? "Firefox"
      : /Chrome\//.test(value)
        ? "Chrome"
        : /Safari\//.test(value)
          ? "Safari"
          : "Browser";
  const platform = /Android/i.test(value)
    ? "Android"
    : /iPhone|iPad/i.test(value)
      ? "iPhone or iPad"
      : /Windows/i.test(value)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(value)
          ? "Mac"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  return { browser, platform };
}
export async function listDevices(userId: string, currentSessionId: string) {
  const result = await getPool().query<{
    id: string;
    user_agent: string | null;
    created_at: Date;
    updated_at: Date;
    expires_at: Date;
  }>(
    "select id,user_agent,created_at,updated_at,expires_at from sessions where user_id=$1 and expires_at>now() order by updated_at desc,id limit 50",
    [userId]
  );
  return result.rows.map(({ id, user_agent, created_at, updated_at, expires_at }) => ({
    id,
    ...describeDevice(user_agent),
    current: id === currentSessionId,
    createdAt: created_at,
    lastActiveAt: updated_at,
    expiresAt: expires_at,
  }));
}
/** Scope every delete to the authenticated user, excluding this live session. */
export async function revokeDeviceSessions(
  userId: string,
  currentSessionId: string,
  target: string | "others"
) {
  if (target === currentSessionId) throw new ForbiddenError("Sign out this device using Sign out");
  const deleted = await getPool().query<{ session_id: string }>(
    "WITH removed AS (DELETE FROM sessions WHERE user_id=$1 AND id<>$2 AND ($3::text='others' OR id=$3) RETURNING id) INSERT INTO auth_security_events(id,user_id,kind,session_id) SELECT gen_random_uuid()::text,$1,'session.revoked',id FROM removed RETURNING session_id",
    [userId, currentSessionId, target]
  );
  if (target !== "others" && deleted.rowCount === 0) throw new NotFoundError("Active device");
  if (deleted.rowCount) {
    // No credentials or session identifiers in email. Delivery does not alter revocation.
    void alertSecurityEvent(
      userId,
      target === "others"
        ? "Other MenuMinute devices were signed out"
        : "A MenuMinute device was signed out"
    ).catch(() => {});
  }
  return deleted.rowCount ?? 0;
}
