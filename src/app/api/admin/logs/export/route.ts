import { NextRequest } from "next/server";
import { getPool } from "@/db";
import { env } from "@/lib/config/env";
import { verifySuperAdmin, recordAdminAction } from "@/lib/admin-guard";
import { observedRoute } from "@/lib/observed-route";
import { readAdminLogs } from "@/modules/admin/logs.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A new password+TOTP step-up must already have been completed in the active
 * session. It is consumed exactly once and cannot be replayed by another export.
 */
async function downloadDiagnostics(req: NextRequest) {
  const actor = await verifySuperAdmin();
  if (!actor.sessionId || req.headers.get("origin") !== new URL(env.APP_URL).origin)
    return Response.json({ message: "Export verification required" }, { status: 403 });
  const pool = getPool();
  const approval = await pool.query<{ session_id: string }>(
    "DELETE FROM auth_step_up WHERE session_id=$1 AND user_id=$2 AND expires_at > now() RETURNING session_id",
    [actor.sessionId, actor.id]
  );
  if (!approval.rows[0]) {
    return Response.json(
      { message: "Complete a new password and authenticator confirmation in Account Security" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  const logs = await readAdminLogs({range:"24h"});
  // Audit BEFORE handing out data. Failure to audit fails the export closed.
  await recordAdminAction(actor, "observability.logs.export", "system", null, {
    count: logs.entries.length, source:"sanitized-index", available:logs.available,
  });
  if (!logs.available) return Response.json({ message:"Collector unavailable" }, {status:503});
  return new Response(JSON.stringify({
    generatedAt:new Date().toISOString(),range:"24h",source:"sanitized-index",
    entries:logs.entries,
  }, null, 2), {
    headers: {
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"private, no-store",
      "Content-Disposition":'attachment; filename="menuminute-diagnostics.json"',
      "X-Content-Type-Options":"nosniff",
    },
  });
}
export const POST = observedRoute(downloadDiagnostics);
