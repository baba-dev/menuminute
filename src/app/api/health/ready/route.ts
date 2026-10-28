import { observedRoute } from "@/lib/observed-route";
import { getPool, verifyRuntimeRole } from "@/db";
import { redisHealth } from "@/lib/redis";
import { mediaStorageHealth } from "@/modules/media/storage";
export const dynamic = "force-dynamic";
async function observed_GET() {
  let database = false;
  try {
    await verifyRuntimeRole();
    await getPool().query("select 1 from drizzle.foundation_migrations limit 1");
    database = true;
  } catch {
    /* Safe public dependency state only. */
  }
  const [redis, media] = await Promise.all([redisHealth(), mediaStorageHealth()]);
  const ready = database && redis.queue && redis.cache && media;
  return Response.json(
    {
      status: ready ? "ready" : "unavailable",
      database,
      redis,
      media,
      release: process.env.NEXT_PUBLIC_RELEASE_SHA ?? null,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = observedRoute(observed_GET);
