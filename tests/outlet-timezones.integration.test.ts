import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { servicePulse } from "../src/modules/orders/workspace";
import { availableOutletTimezones } from "../src/modules/timezones/service";

describe("restaurant timezone PostgreSQL safeguards", () => {
  it("offers only mutually supported zones and rejects unsupported SQL updates", async () => {
    const f = await fixture();
    const zones = await availableOutletTimezones();
    expect(zones).toContain("Asia/Kolkata");
    expect(zones).not.toContain("Asia/Calcutta");
    await admin(async (_, pool) => {
      await expect(
        pool.query("update restaurants set timezone=$1 where id=$2", ["Asia/Calcutta", f.outlet.id])
      ).rejects.toMatchObject({ code: "22023" });
      await expect(
        pool.query("update restaurants set timezone=$1 where id=$2", ["Mars/Olympus", f.outlet.id])
      ).rejects.toMatchObject({ code: "22023" });
      const row = await pool.query<{ timezone: string }>(
        "select timezone from restaurants where id=$1",
        [f.outlet.id]
      );
      expect(row.rows[0]?.timezone).toBe("Asia/Kolkata");
    });
  });

  it("calculates local-day UTC boundaries correctly through DST changes", async () => {
    await admin(async (_, pool) => {
      const result = await pool.query<{ fall_seconds: number; spring_seconds: number }>(
        `select
          extract(epoch from
            ('2026-11-02'::timestamp at time zone 'America/New_York') -
            ('2026-11-01'::timestamp at time zone 'America/New_York')
          )::int as fall_seconds,
          extract(epoch from
            ('2026-03-09'::timestamp at time zone 'America/New_York') -
            ('2026-03-08'::timestamp at time zone 'America/New_York')
          )::int as spring_seconds`
      );
      expect(result.rows[0]).toMatchObject({ fall_seconds: 90000, spring_seconds: 82800 });
    });
  });

  it("counts terminal transitions today even when the order was created on an earlier business date", async () => {
    const f = await fixture();
    const orderId = "ord-" + crypto.randomUUID();
    const eventId = crypto.randomUUID();
    await admin(async (_, pool) => {
      await pool.query(
        `insert into orders(id, restaurant_id, status, business_date, order_number, created_at)
         values($1,$2,'served',(now() - interval '3 days')::date, 812345, now() - interval '3 days')`,
        [orderId, f.outlet.id]
      );
      await pool.query(
        `insert into order_status_events(id,order_id,restaurant_id,to_status,status,created_at)
         values($1,$2,$3,'served','served',now())`,
        [eventId, orderId, f.outlet.id]
      );
    });
    const pulse = await servicePulse(f.actor, f.outlet.organizationId, f.outlet.id);
    expect(pulse.completedToday).toBe(1);
    const original = await admin(async (_, pool) =>
      pool.query<{ business_date: string }>("select business_date::text from orders where id=$1", [
        orderId,
      ])
    );
    expect(original.rows[0]?.business_date).not.toBe(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
    );
  });
});
