import type { Pool } from "pg";
import { buildDemoBaseline } from "./baseline";

export { DEMO_RESET_INTERVAL_MS, demoModeEnabled, nextDemoResetAt } from "./ids";

/**
 * Only the restricted worker role can reset the fixed demo outlet. Never load the app's env,
 * Redis, or the migration-owner credentials here.
 */
export async function resetDemoOutlet(
  pool: Pick<Pool, "connect">
): Promise<Record<string, number>> {
  // The general worker pool enforces a 5-second statement timeout. Demo restoration writes
  // 30 days of sample orders and their Kitchen fan-out, so give ONLY this transaction an
  // explicit bounded allowance. The client's normal settings are restored on COMMIT/ROLLBACK.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '60000ms'");
    await client.query("SET LOCAL lock_timeout = '5000ms'");

    const { rows } = await client.query<{ summary: Record<string, number> }>(
      "select app_private.reset_demo_outlet($1::jsonb) as summary",
      [JSON.stringify(buildDemoBaseline())]
    );
    const summary = rows[0]?.summary;
    if (!summary || typeof summary["seededOrders"] !== "number" || summary["seededOrders"] < 9) {
      throw new Error("Demo order baseline was not restored");
    }

    // A failed signals step or verification must not leave the demo partially restored.
    await client.query("select app_private.seed_demo_signals()");
    const status = await client.query<{
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
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
