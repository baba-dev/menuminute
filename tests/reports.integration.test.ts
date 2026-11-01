import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { reportQuerySchema } from "../src/modules/reports/contracts";
import { getReportsWorkspace } from "../src/modules/reports/service";

describe("Reports restricted PostgreSQL projections", () => {
  it("returns real zero-data results without synthetic cash or kitchen metrics", async () => {
    const f = await fixture();
    const overview = await getReportsWorkspace(
      f.actor,
      f.outlet.id,
      reportQuerySchema.parse({ tab: "overview" })
    );
    expect(overview.executive.grossSalesMinor).toBe(0);
    expect(overview.menuEngineering.totalItemsSold).toBe(0);

    const till = await getReportsWorkspace(
      f.actor,
      f.outlet.id,
      reportQuerySchema.parse({ tab: "till" })
    );
    expect(till.tillReconciliation.available).toBe(true);
    expect(till.tillReconciliation.totalCollectedMinor).toBe(0);
    expect(till.tillReconciliation.totalRefundedMinor).toBe(0);
    expect(till.tillReconciliation.tenders).toEqual([]);
    expect(till.tillReconciliation.shifts).toEqual([]);

    const kitchen = await getReportsWorkspace(
      f.actor,
      f.outlet.id,
      reportQuerySchema.parse({ tab: "kitchen" })
    );
    expect(kitchen.kitchenVelocity.available).toBe(true);
    expect(kitchen.kitchenVelocity.totalTickets).toBe(0);
    expect(kitchen.kitchenVelocity.avgPrepMinutes).toBe(0);
    expect(kitchen.kitchenVelocity.medianPrepMinutes).toBe(0);
    expect(kitchen.kitchenVelocity.stations).toEqual([]);
    expect(kitchen.kitchenVelocity.sla).toMatchObject({
      fastCount: 0,
      standardCount: 0,
      delayedCount: 0,
      fastPct: 0,
      standardPct: 0,
      delayedPct: 0,
    });
  });

  it("preserves assigned business dates and timezone-local fallback for legacy orders", async () => {
    const f = await fixture();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);

    await admin(async (_db, pool) => {
      const rows = [
        // Business date overrides the previous calendar day's created_at.
        { id: crypto.randomUUID(), businessDate: today, createdAt: `${yesterday}T12:00:00Z`, total: 100 },
        // Legacy row without business_date uses the outlet-local calendar day.
        { id: crypto.randomUUID(), businessDate: null, createdAt: `${today}T12:00:00Z`, total: 200 },
        // An older legacy row is excluded from the current period.
        { id: crypto.randomUUID(), businessDate: null, createdAt: `${yesterday}T12:00:00Z`, total: 900 },
      ];
      for (const [index, row] of rows.entries()) {
        await pool.query(
          `insert into orders
            (id, restaurant_id, status, order_number, business_date, created_at,
             total_minor, subtotal_minor, tax_minor)
           values ($1, $2, 'served', $3, $4, $5, $6, $6, 0)`,
          [row.id, f.outlet.id, index + 1, row.businessDate, row.createdAt, row.total]
        );
      }
    });

    const result = await getReportsWorkspace(
      f.actor,
      f.outlet.id,
      reportQuerySchema.parse({ range: "custom", from: today, to: today, tab: "overview" })
    );
    expect(result.executive.totalOrders).toBe(2);
    expect(result.executive.grossSalesMinor).toBe(300);
    expect(result.executive.completedOrders).toBe(2);
  });

  it("does not disclose data across outlet ownership boundaries", async () => {
    const first = await fixture();
    const second = await fixture();
    await expect(
      getReportsWorkspace(
        first.actor,
        second.outlet.id,
        reportQuerySchema.parse({ range: "today" })
      )
    ).rejects.toThrow();
  });
});
