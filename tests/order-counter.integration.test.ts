import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";

describe("atomic daily sequence after migration 0025", () => {
  it("increments the greater existing counter, without scanning the orders table", async () => {
    const { outlet } = await fixture();
    const businessDate = "2026-10-25";
    await admin(async (_, p) => {
      await p.query(
        "insert into orders(id,restaurant_id,order_number,business_date) values($1,$2,55,$3::date)",
        ["legacy-" + crypto.randomUUID(), outlet.id, businessDate]
      );
      await p.query(
        "insert into app_private.order_counters(restaurant_id,business_date,last_order_number) values($1,$2::date,79)",
        [outlet.id, businessDate]
      );
    });
    const pool = new Pool({
      connectionString: process.env["MIGRATION_DATABASE_URL"],
      max: 12,
    });
    try {
      const results = await Promise.all(
        Array.from({ length: 24 }, async () => {
          const value = await pool.query<{ next: number }>(
            "select app_private.next_order_number($1,$2::date) as next",
            [outlet.id, businessDate]
          );
          return value.rows[0]!.next;
        })
      );
      expect([...results].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 24 }, (_, i) => i + 80)
      );
      const newDate = await pool.query<{ next: number }>(
        "select app_private.next_order_number($1,$2::date) as next",
        [outlet.id, "2026-10-26"]
      );
      expect(newDate.rows[0]?.next).toBe(1);
      const other = await fixture();
      const otherResult = await pool.query<{ next: number }>(
        "select app_private.next_order_number($1,$2::date) as next",
        [other.outlet.id, businessDate]
      );
      expect(otherResult.rows[0]?.next).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
