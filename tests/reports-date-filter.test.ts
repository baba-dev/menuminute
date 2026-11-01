import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { reportOrderDateFilter } from "@/modules/reports/date-filter";

const dialect = new PgDialect();
describe("report date predicates", () => {
  it("keeps business_date authoritative and limits fallback to legacy NULL dates", () => {
    const query = dialect.sqlToQuery(
      reportOrderDateFilter("orders", "2026-10-01", "2026-10-31", "Asia/Kolkata")
    );
    expect(query.sql).toContain("business_date between");
    expect(query.sql).toContain("business_date is null");
    expect(query.sql).toContain("created_at >=");
    expect(query.sql).toContain("created_at <");
    expect(query.params).toContain("Asia/Kolkata");
  });
  it("qualifies order columns for order_items joins", () => {
    const query = dialect.sqlToQuery(
      reportOrderDateFilter("joined", "2026-10-01", "2026-10-31", "Asia/Kolkata")
    );
    expect(query.sql).toContain("o.business_date between");
    expect(query.sql).toContain("o.created_at >=");
  });
});
