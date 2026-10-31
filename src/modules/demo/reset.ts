import type { Pool } from "pg";
import { buildDemoBaseline } from "./baseline";

export { DEMO_RESET_INTERVAL_MS, demoModeEnabled } from "./ids";

/**
 * Restores the demo outlet to its baseline through the SECURITY DEFINER function (hardcoded to the
 * demo outlet). Callers must hold the restricted worker role. This module must stay free of the
 * application env/Redis modules: the production worker runs with worker-only credentials. The
 * public-menu cache (180 s TTL) therefore converges on its own after a reset.
 */
export async function resetDemoOutlet(pool: Pick<Pool, "query">): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ summary: Record<string, number> }>(
    "select app_private.reset_demo_outlet($1::jsonb) as summary",
    [JSON.stringify(buildDemoBaseline())]
  );
  return rows[0]!.summary;
}
