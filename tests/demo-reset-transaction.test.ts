import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { resetDemoOutlet } from "../src/modules/demo/reset";

function fakePool(oldestMinutes: number) {
  const release = vi.fn();
  const query = vi.fn(async (statement: string): Promise<{ rows: unknown[] }> => {
    if (statement.includes("reset_demo_outlet")) {
      return { rows: [{ summary: { seededOrders: 400 } }] };
    }
    if (statement.includes("demo_reset_health")) {
      return {
        rows: [
          {
            health: {
              activeTickets: 13,
              oldestActiveMinutes: oldestMinutes,
              lastResetAgeMinutes: 0,
            },
          },
        ],
      };
    }
    return { rows: [] };
  });
  const pool = {
    connect: vi.fn(async () => ({ query, release })),
  } as unknown as Pick<Pool, "connect">;
  return { pool, query, release };
}

describe("demo restore transaction isolation", () => {
  it("uses a reset-only bounded timeout and commits only after Kitchen verification", async () => {
    const { pool, query, release } = fakePool(42);
    await expect(resetDemoOutlet(pool)).resolves.toMatchObject({ seededOrders: 400 });
    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      "BEGIN",
      "SET LOCAL statement_timeout = '60000ms'",
      "SET LOCAL lock_timeout = '5000ms'",
      "select app_private.reset_demo_outlet($1::jsonb) as summary",
      "select app_private.seed_demo_signals()",
      "select app_private.demo_reset_health() as health",
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases its connection when stale tickets remain", async () => {
    const { pool, query, release } = fakePool(10_699);
    await expect(resetDemoOutlet(pool)).rejects.toThrow(/freshness verification failed/);
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(query.mock.calls.map(([statement]) => statement)).not.toContain("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
