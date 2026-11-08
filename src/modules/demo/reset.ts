import type { Pool } from "pg";
import { buildDemoBaseline } from "./baseline";

export { DEMO_RESET_INTERVAL_MS, demoModeEnabled, nextDemoResetAt } from "./ids";

/**
 * Only the restricted worker role can reset the fixed demo outlet. Never load the app's env,
 * Redis, or the migration-owner credentials here.
 */
export async function resetDemoOutlet(pool: Pick<Pool, "query">): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ summary: Record<string, number> }>(
    "select app_private.reset_demo_outlet($1::jsonb) as summary",
    [JSON.stringify(buildDemoBaseline())]
  );
  const summary = rows[0]?.summary;
  if (!summary || typeof summary["seededOrders"] !== "number" || summary["seededOrders"] < 9) {
    throw new Error("Demo order baseline was not restored");
  }

  // The demo's live table signals are regenerated after the order reset.
  await pool.query("select app_private.seed_demo_signals()");

  // The scheduled reset is not healthy merely because SQL returned 200. Explicitly verify
  // the age of the *real* active kitchen rows and the most recent reset ledger record.
  // If the worker is not running, the deployment parity gate must block enabling the demo.
  const status = await pool.query<{
    health: {
      activeTickets: number;
      oldestActiveMinutes: number | null;
      lastResetAgeMinutes: number | null;
    };
  }>("select app_private.demo_reset_health() as health");
  const health = status.rows[0]?.health;
  if (
    !health ||
    !Number.isInteger(health.activeTickets) ||
    health.activeTickets < 1 ||
    health.oldestActiveMinutes === null ||
    health.oldestActiveMinutes > 60 ||
    health.lastResetAgeMinutes === null ||
    health.lastResetAgeMinutes > 2
  ) {
    throw new Error("Demo kitchen freshness verification failed");
  }

  return summary;
}
