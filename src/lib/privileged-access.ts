import { sql } from "drizzle-orm";
import { withActor } from "@/modules/tenancy/service";
import { env } from "@/lib/config/env";
/** New organizations require enrolled MFA; grandfathered organizations can be migrated deliberately. */
export async function needsMfaEnrollment(userId: string, factorEnabled: boolean) {
  if (factorEnabled) return false;
  if (
    env.AUTH_ALLOW_TEST_EMAIL &&
    new URL(env.APP_URL).hostname === "localhost" &&
    new URL(env.DATABASE_URL).pathname === "/menuminute_test"
  )
    return false;
  const result = await withActor({ userId }, (tx) =>
    tx.execute<{ required: boolean }>(
      sql`select exists(select 1 from organization_members m join organizations o on o.id=m.organization_id
      where m.user_id=${userId} and m.is_active and o.is_active and o.mfa_required
      and m.role in ('owner','admin')) as required`
    )
  );
  return Boolean(result.rows[0]?.required);
}
