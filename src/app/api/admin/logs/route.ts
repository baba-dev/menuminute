import { NextRequest } from "next/server";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { observedRoute } from "@/lib/observed-route";
import { readAdminLogs } from "@/modules/admin/logs.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function fetchLogEntries(req: NextRequest) {
  await verifySuperAdmin();
  const p = req.nextUrl.searchParams;
  const response = await readAdminLogs({
    level: p.get("level") ?? undefined,
    service: p.get("service") ?? undefined,
    search: p.get("search") ?? undefined,
    range: p.get("range") ?? undefined,
    before: p.get("before") ?? undefined,
  });
  return Response.json(response, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export const GET = observedRoute(fetchLogEntries);
