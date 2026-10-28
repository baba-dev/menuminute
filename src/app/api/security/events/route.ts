import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getPool } from "@/db";
async function observed_GET(req: Request) {
  try {
    const actor = await requestActor(req);
    const result = await getPool().query(
      "select kind, occurred_at from auth_security_events where user_id=$1 order by occurred_at desc limit 30",
      [actor.userId]
    );
    return NextResponse.json(result.rows, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err, req);
  }
}

export const GET = observedRoute(observed_GET);
