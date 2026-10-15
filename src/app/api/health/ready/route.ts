import { getPool, verifyRuntimeRole } from "@/db";
import { redisHealth } from "@/lib/redis";
export const dynamic = "force-dynamic";
export async function GET() {
  let database = false;
  try {
    await verifyRuntimeRole();
    await getPool().query("select 1 from drizzle.foundation_migrations limit 1");
    database = true;
  } catch {
    /* Safe public dependency state only. */
  }
  const redis = await redisHealth();
  const ready = database && redis.queue && redis.cache;
  return Response.json(
    { status: ready ? "ready" : "unavailable", database, redis },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
