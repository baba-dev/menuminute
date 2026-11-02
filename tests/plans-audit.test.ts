import { describe, expect, it } from "vitest";
import { buildCapAudit, type AuditRow } from "../src/modules/plans/audit";

const row = (over: Partial<AuditRow>): AuditRow => ({
  outletId: "o",
  organizationId: "org",
  slug: "s",
  demo: false,
  ordering: false,
  kitchen: false,
  community: false,
  outlets: 1,
  dishes: 0,
  qrCodes: 0,
  tables: 0,
  chairs: 0,
  ...over,
});

describe("buildCapAudit", () => {
  it("flags only outlets strictly over a cap and ranks the worst first", () => {
    const audit = buildCapAudit([
      row({ outletId: "ok", dishes: 20, qrCodes: 2 }),
      row({ outletId: "bad", dishes: 35, qrCodes: 2 }),
      row({ outletId: "worse", dishes: 90, qrCodes: 5 }),
      row({ outletId: "paid", ordering: true, dishes: 150, qrCodes: 10 }),
    ]);
    expect(audit.over.map((e) => e.outletId)).toEqual(["worse", "bad"]);
    expect(audit.over[0]).toMatchObject({ dishesOver: 70, qrCodesOver: 3, plan: "free" });
  });

  it("separates 'at the cap' from 'over the cap'", () => {
    const audit = buildCapAudit([row({ outletId: "edge", dishes: 20, qrCodes: 1 })]);
    expect(audit.summary).toMatchObject({ overCount: 0, atCapCount: 1 });
  });

  it("applies plan caps: Ordering 200 dishes, Kitchen Pro 2,000, demo outlet on Kitchen Pro", () => {
    const audit = buildCapAudit([
      row({ outletId: "a", ordering: true, dishes: 201 }),
      row({ outletId: "b", kitchen: true, dishes: 236, qrCodes: 3, demo: true }),
    ]);
    expect(audit.over.map((e) => e.outletId)).toEqual(["a"]);
    expect(audit.entries[1]).toMatchObject({ plan: "kitchen_pro", dishesOver: 0, demo: true });
  });

  it("flags an organization with more outlets than its plan allows, but not a single outlet", () => {
    const audit = buildCapAudit([
      row({ outletId: "one", outlets: 1 }),
      row({ outletId: "many", outlets: 3 }),
      row({ outletId: "pro", kitchen: true, outlets: 10 }),
      row({ outletId: "pro-over", kitchen: true, outlets: 11 }),
    ]);
    expect(audit.over.map((e) => [e.outletId, e.outletsOver])).toEqual([
      ["many", 2],
      ["pro-over", 1],
    ]);
  });

  it("never flags Community Edition and counts plans", () => {
    const audit = buildCapAudit([
      row({ outletId: "c", community: true, dishes: 5000, qrCodes: 99 }),
      row({ outletId: "f" }),
    ]);
    expect(audit.over).toEqual([]);
    expect(audit.summary).toMatchObject({ communityExcluded: 1, outlets: 2 });
    expect(audit.summary.byPlan).toEqual({ free: 1, ordering: 0, kitchen_pro: 0, dedicated: 1 });
  });
});
