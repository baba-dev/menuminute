import { getPool } from "@/db";

/**
 * Better Auth's native TOTP plugin challenges credential sign-in, not OAuth.
 * A linked Google identity must not create an unchallenged session for an
 * authenticator-protected account. Check both identity email and stable subject:
 * a Google profile email can change while an existing provider link remains.
 */
export async function googleMfaBlocked(email: string, externalId: string): Promise<boolean> {
  const rows = await getPool().query(
    "select 1 from users u where u.two_factor_enabled=true and (lower(u.email)=lower($1) or exists (select 1 from accounts a where a.user_id=u.id and a.provider_id='google' and a.account_id=$2)) limit 1",
    [email, externalId]
  );
  return Boolean(rows.rowCount);
}
