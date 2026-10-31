import type { Pool } from "pg";
import { buildDemoBaseline } from "./baseline";

export const DEMO_RESET_INTERVAL_MS = 30 * 60 * 1000;

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

/** True when the kill switch is on. Defaults to off: no demo reset runs unless explicitly enabled. */
export function demoModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["DEMO_MODE_ENABLED"] === "true";
}
