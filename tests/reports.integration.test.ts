import { describe, expect, it } from "vitest";
import { fixture } from "./helpers";
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
